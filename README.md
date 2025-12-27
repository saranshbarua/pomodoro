# Pomodoro macOS App

An "Award-Winning" high-fidelity Pomodoro timer for macOS. Built with React, TypeScript, and Native Swift.

## Features
- **Native macOS Behavior**: Menu bar popup (popover style), space-aware, and click-outside to hide.
- **Premium UI**: Film grain texture, dynamic blob backgrounds, and smooth 60fps animations.
- **Task Management**: Integrated task list with "Single-Task Focus" UX.
- **Analytics**: Detailed reports on daily focus, project distribution, and streaks.
- **Native Sync**: Notification support and menu bar time display.

## Tech Stack
- **Frontend**: React 19, Vite, Zustand (State), Recharts (Analytics).
- **Native Wrapper**: Swift, AppKit, WKWebView.
- **Build System**: Custom shell scripts for bundling into a standard `.app`.

## Getting Started

### Prerequisites
- macOS 13+
- Node.js & npm
- Xcode Command Line Tools (`xcode-select --install`)

### Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite dev server:
   ```bash
   npm run dev
   ```
3. Open the project in Xcode (optional) or use the build script.

### Building & Distribution
To bundle the app into a native macOS `.app` file and create a distribution ZIP:
```bash
sh build_app.sh
```
This will create:
1. `Pomodoro.app`: The macOS application bundle.
2. `Pomodoro_v1.0.0_macOS_Universal.zip`: A universal binary archive (Intel + Apple Silicon) ready for distribution.

### Note for Users
Since the app is not signed with a paid Apple Developer certificate, users must:
1. **Right-Click** `Pomodoro.app`.
2. Select **Open**.
3. Click **Open** again in the security dialog.
This is only required for the first launch.

### Testing
We use Vitest for automated testing:
```bash
npm test -- --run
```

## Documentation
- [Features](FEATURES.md) - Full list of capabilities.
- [Codebase Guide](CODEBASE.md) - Architectural overview.
- [Testing Strategy](TESTING.md) - Manual and automated test cases.
- [Roadmap](ROADMAP.md) - Future plans.

