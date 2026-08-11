import AppKit

class StatusBarController {
    private var statusBar: NSStatusBar
    private var statusItem: NSStatusItem
    private var windowController: WindowController
    private var nativeTimer: DispatchSourceTimer?
    private var flashTimer: DispatchSourceTimer?
    private var progressImages: [NSImage] = []
    private var currentProgressStep = 36
    private var completionSound: NSSound?
    private var lastCompletionSignalAt: TimeInterval?

    // One cached frame per drawable pixel: smooth enough for the menu bar,
    // with no per-tick image allocation.
    private static let progressSteps = 36

    init(windowController: WindowController) {
        self.windowController = windowController
        self.statusBar = NSStatusBar.system
        self.statusItem = statusBar.statusItem(withLength: NSStatusItem.variableLength)
        self.progressImages = Self.makeProgressImages()
        
        setupButton()
    }

    deinit {
        nativeTimer?.cancel()
        flashTimer?.cancel()
    }

    private func setupButton() {
        if let button = statusItem.button {
            button.image = progressImages[Self.progressSteps]
            button.imagePosition = .imageOnly
            button.title = ""
            button.toolTip = "Flumen — remaining progress"
            button.action = #selector(handleAction(_:))
            button.target = self
            // Support both left and right clicks
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }
    }

    @objc func handleAction(_ sender: Any?) {
        let event = NSApp.currentEvent
        
        if event?.type == .rightMouseUp {
            showContextMenu()
        } else {
            if let button = statusItem.button {
                let rect = button.window?.convertToScreen(button.frame) ?? .zero
                windowController.toggle(relativeTo: rect)
            }
        }
    }

    private func showContextMenu() {
        let menu = NSMenu()
        
        menu.addItem(NSMenuItem(title: "Start / Pause", action: #selector(menuStartPause), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "Skip", action: #selector(menuSkip), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "Reset", action: #selector(menuReset), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        
        // Pin/Unpin option
        let isPinned = windowController.isPinned
        let pinItem = NSMenuItem(
            title: isPinned ? "Unpin from Screen" : "Pin to Screen",
            action: #selector(menuTogglePin),
            keyEquivalent: "p"
        )
        pinItem.keyEquivalentModifierMask = [.command, .shift]
        menu.addItem(pinItem)
        
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "About Flumen", action: #selector(menuAbout), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "Check for Updates...", action: #selector(menuUpdate), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(menuQuit), keyEquivalent: "q"))
        
        for item in menu.items {
            item.target = self
        }
        
        statusItem.menu = menu
        statusItem.button?.performClick(nil) // Trigger the menu
        statusItem.menu = nil // Reset so next left click works as before
    }

    @objc func menuStartPause() {
        windowController.bridge.sendToJS(action: "menuAction", data: ["type": "toggle"])
    }

    @objc func menuSkip() {
        windowController.bridge.sendToJS(action: "menuAction", data: ["type": "skip"])
    }

    @objc func menuReset() {
        windowController.bridge.sendToJS(action: "menuAction", data: ["type": "reset"])
    }
    
    @objc func menuTogglePin() {
        windowController.togglePinned()
    }

    @objc func menuAbout() {
        NSApp.orderFrontStandardAboutPanel(nil)
    }

    @objc func menuUpdate() {
        if let appDelegate = NSApp.delegate as? AppDelegate {
            appDelegate.updaterController?.checkForUpdates(nil)
        }
    }

    @objc func menuQuit() {
        NSApplication.shared.terminate(nil)
    }

    @objc func toggleWindow(_ sender: Any?) {
        if let button = statusItem.button {
            let rect = button.window?.convertToScreen(button.frame) ?? .zero
            windowController.toggle(relativeTo: rect)
        }
    }
    
    func getAnchorRect() -> NSRect {
        if let button = statusItem.button {
            return button.window?.convertToScreen(button.frame) ?? .zero
        }
        return .zero
    }

    func update(title _: String, progress: Double? = nil) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.statusItem.button?.title = ""
            if let progress {
                self.setProgress(progress)
            }
        }
    }

