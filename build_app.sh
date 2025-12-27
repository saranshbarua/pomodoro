#!/bin/bash

# --- Pomodoro App Full Packaging Script ---
# This script builds the React frontend, compiles the Swift native code,
# and packages them into a proper Pomodoro.app bundle.

set -e

# --- Configuration ---
APP_NAME="Pomodoro"
VERSION=$(grep '"version":' package.json | cut -d'"' -f4)
APP_BUNDLE="$APP_NAME.app"
CONTENTS_DIR="$APP_BUNDLE/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
ZIP_NAME="${APP_NAME}_v${VERSION}_macOS_Universal.zip"

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

# 2. Build the Swift binary (Universal)
echo "🍎 Building Swift native binary (Intel + Apple Silicon)..."
cd macos/Pomodoro
# We force a clean build of the native code to ensure fresh architecture slices
rm -rf .build
swift build -c release --arch arm64 --arch x86_64
BINARY_PATH=$(swift build -c release --arch arm64 --arch x86_64 --show-bin-path)/Pomodoro
cd ../../

# 3. Create the .app structure
echo "📂 Creating .app bundle structure..."
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# 4. Copy the universal binary
echo "📄 Copying Universal binary..."
cp "$BINARY_PATH" "$MACOS_DIR/$APP_NAME"
chmod +x "$MACOS_DIR/$APP_NAME"

# 5. Copy Info.plist and Icon
echo "📄 Copying Info.plist and Icon..."
cp "macos/Pomodoro/Info.plist" "$CONTENTS_DIR/"
cp "macos/Pomodoro/Sources/AppIcon.icns" "$RESOURCES_DIR/"

# 6. Copy bundled React files and assets
echo "📂 Copying React bundle and audio..."
mkdir -p "$RESOURCES_DIR/dist"
cp -R dist/* "$RESOURCES_DIR/dist/"
cp src/assets/click.mp3 "$RESOURCES_DIR/"

# 7. Ad-hoc Sign the bundle (Required for notifications/haptics on modern macOS)
echo "🔐 Ad-hoc signing the app..."
codesign --force --deep --sign - "$APP_BUNDLE"

# 8. Create ZIP archive for distribution
echo "📦 Creating distribution archive..."
zip -q -r "$ZIP_NAME" "$APP_BUNDLE"

# 9. Finalize
echo ""
echo "✅ SUCCESS! Build complete."
echo "-----------------------------------------------------------"
echo "📂 App Bundle: $APP_BUNDLE"
echo "📦 Dist Zip:   $ZIP_NAME"
echo "-----------------------------------------------------------"
echo "🚀 To Distribute:"
echo "Upload $ZIP_NAME to GitHub Releases or Product Hunt."
echo ""
echo "⚠️  Reminder for Users:"
echo "Since the app is ad-hoc signed, users must Right-Click > Open"
echo "the first time to bypass the 'Unidentified Developer' warning."
