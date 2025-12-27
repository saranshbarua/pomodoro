import AppKit
import UserNotifications

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusBarController: StatusBarController?
    var windowController: WindowController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        windowController = WindowController()
        statusBarController = StatusBarController(windowController: windowController!)
        windowController?.statusBarController = statusBarController
        NSApp.setActivationPolicy(.accessory)
        
        setupHotKeys()
        
        // Safety check to prevent the "bundleProxyForCurrentProcess is nil" crash
        // This occurs if the binary is run directly instead of as a .app bundle
        if Bundle.main.bundleIdentifier != nil {
            requestNotificationPermission()
        } else {
            print("AppDelegate: Running outside of a proper .app bundle. Notifications disabled to prevent crash.")
        }
    }
    
    private func setupHotKeys() {
        // Option + Shift + P
        // keyCode: 35 (P)
        // modifiers: optionKey (0x0800) | shiftKey (0x0200) = 0x0A00
        HotKeyManager.shared.register(id: 1, keyCode: 35, modifiers: 0x0A00) { [weak self] in
            guard let self = self,
                  let windowController = self.windowController,
                  let statusBarController = self.statusBarController else { return }
            
            // Check if global hotkey is enabled in settings
            if self.isHotKeyEnabled() {
                let rect = statusBarController.getAnchorRect()
                windowController.toggle(relativeTo: rect)
            }
        }
    }
    
    private func isHotKeyEnabled() -> Bool {
        guard let stateString = UserDefaults.standard.string(forKey: "pomodoroState"),
              let data = stateString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return false
        }
        
        var enabled = false
        if let pomodoro = json["pomodoro"] as? [String: Any],
           let config = pomodoro["config"] as? [String: Any],
           let val = config["globalHotKeyEnabled"] as? Bool {
            enabled = val
        } else if let config = json["config"] as? [String: Any],
                  let val = config["globalHotKeyEnabled"] as? Bool {
            enabled = val
        }
        
        print("AppDelegate: Global Hotkey enabled: \(enabled)")
        return enabled
    }
    
    private func requestNotificationPermission() {
        let center = UNUserNotificationCenter.current()
        // Check current authorization status first
        center.getNotificationSettings { settings in
            if settings.authorizationStatus == .notDetermined {
                center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
                    if granted {
                        print("AppDelegate: Notification permission granted.")
                    } else if let error = error {
                        print("AppDelegate: Notification permission error: \(error.localizedDescription)")
                    } else {
                        print("AppDelegate: Notification permission denied.")
                    }
                }
            } else {
                print("AppDelegate: Notification status: \(settings.authorizationStatus.rawValue)")
            }
        }
    }
}
 
