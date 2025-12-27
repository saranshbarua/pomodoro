# Pomodoro: World-Class Product Roadmap

This document outlines the vision and feature set required to transform this Pomodoro timer into an award-winning macOS application focused on elite productivity and delightful user experience.

---

## 1. Elite macOS Presence
*   **Live Menu Bar Progress**: Display the remaining time directly in the menu bar. Implement a dynamic SVG/Canvas status icon that acts as a progress ring. [V1] (Done)
*   **One-Click Tray Interaction**: Support right-click context menus on the tray icon for quick actions (Pause, Reset, Skip) without opening the main window. [V1] (Done)
*   **Detachable Mini-Player**: A "tear-off" mode that creates a tiny, always-on-top floating pill for users who want constant visual feedback. [V2] (De-prioritized)

## 2. Sensory Flow State
*   **Focus Soundscapes**: Integrated high-fidelity ambient audio (Rain, White Noise, Lo-Fi, Deep Space) that activates with the timer. [V2] (De-prioritized)
*   **Taptic Feedback**: Use the MacBook's Taptic Engine to provide subtle physical clicks on session start/completion and "tick" feedback during the final 10 seconds. [V1] (De-prioritized)
*   **Visual Breath Sync**: Sync the background blob animation with a 4-7-8 breathing rhythm during break sessions to facilitate physiological recovery. [V1] (Done)

## 3. Deep System Integration
*   **macOS Focus Filter**: Automatically trigger/suggest macOS Focus Modes when a timer starts to silence external distractions (Slack, Mail). [V2]
*   **Siri & Shortcuts**: Full support for Apple Shortcuts to allow automation (e.g., "Start Focus session when I open VS Code"). [V2]
*   **Interactive Desktop Widgets**: Beautiful widgets for the macOS desktop/Notification Center showing daily goals and current status. [V2] (De-prioritized)

## 4. Intelligent Analytics & Intentionality
*   **Session Tagging**: Allow users to tag sessions (e.g., #Coding, #Writing, #Meetings) to categorize focus time. [V2] (Done)
*   **Productivity Heatmap**: A GitHub-style contribution graph visualizing focus intensity over weeks and months. [V2] (De-prioritized)
*   **Focus Narrative**: Weekly automated reports comparing performance trends and identifying "Peak Focus Hours." [V2] (Done)

## 5. Power-User Features
*   **Global Hotkeys**: System-wide customizable shortcuts (e.g., `Cmd+Shift+Space`) to toggle the timer from any application. [V2]
*   **Auto-Pilot Mode**: Configurable automation to automatically transition from break to focus, or vice-versa. [V1] (Done)
*   **iCloud Sync**: Seamless synchronization of settings, custom timers, and daily progress across multiple Macs. [V2] (De-priorized)

---

## 🎨 Design Philosophy
*   **Minimalist but Playful**: High-end typography (Inter/SF Pro) combined with organic, fluid animations.
*   **Non-Intrusive**: The app should feel like a part of the OS, not a separate layer.
*   **High Performance**: Zero CPU usage when idle; optimized 60fps animations using `requestAnimationFrame`.

