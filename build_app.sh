#!/bin/bash

# --- Pomodoro App Full Packaging Script ---
# This script builds the React frontend, compiles the Swift native code,
# and packages them into a proper Pomodoro.app bundle.

set -e

APP_NAME="Pomodoro"
APP_BUNDLE="$APP_NAME.app"
CONTENTS_DIR="$APP_BUNDLE/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

echo "🚀 Starting full build for $APP_NAME..."

# 1. Build the React frontend
echo "📦 Building React frontend..."
npm install
npm run build

# 2. Build the Swift binary
echo "🍎 Building Swift native binary (Release)..."
cd macos/Pomodoro
swift build -c release --arch arm64 --arch x86_64 # Universal binary

# 3. Create the .app structure
echo "📂 Creating .app bundle structure..."
cd ../../
rm -rf "$APP_BUNDLE"
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# 4. Copy the binary
echo "📄 Copying binary..."
cp "macos/Pomodoro/.build/apple/Products/Release/Pomodoro" "$MACOS_DIR/$APP_NAME"
chmod +x "$MACOS_DIR/$APP_NAME"

# 5. Copy Info.plist and Icon
echo "📄 Copying Info.plist and Icon..."
cp "macos/Pomodoro/Info.plist" "$CONTENTS_DIR/"
cp "macos/Pomodoro/Sources/AppIcon.icns" "$RESOURCES_DIR/"

# 6. Copy bundled React files
echo "📂 Copying React bundle..."
rm -rf "$RESOURCES_DIR/dist"
mkdir -p "$RESOURCES_DIR/dist"
cp -R dist/* "$RESOURCES_DIR/dist/"
cp src/assets/click.mp3 "$RESOURCES_DIR/"

# 7. Ad-hoc Sign the bundle (Required for notifications on ARM Macs)
echo "🔐 Ad-hoc signing the app..."
codesign --force --deep --sign - "$APP_BUNDLE"

# 8. Finalize
echo ""
echo "✅ SUCCESS! $APP_BUNDLE has been created in the project root."
echo "-----------------------------------------------------------"
echo "🚀 To share with friends:"
echo "1. Right-click '$APP_BUNDLE' and select 'Compress \"$APP_NAME\"'."
echo "2. Send the resulting .zip file to your friends."
echo ""
echo "Note: Since the app is not signed, your friends must:"
echo "Right-Click > Open the app the first time to bypass macOS security."
echo "If you renamed the app, make sure to keep the internal executable named 'Pomodoro'."
