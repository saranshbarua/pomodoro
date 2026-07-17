import WebKit
import UserNotifications
import AudioToolbox
import AppKit
import UniformTypeIdentifiers
import FlumenCore

class Bridge: NSObject, WKScriptMessageHandler {
    weak var windowController: WindowController?
    private let repository = AppRepository()

    init(windowController: WindowController) {
        self.windowController = windowController
        super.init()
        AgentAccessCoordinator.shared.attach(bridge: self)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            print("Bridge: Invalid message format received")
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.handleAction(action, body: body)
        }
    }

    private func handleAction(_ action: String, body: [String: Any]) {
        print("Bridge: Received action '\(action)'")
        if AgentAccessCoordinator.shared.handleBridgeAction(action, body: body) {
            return
        }

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
                UserDefaults.standard.synchronize()
            }
        case "loadState":
            let state = UserDefaults.standard.string(forKey: "pomodoroState") ?? ""
            sendToJS(action: "loadedState", data: ["state": state])

        case "db_loadInitialData":
            loadInitialData()
        case "db_addTask":
            if let id = body["id"] as? String,
               let title = body["title"] as? String,
               let estimatedPomos = body["estimatedPomos"] as? Int {
                addTask(
                    id: id,
                    title: title,
                    tag: body["tag"] as? String,
                    projectId: body["projectId"] as? String,
                    estimatedPomos: estimatedPomos
                )
            }
        case "db_updateTaskStatus":
            if let id = body["id"] as? String, let status = body["status"] as? Int {
                updateTaskStatus(id: id, status: status)
            }
        case "db_deleteTask":
            if let id = body["id"] as? String {
                deleteTask(id: id)
            }
        case "db_clearCompletedTasks":
            clearCompletedTasks()
        case "db_updateTask":
            if let id = body["id"] as? String,
               let title = body["title"] as? String,
               let estimatedPomos = body["estimatedPomos"] as? Int {
                updateTask(
                    id: id,
                    title: title,
                    tag: body["tag"] as? String,
                    projectId: body["projectId"] as? String,
                    estimatedPomos: estimatedPomos
                )
            }
        case "db_incrementPomos":
            if let id = body["id"] as? String {
                incrementTaskPomos(id: id)
            }
        case "db_logActivity":
            if let duration = body["duration"] as? Int {
                logActivity(
                    duration: duration,
                    taskId: body["taskId"] as? String,
                    taskTitle: body["taskTitle"] as? String,
                    tag: body["tag"] as? String,
                    projectId: body["projectId"] as? String,
                    estimatedPomos: body["estimatedPomos"] as? Int ?? 1,
                    snapshotFocusDuration: body["snapshotFocusDuration"] as? Int ?? 1500,
                    isCompletion: body["isCompletion"] as? Bool ?? false,
                    provenance: body["provenance"] as? [String: Any]
                )
            }
        case "db_getProjects":
            getProjects()
        case "db_upsertProject":
            if let name = body["name"] as? String {
                upsertProject(id: body["id"] as? String, name: name, color: body["color"] as? String)
            }
        case "db_getReports":
            getReports()
        case "db_exportCSV":
            exportTaskBreakdownToCSV()

        case "hideWindow":
            windowController?.hide()
        case "forceHideWindow":
            windowController?.forceHide()
        case "quitApp":
            NSApplication.shared.terminate(nil)
        case "checkForUpdates":
            if let appDelegate = NSApp.delegate as? AppDelegate {
                appDelegate.updaterController?.checkForUpdates(nil)
            }

        case "setPinned":
            if let pinned = body["pinned"] as? Bool {
                windowController?.setPinned(pinned)
            }
        case "togglePinned":
            windowController?.togglePinned()
        case "getPinnedState":
            let isPinned = windowController?.isPinned ?? false
            sendToJS(action: "pinnedStateChanged", data: ["isPinned": isPinned])
        case "beginWindowDrag":
            windowController?.beginPinnedDrag()
        case "playClickSound":
            if let soundUrl = Bundle.main.url(forResource: "click", withExtension: "mp3") {
                NSSound(contentsOf: soundUrl, byReference: true)?.play()
            } else {
                NSSound(named: "Tink")?.play()
            }
        case "startTimerActivity":
            if let appDelegate = NSApp.delegate as? AppDelegate {
                appDelegate.startTimerActivity()
            }
        case "endTimerActivity":
            if let appDelegate = NSApp.delegate as? AppDelegate {
                appDelegate.endTimerActivity()
            }
        case "startNativeTimer":
            if let endTimeMs = body["endTime"] as? Double {
                let endTime = Date(timeIntervalSince1970: endTimeMs / 1000.0)
                windowController?.statusBarController?.startCountdown(endTime: endTime)
            }
        case "stopNativeTimer":
            windowController?.statusBarController?.stopCountdown()
        default:
            print("Bridge: Unknown action: \(action)")
        }
    }

    private func showNativeNotification(title: String, body: String) {
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
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Bridge: Error scheduling notification: \(error.localizedDescription)")
            }
        }
    }

    nonisolated func sendToJS(action: String, data: [String: Any]) {
        let payload: [String: Any] = ["action": action, "data": data]
        guard let json = try? JSONSerialization.data(withJSONObject: payload),
              let jsonString = String(data: json, encoding: .utf8) else {
            print("Bridge: Failed to serialize JS payload")
            return
        }

        let script = "if (window.receiveNativeMessage) { window.receiveNativeMessage(\(jsonString)); } else { console.warn('Bridge: receiveNativeMessage not ready for action: \(action)'); }"
        DispatchQueue.main.async { [weak self] in
            self?.windowController?.webView.evaluateJavaScript(script) { _, error in
                if let error = error {
                    print("Bridge: evaluateJavaScript error for \(action): \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - Database Implementation

    private func loadInitialData() {
        do {
            let data = try repository.loadInitialData()
            sendToJS(action: "db_initialData", data: data)
        } catch {
            print("Bridge: db_loadInitialData failed: \(error)")
        }
    }

    private func addTask(id: String, title: String, tag: String?, projectId: String?, estimatedPomos: Int) {
        do {
            try repository.addTask(id: id, title: title, tag: tag, projectId: projectId, estimatedPomos: estimatedPomos)
        } catch {
            print("Bridge: db_addTask failed: \(error)")
        }
    }

    private func updateTaskStatus(id: String, status: Int) {
        do {
            try repository.updateTaskStatus(id: id, status: status)
        } catch {
            print("Bridge: db_updateTaskStatus failed: \(error)")
        }
    }

    private func updateTask(id: String, title: String, tag: String?, projectId: String?, estimatedPomos: Int) {
        do {
            _ = try repository.updateTask(
                id: id,
                title: title,
                tag: tag,
                projectId: projectId,
                estimatedPomos: estimatedPomos
            )
        } catch {
            print("Bridge: db_updateTask failed: \(error)")
        }
    }

    private func deleteTask(id: String) {
        do {
            try repository.archiveTask(id: id)
        } catch {
            print("Bridge: db_deleteTask failed: \(error)")
        }
    }

    private func clearCompletedTasks() {
        do {
            try repository.clearCompletedTasks()
        } catch {
            print("Bridge: db_clearCompletedTasks failed: \(error)")
        }
    }

    private func incrementTaskPomos(id: String) {
        do {
            try repository.incrementTaskPomos(id: id)
        } catch {
            print("Bridge: db_incrementPomos failed: \(error)")
        }
    }

    private func logActivity(
        duration: Int,
        taskId: String?,
        taskTitle: String?,
        tag: String?,
        projectId: String?,
        estimatedPomos: Int,
        snapshotFocusDuration: Int,
        isCompletion: Bool,
        provenance: [String: Any]?
    ) {
        do {
            let source = provenance?["source"] as? String
                ?? provenance?["origin"] as? String
                ?? "timer"
            let durationOrigin = provenance?["durationOrigin"] as? String
                ?? provenance?["durationSource"] as? String
                ?? "observed"
            let timestamp: Date
            if let startedAt = provenance?["startedAt"] as? Double {
                timestamp = Date(timeIntervalSince1970: startedAt / 1000)
            } else if let startedAt = provenance?["startedAt"] as? Int {
                timestamp = Date(timeIntervalSince1970: Double(startedAt) / 1000)
            } else {
                timestamp = Date()
            }

            _ = try repository.logActivity(
                duration: duration,
                taskId: taskId,
                taskTitle: taskTitle,
                tag: tag,
                projectId: projectId,
                estimatedPomos: estimatedPomos,
                snapshotFocusDuration: snapshotFocusDuration,
                isCompletion: isCompletion,
                timestamp: timestamp,
                source: source,
                durationOrigin: durationOrigin,
                sourceClient: provenance?["sourceClient"] as? String,
                externalReference: provenance?["externalReference"] as? String,
                idempotencyKey: provenance?["idempotencyKey"] as? String
            )
        } catch {
            print("Bridge: db_logActivity failed: \(error)")
        }
    }

    private func getProjects() {
        do {
            let projects = try repository.listProjects()
            sendToJS(action: "db_projectsData", data: ["projects": projects])
        } catch {
            print("Bridge: db_getProjects failed: \(error)")
        }
    }

    private func upsertProject(id: String?, name: String, color: String?) {
        do {
            _ = try repository.upsertProject(id: id, name: name, color: color)
        } catch {
            print("Bridge: db_upsertProject failed: \(error)")
        }
    }

    private func getReports() {
        do {
            let reports = try repository.reports()
            sendToJS(action: "db_reportsData", data: reports)
        } catch {
            print("Bridge: db_getReports failed: \(error)")
        }
    }

    private func exportTaskBreakdownToCSV() {
        NSApp.activate(ignoringOtherApps: true)

        let savePanel = NSSavePanel()
        savePanel.allowedContentTypes = [.commaSeparatedText]
        savePanel.nameFieldStringValue = "Pomodoro_Task_Breakdown_\(Int(Date().timeIntervalSince1970)).csv"
        savePanel.title = "Export Task Breakdown"
        savePanel.message = "Choose where to save your task report"

        let result = savePanel.runModal()
        if result == .OK, let url = savePanel.url {
            generateAndSaveCSV(to: url)
        } else {
            sendToJS(action: "db_csvExportResult", data: ["success": false, "error": "User cancelled"])
        }
    }

    private func generateAndSaveCSV(to url: URL) {
        do {
            let rows = try repository.reportBreakdown()
            var csvString = "Date,Task,Project,Actual Time (Formatted),Actual Seconds,Estimated Pomos,Estimated Seconds (Snapshot),Variance (Seconds)\n"

            for row in rows {
                let date = row["date"] as? String ?? ""
                let title = row["title"] as? String ?? ""
                let tag = row["tag"] as? String ?? ""
                let duration = row["duration"] as? Int ?? 0
                let estimatedPomos = row["estimatedPomos"] as? Int ?? 1
                let avgSnapshotDuration = row["avgSnapshotDuration"] as? Double ?? 1500
                let estimatedSeconds = Int(Double(estimatedPomos) * avgSnapshotDuration)
                let variance = duration - estimatedSeconds

                let hours = duration / 3600
                let minutes = (duration % 3600) / 60
                let seconds = duration % 60
                let formatted = String(format: "%02d:%02d:%02d", hours, minutes, seconds)

                let escapedTitle = title.replacingOccurrences(of: "\"", with: "\"\"")
                let escapedTag = tag.replacingOccurrences(of: "\"", with: "\"\"")

                csvString += "\(date),\"\(escapedTitle)\",\"\(escapedTag)\",\"\(formatted)\",\(duration),\(estimatedPomos),\(estimatedSeconds),\(variance)\n"
            }

            try csvString.write(to: url, atomically: true, encoding: .utf8)
            DispatchQueue.main.async {
                self.sendToJS(action: "db_csvExportResult", data: ["success": true])
                self.showNativeNotification(title: "Export Successful", body: "Your task reports has been saved successfully")
            }
        } catch {
            print("Bridge: CSV Export failed: \(error)")
            DispatchQueue.main.async {
                self.sendToJS(action: "db_csvExportResult", data: ["success": false, "error": error.localizedDescription])
            }
        }
    }
}
