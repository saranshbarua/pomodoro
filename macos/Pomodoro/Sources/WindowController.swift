import AppKit
import WebKit

class WindowController: NSWindowController {
    var panel: NSPanel!
    var webView: WKWebView!
    var bridge: Bridge!
    weak var statusBarController: StatusBarController?
    private var eventMonitor: Any?

    init() {
        // Create the panel
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 340, height: 480),
            styleMask: [.nonactivatingPanel, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        
        self.panel = panel
        super.init(window: panel)
        
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
        panel.collectionBehavior = [.moveToActiveSpace, .transient, .ignoresCycle]
        panel.hidesOnDeactivate = false
        
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
        let x = rect.origin.x + (rect.width / 2) - (panel.frame.width / 2)
        let y = rect.origin.y - panel.frame.height - 5
        
        panel.setFrameOrigin(NSPoint(x: x, y: y))
        panel.makeKeyAndOrderFront(nil)
        
        startMonitoring()
    }

    func hide() {
        panel.orderOut(nil)
        stopMonitoring()
    }
    
    func toggle(relativeTo rect: NSRect) {
        if panel.isVisible {
            hide()
        } else {
            show(relativeTo: rect)
        }
    }

    private func startMonitoring() {
        eventMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
            self?.hide()
        }
    }

    private func stopMonitoring() {
        if let monitor = eventMonitor {
            NSEvent.removeMonitor(monitor)
            eventMonitor = nil
        }
    }
}
