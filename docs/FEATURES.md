# Product Features - Flumen macOS

A premium, award-winning focus timer built for macOS, focusing on deep work, high-fidelity UI, and project-level reporting.

## 1. Core Timer Experience
- **Focus Cycles**: Built-in logic for Focus (25m), Short Break (5m), and Long Break (15m).
- **Session Transitions**: Automatic advancement through focus cycles (default: 4 sessions before a long break).
- **Accurate Timekeeping**: Uses a timestamp-based engine to prevent drift, ensuring sub-second accuracy even if the app is backgrounded.
- **Smooth Animation**: The circular progress ring updates smoothly using `requestAnimationFrame`, mimicking a sweep-second hand.
- **Layout Shift Prevention**: Uses the Inter typeface with native `tabular-nums` support to ensure timer digits never flicker or shift horizontally.

## 2. Task Management (Single-Task Focus)
- **Task Shelf**: A slide-up drawer for managing your to-do list without distracting from the timer.
- **Boutique Creation**: Sleek task input with DM Sans typography and a project-level tagging system.
- **Tactile Stepper**: A custom-built stepper for assigning estimated sessions (1-20) to each task.
- **Active Task Tracking**: The main screen displays your current focus task and your progress (via "Flow Dots") toward your estimate.
- **Auto-Advancement**: Mark a task complete to hear a celebratory sound and automatically switch to the next uncompleted task in your list.

## 3. Award-Winning Visuals & UX
- **NSPanel Popup**: A true native menu bar behavior—appearing over all other apps, avoiding Space switching, and closing automatically when clicking outside.
- **Dynamic Blob Background**: Organic, moving gradients that shift color based on your session type (Focus Red, Short Break Green, Long Break Blue).
- **Visual Breath Sync**: During breaks, the background blobs subtly expand and contract in a 4-7-8 breathing rhythm to aid relaxation.
- **Film Grain Texture**: A subtle SVG noise overlay provides a high-fidelity, tactile "analogue" feel to the interface.
- **Sound Effects**: Custom-recorded "Click" and "Tink" sounds for button interactions and session completion.

## 4. Analytics & Reporting
- **Persistence**: All focus time is logged per minute and persisted to a **Native SQLite Database**. It survives system restarts and app updates.
- **Focus Activity**: Bar charts visualizing your productivity across days.
- **Project Mix**: A boutique breakdown showing exactly which project tags consumed your time, with filtering for tagged vs. general focus.
- **Granular Table**: A high-fidelity breakdown of every task, its project, and the exact time spent focusing, grouped by date (Today, Yesterday, etc.).
- **Performance Variance**: Real-time tracking of whether you are "ahead" or "over" your estimated sessions for each task.
- **CSV Export**: One-click export of all historical data to a CSV file.
- **Consistency Tracking**: Real-time streak calculation and "Total Sessions" stats.

## 5. System Integration & Settings
- **Native Notifications**: Engaging macOS system notifications with custom messages for each session type.
- **Menu Bar Progress**: The remaining time is mirrored directly in your macOS menu bar for "glanceable" tracking.
- **One-Click Tray Control**: Right-click the tray icon for quick actions (Start/Pause, Skip, Reset, Quit) without opening the window.
- **Auto-Pilot Mode**: Configurable settings to auto-start focus sessions and breaks for a hands-off experience.
- **Customizable Durations**: Fine-tune Focus, Short Break, and Long Break lengths down to the minute.
- **Native macOS Logic**: Built as a hybrid Swift + React app to ensure genuine Apple-style window management and performance.