    func startCountdown(endTime: Date, totalDuration: TimeInterval, soundEnabled: Bool) {
        stopCountdown()
        let safeDuration = max(1, totalDuration)
        
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now(), repeating: 1.0, leeway: .milliseconds(100))
        timer.setEventHandler { [weak self] in
            guard let self = self else { return }
            
            let now = Date()
            let remaining = endTime.timeIntervalSince(now)
            
            if remaining <= 0 {
                self.update(title: "", progress: 0)
                self.stopCountdown()
                self.signalCompletion(soundEnabled: soundEnabled)
                return
            }

            self.update(title: "", progress: remaining / safeDuration)
        }
        
        self.nativeTimer = timer
        timer.resume()
        print("StatusBarController: Started native countdown timer")
    }

    func stopCountdown() {
        if let timer = nativeTimer {
            timer.cancel()
            nativeTimer = nil
            print("StatusBarController: Stopped native countdown timer")
        }
    }

    private func setProgress(_ progress: Double) {
        let clamped = min(1, max(0, progress))
        let step = Int((clamped * Double(Self.progressSteps)).rounded())
        guard step != currentProgressStep || statusItem.button?.image == nil else { return }
        currentProgressStep = step
        statusItem.button?.image = progressImages[step]
    }

    func signalCompletion(soundEnabled: Bool) {
        let now = ProcessInfo.processInfo.systemUptime
        if let lastCompletionSignalAt, now - lastCompletionSignalAt < 2 {
            return
        }
        lastCompletionSignalAt = now

        if soundEnabled {
            if let soundURL = Bundle.main.url(forResource: "notification", withExtension: "mp3") {
                completionSound = NSSound(contentsOf: soundURL, byReference: true)
            } else {
                completionSound = NSSound(named: "Glass")
            }
            completionSound?.play()
        }

        flashTimer?.cancel()
        let startedAt = ProcessInfo.processInfo.systemUptime
        var isVisible = true
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now(), repeating: .milliseconds(500), leeway: .milliseconds(50))
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            if ProcessInfo.processInfo.systemUptime - startedAt >= 5 {
                timer.cancel()
                self.flashTimer = nil
                self.statusItem.button?.image = self.progressImages[self.currentProgressStep]
                return
            }
            isVisible.toggle()
            self.statusItem.button?.image = isVisible ? self.progressImages[self.currentProgressStep] : nil
        }
        flashTimer = timer
        timer.resume()
    }

    private static func makeProgressImages() -> [NSImage] {
        let imageSize = NSSize(width: 40, height: 18)
        let barRect = NSRect(x: 2, y: 6, width: 36, height: 6)
        let gradient = NSGradient(starting: .systemRed, ending: .systemGreen)

        return (0...progressSteps).map { step in
            let image = NSImage(size: imageSize, flipped: false) { _ in
                NSColor.gray.withAlphaComponent(0.25).setFill()
                NSBezierPath(roundedRect: barRect, xRadius: 3, yRadius: 3).fill()

                let fillWidth = barRect.width * CGFloat(step) / CGFloat(progressSteps)
                if fillWidth > 0 {
                    let fillRect = NSRect(x: barRect.minX, y: barRect.minY, width: fillWidth, height: barRect.height)
                    NSGraphicsContext.saveGraphicsState()
                    NSBezierPath(roundedRect: fillRect, xRadius: 3, yRadius: 3).addClip()
                    gradient?.draw(
                        from: NSPoint(x: barRect.minX, y: barRect.midY),
                        to: NSPoint(x: barRect.maxX, y: barRect.midY),
                        options: []
                    )
                    NSGraphicsContext.restoreGraphicsState()
                }
                return true
            }
            image.isTemplate = false
            return image
        }
    }
}
 
