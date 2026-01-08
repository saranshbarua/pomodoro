import AppKit
import UserNotifications
import Sparkle

class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate, SPUUpdaterDelegate {
    var statusBarController: StatusBarController?
    var windowController: WindowController?
    var updaterController: SPUStandardUpdaterController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Initialize Sparkle Updater
        updaterController = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: self, userDriverDelegate: nil)
        
        windowController = WindowController()
        statusBarController = StatusBarController(windowController: windowController!)
        windowController?.statusBarController = statusBarController
        NSApp.setActivationPolicy(.accessory)
        
        setupMainMenu()
        setupHotKeys()
        
        // Safety check to prevent the "bundleProxyForCurrentProcess is nil" crash
        if Bundle.main.bundleIdentifier != nil {
            // Fix for notifications not showing banners
            UNUserNotificationCenter.current().delegate = self
            requestNotificationPermission()
        } else {
            print("AppDelegate: Running outside of a proper .app bundle. Notifications disabled to prevent crash.")
        }
    }
    
    // Explicitly allow banners even when the app is active
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .list])
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        completionHandler()
    }
    
    private func setupMainMenu() {
        let mainMenu = NSMenu()
        
        // Application Menu
        let appMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        appMenuItem.submenu = appMenu
        
        appMenu.addItem(withTitle: "About Pomodoro", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Check for Updates...", action: #selector(SPUStandardUpdaterController.checkForUpdates(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Pomodoro", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        mainMenu.addItem(appMenuItem)
        
        // Edit Menu (Essential for Copy/Paste)
        let editMenu = NSMenu(title: "Edit")
        let editMenuItem = NSMenuItem()
        editMenuItem.submenu = editMenu
        
        editMenu.addItem(withTitle: "Undo", action: #selector(UndoManager.undo), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: #selector(UndoManager.redo), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        
        mainMenu.addItem(editMenuItem)
        
        NSApp.mainMenu = mainMenu
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

    // Sparkle Delegate: Ensure the app can terminate and relaunch correctly
    func updaterWillRelaunchApplication(_ updater: SPUUpdater) {
        // Optional: Perform any cleanup before relaunch
        print("AppDelegate: Updater will relaunch application...")
    }

    func updaterShouldRelaunchApplication(_ updater: SPUUpdater) -> Bool {
        return true
    }
}
 
