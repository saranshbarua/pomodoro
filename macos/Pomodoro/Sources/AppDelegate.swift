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
        
        // Safety check to prevent the "bundleProxyForCurrentProcess is nil" crash
        // This occurs if the binary is run directly instead of as a .app bundle
        if Bundle.main.bundleIdentifier != nil {
            requestNotificationPermission()
        } else {
            print("AppDelegate: Running outside of a proper .app bundle. Notifications disabled to prevent crash.")
        }
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
 
