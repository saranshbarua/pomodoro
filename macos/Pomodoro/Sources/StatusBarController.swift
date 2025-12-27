import AppKit

class StatusBarController {
    private var statusBar: NSStatusBar
    private var statusItem: NSStatusItem
    private var windowController: WindowController

    init(windowController: WindowController) {
        self.windowController = windowController
        self.statusBar = NSStatusBar.system
        self.statusItem = statusBar.statusItem(withLength: NSStatusItem.variableLength)
        
        setupButton()
    }

    private func setupButton() {
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "timer", accessibilityDescription: "Pomodoro")
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

    func updateTitle(_ title: String) {
        DispatchQueue.main.async { [weak self] in
            self?.statusItem.button?.title = title
        }
    }
}
 
