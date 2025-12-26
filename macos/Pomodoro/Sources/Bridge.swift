import WebKit
import UserNotifications
import AudioToolbox

class Bridge: NSObject, WKScriptMessageHandler {
    weak var windowController: WindowController?

    init(windowController: WindowController) {
        self.windowController = windowController
        super.init()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            print("Bridge: Invalid message format received")
            return
        }

        // Run on main thread as many of these actions interact with UI or WebView
        DispatchQueue.main.async { [weak self] in
            self?.handleAction(action, body: body)
        }
    }
    
    private func handleAction(_ action: String, body: [String: Any]) {
        switch action {
        case "updateMenuBar":
            if let title = body["title"] as? String {
                windowController?.statusBarController?.updateTitle(title)
            }
            
        case "showNotification":
            let title = body["title"] as? String ?? ""
            let content = body["body"] as? String ?? ""
            showNativeNotification(title: title, body: content)
            
        case "saveState":
            if let state = body["state"] as? String {
                UserDefaults.standard.set(state, forKey: "pomodoroState")
                UserDefaults.standard.synchronize() // Force immediate write
            }
        case "loadState":
            let state = UserDefaults.standard.string(forKey: "pomodoroState") ?? ""
            sendToJS(action: "loadedState", data: ["state": state])
        case "hideWindow":
            windowController?.hide()
        case "quitApp":
            NSApplication.shared.terminate(nil)
        case "playClickSound":
            print("Bridge: Playing click sound...")
            if let soundUrl = Bundle.main.url(forResource: "click", withExtension: "mp3") {
                NSSound(contentsOf: soundUrl, byReference: true)?.play()
            } else {
                // Fallback to system sound if custom asset is missing
                NSSound(named: "Tink")?.play()
            }
        default:
            print("Bridge: Unknown action: \(action)")
        }
    }

    private func showNativeNotification(title: String, body: String) {
        // Safety check to prevent crash if run outside of a bundle
        guard Bundle.main.bundleIdentifier != nil else {
            print("Bridge: Cannot show notification - no bundle identifier found (origin null error).")
            return
        }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil // Deliver immediately
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Bridge: Error scheduling notification: \(error.localizedDescription)")
            }
        }
    }

    func sendToJS(action: String, data: [String: Any]) {
        let payload: [String: Any] = ["action": action, "data": data]
        guard let json = try? JSONSerialization.data(withJSONObject: payload),
              let jsonString = String(data: json, encoding: .utf8) else {
            print("Bridge: Failed to serialize JS payload")
            return
        }
        
        let script = "window.receiveNativeMessage(\(jsonString))"
        windowController?.webView.evaluateJavaScript(script) { result, error in
            if let error = error {
                print("Bridge: evaluateJavaScript error: \(error.localizedDescription)")
            }
        }
    }
}
