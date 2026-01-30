import AppKit
import WebKit

class PomodoroPanel: NSPanel {
    override var canBecomeKey: Bool {
        return true
    }
    override var canBecomeMain: Bool {
        return true
    }
    
    // Explicitly handle standard edit shortcuts to ensure they work in the WKWebView
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        if event.modifierFlags.contains(.command) {
            let key = event.charactersIgnoringModifiers?.lowercased()
            switch key {
            case "x":
                if NSApp.sendAction(#selector(NSText.cut(_:)), to: nil, from: self) { return true }
            case "c":
                if NSApp.sendAction(#selector(NSText.copy(_:)), to: nil, from: self) { return true }
            case "v":
                if NSApp.sendAction(#selector(NSText.paste(_:)), to: nil, from: self) { return true }
            case "a":
                if NSApp.sendAction(#selector(NSText.selectAll(_:)), to: nil, from: self) { return true }
            case "z":
                if event.modifierFlags.contains(.shift) {
                    if NSApp.sendAction(#selector(UndoManager.redo), to: nil, from: self) { return true }
                } else {
                    if NSApp.sendAction(#selector(UndoManager.undo), to: nil, from: self) { return true }
                }
            default:
                break
            }
        }
        return super.performKeyEquivalent(with: event)
    }
}

class WindowController: NSWindowController {
    var panel: NSPanel!
    var webView: WKWebView!
    var bridge: Bridge!
    weak var statusBarController: StatusBarController?
    private var eventMonitor: Any?
    
    /// Pin state - when true, the window stays visible even when clicking outside
    private(set) var isPinned: Bool = false {
        didSet {
            updatePinnedState()
        }
    }

    init() {
        // Use PomodoroPanel to allow it to become key (necessary for text input)
        let panel = PomodoroPanel(
            contentRect: NSRect(x: 0, y: 0, width: 340, height: 520),
            styleMask: [.nonactivatingPanel, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        
        self.panel = panel
        super.init(window: panel)
        
        // Restore pinned state from UserDefaults
        isPinned = UserDefaults.standard.bool(forKey: "windowPinned")
        
        setupPanel()
        setupWebView()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupPanel() {
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = true
        panel.level = .statusBar
        panel.hidesOnDeactivate = false
        
        // Apply initial collection behavior based on pinned state
        updatePanelCollectionBehavior()
        
        // Native border radius enforcement
        if let contentView = panel.contentView {
            contentView.wantsLayer = true
            contentView.layer?.cornerRadius = 28
            contentView.layer?.masksToBounds = true
        }
        
        // Remove window background completely
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.isMovableByWindowBackground = true
    }
    
    private func updatePanelCollectionBehavior() {
        if isPinned {
            // When pinned: stay visible across spaces, don't hide, float above other windows
            panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
            panel.level = .floating
        } else {
            // When unpinned: transient behavior (default menu bar app style)
            panel.collectionBehavior = [.moveToActiveSpace, .transient, .ignoresCycle]
            panel.level = .statusBar
        }
    }
    
    private func updatePinnedState() {
        // Update panel behavior
        updatePanelCollectionBehavior()
        
        // Persist the state
        UserDefaults.standard.set(isPinned, forKey: "windowPinned")
        UserDefaults.standard.synchronize()
        
        // Update event monitoring
        if isPinned {
            stopMonitoring()
        } else if panel.isVisible {
            startMonitoring()
        }
        
        // Notify JS about the state change
        bridge?.sendToJS(action: "pinnedStateChanged", data: ["isPinned": isPinned])
        
        print("WindowController: Pinned state changed to \(isPinned)")
    }
    
    /// Sets the pinned state
    func setPinned(_ pinned: Bool) {
        isPinned = pinned
    }
    
    /// Toggles the pinned state
    func togglePinned() {
        isPinned.toggle()
    }

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        bridge = Bridge(windowController: self)
        config.userContentController.add(bridge, name: "native")
        
        // Register custom scheme handler to fix CORS issues with local files
        config.setURLSchemeHandler(AppSchemeHandler(), forURLScheme: "app")
        
        // Use a safer configuration
        let preferences = WKPreferences()
        preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.preferences = preferences
        
        webView = WKWebView(frame: panel.contentView!.bounds, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        webView.autoresizingMask = [.width, .height]
        
        panel.contentView?.addSubview(webView)
        
        // Improved Dev Mode detection:
        // 1. Check if we're running in Xcode (no bundle identifier)
        // 2. Or if DEBUG flag is explicitly set
        let isRunningInXcode = Bundle.main.bundleIdentifier == nil
        
        #if DEBUG
        let isDebug = true
        #else
        let isDebug = false
        #endif

        if isRunningInXcode || isDebug {
            if let url = URL(string: "http://localhost:5173") {
                print("WindowController: [DEV MODE] Loading from localhost:5173")
                let request = URLRequest(url: url)
                webView.load(request)
                return
            }
        }
        
        // Production mode fallback
        print("WindowController: [PROD MODE] Loading from app://localhost/index.html")
        let version = Int(Date().timeIntervalSince1970)
        if let url = URL(string: "app://localhost/index.html?v=\(version)") {
            webView.load(URLRequest(url: url))
        }
    }

    func show(relativeTo rect: NSRect) {
        panel.alphaValue = 1.0
        // Only reposition if not pinned (pinned windows keep their position)
        if !isPinned || !panel.isVisible {
            let x = rect.origin.x + (rect.width / 2) - (panel.frame.width / 2)
            let y = rect.origin.y - panel.frame.height - 5
            panel.setFrameOrigin(NSPoint(x: x, y: y))
        }
        
        panel.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        
        // Only start monitoring if not pinned
        if !isPinned {
            startMonitoring()
        }
        
        // Send current pinned state to JS
        bridge?.sendToJS(action: "pinnedStateChanged", data: ["isPinned": isPinned])
    }

    func hide() {
        // If pinned, don't actually hide - just lose focus
        if isPinned {
            return
        }
        
        // Expert Fix: If a timer is running, we don't want to fully 'orderOut' 
        // as macOS may aggressively throttle the WKWebView process.
        // Instead, we make it invisible but technically 'on-screen'.
        if let appDelegate = NSApp.delegate as? AppDelegate, 
           let pomodoroStore = UserDefaults.standard.string(forKey: "pomodoroState"),
           pomodoroStore.contains("\"status\":\"running\"") {
            panel.alphaValue = 0.0
            // We still want to stop monitoring clicks to avoid accidental triggers
            stopMonitoring()
            print("WindowController: Hiding via alphaValue to maintain WebView vitality")
        } else {
            panel.orderOut(nil)
            stopMonitoring()
        }
        
        bridge.sendToJS(action: "windowHidden", data: [:])
    }
    
    /// Force hide the window even if pinned (for explicit close actions)
    func forceHide() {
        if let appDelegate = NSApp.delegate as? AppDelegate, 
           let pomodoroStore = UserDefaults.standard.string(forKey: "pomodoroState"),
           pomodoroStore.contains("\"status\":\"running\"") {
            panel.alphaValue = 0.0
            print("WindowController: Force hiding via alphaValue to maintain WebView vitality")
        } else {
            panel.orderOut(nil)
            panel.alphaValue = 1.0 // Reset alpha
        }
        stopMonitoring()
        bridge.sendToJS(action: "windowHidden", data: [:])
    }
    
    func toggle(relativeTo rect: NSRect) {
        if panel.isVisible && panel.alphaValue > 0 {
            // If pinned, toggling should still hide the window
            if isPinned {
                forceHide()
            } else {
                hide()
            }
        } else {
            // Reset alpha if it was hidden via alpha
            panel.alphaValue = 1.0
            show(relativeTo: rect)
        }
    }

    private func startMonitoring() {
        // Don't monitor clicks if pinned
        guard !isPinned else { return }
        
        eventMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] event in
            guard let self = self else { return }
            
            // Don't hide if pinned
            if self.isPinned { return }
            
            // Check if the click is inside the panel
            let clickLocation = event.locationInWindow
            let panelFrame = self.panel.frame
            
            // Convert screen coordinates properly
            let clickScreenLocation = NSEvent.mouseLocation
            if !panelFrame.contains(clickScreenLocation) {
                self.hide()
            }
        }
        
        // Remove localEventMonitor for Space/Escape. 
        // These are now handled in React (App.tsx) to avoid interfering with text inputs.
    }

    private func stopMonitoring() {
        if let monitor = eventMonitor {
            NSEvent.removeMonitor(monitor)
            eventMonitor = nil
        }
    }
}
