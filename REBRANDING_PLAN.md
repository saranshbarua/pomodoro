# 🌊 Project Flumen: Rebranding & v2.0.0 Launch Plan

## Overview
- **New Name:** Flumen
- **Tagline:** Focus Timer for Mac
- **Version:** 2.0.0
- **Bundle ID:** `com.saranshbarua.flumen`
- **Strategy:** Clean break (New Bundle ID) to establish a fresh brand identity for Product Hunt.

---

## Phase 1: Core Identity & Metadata
*Goal: Update the "DNA" of the application to reflect the new brand.*

### 1.1 macOS App Configuration (`macos/Pomodoro/Info.plist`)
- [x] **`CFBundleName`**: Change from `Pomodoro` to `Flumen`.
- [x] **`CFBundleDisplayName`**: Change from `Pomodoro` to `Flumen`.
- [x] **`CFBundleExecutable`**: Change from `Pomodoro` to `Flumen`.
- [x] **`CFBundleIdentifier`**: Change from `com.saranshbarua.pomodoro` to `com.saranshbarua.flumen`.
- [x] **`CFBundleShortVersionString`**: Set to `2.0.0`.
- [x] **`SUFeedURL`**: Update to `https://raw.githubusercontent.com/saranshbarua/flumen/main/flumen-appcast.xml`.

### 1.2 Package Metadata (`package.json`)
- [x] **`name`**: Change to `flumen`.
- [x] **`version`**: Change to `2.0.0`.
- [x] **`description`**: "Flumen is a minimalist focus timer for Mac. Glanceable, elegant, and built to keep you in flow."
- [x] **`keywords`**: Add `flumen`, `macos`, `focus timer`, `pomodoro`, `productivity`, `flow state`.
- [x] **`author`**: Set to `Saransh Barua`.

### 1.3 UI String Updates (React & Swift)
- [x] **Menu Bar (`StatusBarController.swift`)**: Update accessibility description and "About" menu item.
- [x] **App Menu (`AppDelegate.swift`)**: Update "About Pomodoro" and "Quit Pomodoro" labels.
- [x] **Settings View (`SettingsView.tsx`)**: Update "Quit Pomodoro" button text.
- [x] **Task Shelf (`TaskShelf.tsx`)**: Update "Est. Pomos" label to "Est. Sessions".
- [x] **General UI (`App.tsx`, etc.)**: Replace "Pomo" with "Session" or "Flow" where appropriate.
- [x] **About Panel**: Ensure "Flumen" is displayed as the app name.

---

## Phase 2: Distribution & Build Pipeline
*Goal: Ensure the update mechanism and build scripts generate the correct "Flumen" artifacts.*

### 2.1 Build Script (`build_app.sh`)
- [x] **`APP_NAME`**: Update variable to `Flumen`.
- [x] **Binary Path**: Update `BINARY_PATH` logic to find the `Flumen` binary.
- [x] **Cleanup**: Update cleanup logic to remove `Flumen.app` and `Flumen_macOS_Universal.zip`.
- [x] **Signing**: Ensure `codesign` targets the new `Flumen.app`.

### 2.2 Sparkle Update Feed (`appcast.xml`)
- [x] **Rename File**: Rename `appcast.xml` to `flumen-appcast.xml`.
- [x] **Internal Metadata**:
    - Update `<title>` to "Flumen – Focus Timer for Mac".
    - Update `<enclosure>` URLs to point to `https://github.com/saranshbarua/flumen/releases/download/v2.0.0/Flumen_macOS_Universal.zip`.

### 2.3 Release Automation & CI
- [x] **`.release-it.json`**:
    - Update `tagName` to `v${version}` (will be `v2.0.0`).
    - Update `hooks` to target `macos/Pomodoro/Info.plist` (or rename directory if needed).
- [x] **GitHub Actions (`.github/workflows/release.yml`)**:
    - Update `APPCAST_FILE` environment variable to `flumen-appcast.xml`.
    - Update check for `Flumen_macOS_Universal.zip`.
    - Update `REPO_URL` logic if necessary.

---

## Phase 3: Marketing & Web Presence
*Goal: Prepare the "Brutalist" landing page and repository for the Product Hunt audience.*

### 3.1 Landing Page (`docs/index.html`)
- [x] **Branding**: Replace all instances of "Pomodoro" and "MECHANICAL SOUL" with "Flumen".
- [x] **Tagline**: Update to "Focus Timer for Mac".
- [x] **SEO Meta Tags**:
    - [x] `<title>`: Flumen — Focus Timer for Mac
    - [x] `description`: Minimalist focus engine for macOS.
- [x] **Download Links**: Update to point to the new `Flumen_macOS_Universal.zip` on the `flumen` repo.
- [x] **Setup Guide**: Ensure instructions refer to `Flumen.app`.

### 3.2 Documentation (`README.md`, `SUPPORT.md`, etc.)
- [x] **`README.md`**: Full rewrite for Flumen v2.0.0 branding.
- [x] **Links**: Update all GitHub links from `.../pomodoro` to `.../flumen`.
- [x] **License**: Ensure license mentions Flumen.

### 3.3 Cleanup
- [x] **Delete `landing-page/`**: Remove the unused React landing page directory.
- [x] **Delete `appcast-staging.xml`**: If no longer needed for the new brand.

---

## Phase 4: Launch Execution
*Goal: Final verification and public release.*

1. [x] **Final Build**: Run `build_app.sh` and verify `Flumen.app` is generated correctly.
2. [x] **Smoke Test**: Verify the app launches, shows "Flumen" in the menu, and the "About" panel is correct. (Verified bundle structure and binary generation)
3. [ ] **GitHub Rename**: Rename repo to `flumen` (User Action).
4. [ ] **Tag & Release**: Run `npm run release` to push `v2.0.0`.
5. [ ] **Product Hunt**: Submit with the new identity.
