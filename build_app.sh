#!/bin/bash

# --- Flumen App Full Packaging Script ---
# This script builds the React frontend, compiles the Swift native code,
# and packages them into a proper Flumen.app bundle.

set -e

# --- Configuration ---
APP_NAME="Flumen"
VERSION=$(grep '"version":' package.json | cut -d'"' -f4)
APP_BUNDLE="$APP_NAME.app"
CONTENTS_DIR="$APP_BUNDLE/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
HELPERS_DIR="$CONTENTS_DIR/Helpers"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
ZIP_NAME="${APP_NAME}_macOS_Universal.zip"
SIGNING_IDENTITY="${FLUMEN_SIGNING_IDENTITY:--}"

echo "🚀 Starting Production Build for $APP_NAME v$VERSION..."

# 0. Clean up previous builds
echo "🧹 Cleaning workspace..."
rm -rf "$APP_BUNDLE"
rm -f "$ZIP_NAME"
rm -rf dist

# 1. Build the React frontend
echo "📦 Building React frontend..."
npm install --silent
npm run build -- --logLevel error

# SPM Flumen target requires Sources/dist as a bundled resource (.copy("dist")).
# Production still serves UI from Contents/Resources/dist (copied below); this sync
# is what lets `swift build` succeed on a clean checkout.
echo "📎 Syncing frontend into SPM Sources/dist..."
rm -rf macos/Pomodoro/Sources/dist
mkdir -p macos/Pomodoro/Sources/dist
cp -R dist/* macos/Pomodoro/Sources/dist/

# 2. Build the Swift binary (Universal)
echo "🍎 Building Swift native binary (Intel + Apple Silicon)..."
cd macos/Pomodoro
# We force a clean build of the native code to ensure fresh architecture slices
rm -rf .build
swift build -c release --arch arm64 --arch x86_64
SWIFT_BIN_PATH=$(swift build -c release --arch arm64 --arch x86_64 --show-bin-path)
BINARY_PATH="$SWIFT_BIN_PATH/Flumen"
MCP_HELPER_PATH="$SWIFT_BIN_PATH/flumen-mcp"
cd ../../

if [ ! -x "$MCP_HELPER_PATH" ]; then
    echo "❌ Error: MCP helper was not produced at $MCP_HELPER_PATH"
    exit 1
fi

# 3. Create the .app structure
echo "📂 Creating .app bundle structure..."
mkdir -p "$MACOS_DIR"
mkdir -p "$HELPERS_DIR"
mkdir -p "$RESOURCES_DIR"
mkdir -p "$CONTENTS_DIR/Frameworks"

# 4. Copy the universal binary
echo "📄 Copying Universal binary..."
cp "$BINARY_PATH" "$MACOS_DIR/$APP_NAME"
chmod +x "$MACOS_DIR/$APP_NAME"

echo "📄 Copying MCP helper..."
cp "$MCP_HELPER_PATH" "$HELPERS_DIR/flumen-mcp"
chmod +x "$HELPERS_DIR/flumen-mcp"

echo "🔎 Verifying universal binaries..."
lipo "$MACOS_DIR/$APP_NAME" -verify_arch arm64 x86_64
lipo "$HELPERS_DIR/flumen-mcp" -verify_arch arm64 x86_64

# 4.0.1 Set RPATH for Sparkle
# This tells the binary to look in the Frameworks folder for Sparkle
echo "🛠️  Setting RPATH for Sparkle..."
install_name_tool -add_rpath "@executable_path/../Frameworks" "$MACOS_DIR/$APP_NAME" || true

# 4.1 Bundle Sparkle Framework
# Since we use SPM, we need to find and copy the Sparkle framework
echo "📦 Bundling Sparkle framework..."
# We search for the built Sparkle.framework in the build directory
SPARKLE_FRAMEWORK_PATH=$(find macos/Pomodoro/.build -name "Sparkle.framework" -type d | head -n 1)
if [ -n "$SPARKLE_FRAMEWORK_PATH" ]; then
    echo "  -> Found Sparkle at: $SPARKLE_FRAMEWORK_PATH"
    cp -R "$SPARKLE_FRAMEWORK_PATH" "$CONTENTS_DIR/Frameworks/"
else
    echo "  ⚠️ Warning: Sparkle.framework not found in .build folder."
    echo "  This might cause the app to fail at launch if not linked statically."
fi

# 5. Copy Info.plist and Icon
echo "📄 Copying Info.plist and Icon..."
cp "macos/Pomodoro/Info.plist" "$CONTENTS_DIR/"
cp "macos/Pomodoro/Sources/AppIcon.icns" "$RESOURCES_DIR/"
cp "macos/Pomodoro/Sources/MenuBarIcon.png" "$RESOURCES_DIR/"
cp "macos/Pomodoro/Sources/MenuBarIcon@2x.png" "$RESOURCES_DIR/"

# 5.1 Inject Version into Info.plist
# This ensures CFBundleShortVersionString always matches package.json
echo "💉 Injecting version $VERSION into Info.plist..."
plutil -replace CFBundleShortVersionString -string "$VERSION" "$CONTENTS_DIR/Info.plist"

# 5.2 Configure Staging Identity if needed
if [[ "$VERSION" == *"-staging"* ]]; then
  echo "🔧 Configuring staging build identifiers..."
  # Use a distinct name for the staging app
  APP_NAME_STAGING="Flumen Staging"
  plutil -replace CFBundleName -string "$APP_NAME_STAGING" "$CONTENTS_DIR/Info.plist"
  # Change the bundle ID to avoid sharing local data (SQLite/UserDefaults) with production
  plutil -replace CFBundleIdentifier -string "com.saranshbarua.flumen.staging" "$CONTENTS_DIR/Info.plist"
  # Point to the staging update feed
  plutil -replace SUFeedURL -string "https://raw.githubusercontent.com/saranshbarua/flumen/staging/flumen-appcast-staging.xml" "$CONTENTS_DIR/Info.plist"
fi

# Also set a unique build number based on current timestamp
BUILD_NUMBER=$(date +%Y%m%d.%H%M%S)
plutil -replace CFBundleVersion -string "$BUILD_NUMBER" "$CONTENTS_DIR/Info.plist"

# 6. Copy bundled React files and assets
echo "📂 Copying React bundle and audio..."
mkdir -p "$RESOURCES_DIR/dist"
cp -R dist/* "$RESOURCES_DIR/dist/"
cp src/assets/click.mp3 "$RESOURCES_DIR/"

# 7. Sign nested components before the app bundle.
if [ "$SIGNING_IDENTITY" = "-" ]; then
    echo "🔐 Ad-hoc signing the app components..."
    CODESIGN_ARGS=(--force --sign -)
else
    echo "🔐 Developer ID signing the app components..."
    CODESIGN_ARGS=(--force --timestamp --options runtime --sign "$SIGNING_IDENTITY")
fi

echo "  -> Signing flumen-mcp..."
codesign "${CODESIGN_ARGS[@]}" "$HELPERS_DIR/flumen-mcp"

# First, sign any bundled frameworks
if [ -d "$CONTENTS_DIR/Frameworks/Sparkle.framework" ]; then
    echo "  -> Signing Sparkle.framework..."
    codesign "${CODESIGN_ARGS[@]}" "$CONTENTS_DIR/Frameworks/Sparkle.framework"
fi

# Then sign the main bundle
echo "  -> Signing $APP_BUNDLE..."
codesign --deep "${CODESIGN_ARGS[@]}" "$APP_BUNDLE"
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"

# 8. Create ZIP archive for distribution
echo "📦 Creating distribution archive..."
# Refresh Launch Services cache so the system sees the new icon immediately
touch "$APP_BUNDLE"
zip -q -r "$ZIP_NAME" "$APP_BUNDLE"

# 9. Finalize
echo ""
echo "✅ SUCCESS! Build complete."
echo "-----------------------------------------------------------"
echo "📂 App Bundle: $APP_BUNDLE"
echo "📦 Dist Zip:   $ZIP_NAME"
echo "📏 Bundle Size: $(du -sh "$APP_BUNDLE" | awk '{print $1}')"
echo "📏 ZIP Size:    $(du -sh "$ZIP_NAME" | awk '{print $1}')"
echo "-----------------------------------------------------------"
echo "🚀 To Distribute:"
echo "Upload $ZIP_NAME to GitHub Releases or Product Hunt."
echo ""
if [ "$SIGNING_IDENTITY" = "-" ]; then
  echo "⚠️  Reminder for Users:"
  echo "Since the app is ad-hoc signed, users must Right-Click > Open"
  echo "the first time to bypass the 'Unidentified Developer' warning."
else
  echo "✅ Developer ID signing complete. Notarize the ZIP before distribution."
fi
