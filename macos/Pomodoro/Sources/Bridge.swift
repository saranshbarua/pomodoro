import WebKit
import UserNotifications
import AudioToolbox
import GRDB

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
            
        // --- Database Actions ---
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
                    isCompletion: body["isCompletion"] as? Bool ?? false
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
    
    // MARK: - Database Implementation
    
    private func loadInitialData() {
        do {
            try DatabaseManager.shared.dbPool.read { db in
                let tasks = try Row.fetchAll(db, sql: "SELECT * FROM tasks WHERE status < 2 ORDER BY created_at ASC")
                let tasksList: [[String: Any]] = tasks.map { row in
                    var dict: [String: Any] = [:]
                    dict["id"] = row["id"] as String
                    dict["title"] = row["title"] as String
                    dict["tag"] = row["tag"] as String?
                    dict["projectId"] = row["project_id"] as String?
                    dict["estimatedPomos"] = row["estimated_pomos"] as Int
                    dict["completedPomos"] = row["completed_pomos"] as Int
                    dict["status"] = row["status"] as Int
                    dict["isCompleted"] = (row["status"] as Int) == 1
                    
                    if let date = row["created_at"] as Date? {
                        dict["createdAt"] = date.timeIntervalSince1970 * 1000
                    }
                    return dict
                }
                
                let projects = try Row.fetchAll(db, sql: "SELECT * FROM projects WHERE is_archived = 0")
                let projectList: [[String: Any]] = projects.map { row in
                    return [
                        "id": row["id"] as String,
                        "name": row["name"] as String,
                        "color": row["color_hex"] as String?
                    ]
                }
                
                sendToJS(action: "db_initialData", data: ["tasks": tasksList, "projects": projectList])
            }
        } catch {
            print("Bridge: db_loadInitialData failed: \(error)")
        }
    }
    
    private func addTask(id: String, title: String, tag: String?, projectId: String?, estimatedPomos: Int) {
        do {
            try DatabaseManager.shared.dbPool.write { db in
                try db.execute(sql: """
                    INSERT INTO tasks (id, title, tag, project_id, estimated_pomos, completed_pomos, status, created_at)
                    VALUES (?, ?, ?, ?, ?, 0, 0, ?)
                    """, arguments: [id, title, tag, projectId, estimatedPomos, Date()])
            }
        } catch {
            print("Bridge: db_addTask failed: \(error)")
        }
    }
    
    private func updateTaskStatus(id: String, status: Int) {
        do {
            try DatabaseManager.shared.dbPool.write { db in
                try db.execute(sql: "UPDATE tasks SET status = ? WHERE id = ?", arguments: [status, id])
            }
        } catch {
            print("Bridge: db_updateTaskStatus failed: \(error)")
        }
    }
    
    private func deleteTask(id: String) {
        do {
            try DatabaseManager.shared.dbPool.write { db in
                // Expert Tip: We use status = 2 (Archived) instead of deleting to preserve history
                try db.execute(sql: "UPDATE tasks SET status = 2 WHERE id = ?", arguments: [id])
            }
        } catch {
            print("Bridge: db_deleteTask failed: \(error)")
        }
    }
    
    private func incrementTaskPomos(id: String) {
        do {
            try DatabaseManager.shared.dbPool.write { db in
                try db.execute(sql: "UPDATE tasks SET completed_pomos = completed_pomos + 1 WHERE id = ?", arguments: [id])
            }
        } catch {
            print("Bridge: db_incrementPomos failed: \(error)")
        }
    }
    
    private func logActivity(duration: Int, taskId: String?, taskTitle: String?, tag: String?, projectId: String?, isCompletion: Bool) {
        do {
            let offset = TimeZone.current.secondsFromGMT() / 60
            
            // Clean up optional strings to ensure actual SQL NULLs
            let cleanTaskId = (taskId == "nil" || taskId?.isEmpty == true) ? nil : taskId
            let cleanProjectId = (projectId == "nil" || projectId?.isEmpty == true) ? nil : projectId
            let cleanTaskTitle = (taskTitle == "nil" || taskTitle?.isEmpty == true) ? nil : taskTitle
            let cleanTag = (tag == "nil" || tag?.isEmpty == true) ? nil : tag

            try DatabaseManager.shared.dbPool.write { db in
                try db.execute(sql: """
                    INSERT INTO session_logs (id, task_id, task_title, tag, project_id, duration_seconds, is_completion, timestamp, timezone_offset)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, arguments: [UUID().uuidString, cleanTaskId, cleanTaskTitle, cleanTag, cleanProjectId, duration, isCompletion, Date(), offset])
            }
        } catch {
            print("Bridge: db_logActivity failed: \(error)")
        }
    }
    
    private func getProjects() {
        do {
            try DatabaseManager.shared.dbPool.read { db in
                let rows = try Row.fetchAll(db, sql: "SELECT * FROM projects WHERE is_archived = 0")
                let projects = rows.map { row in
                    return ["id": row["id"] as String, "name": row["name"] as String, "color": row["color_hex"] as String?]
                }
                sendToJS(action: "db_projectsData", data: ["projects": projects])
            }
        } catch {
            print("Bridge: db_getProjects failed: \(error)")
        }
    }
    
    private func upsertProject(id: String?, name: String, color: String?) {
        do {
            try DatabaseManager.shared.dbPool.write { db in
                let projectId = id ?? UUID().uuidString
                try db.execute(sql: """
                    INSERT INTO projects (id, name, color_hex, is_archived, created_at)
                    VALUES (?, ?, ?, 0, ?)
                    ON CONFLICT(id) DO UPDATE SET name=excluded.name, color_hex=excluded.color_hex
                    """, arguments: [projectId, name, color, Date()])
            }
        } catch {
            print("Bridge: db_upsertProject failed: \(error)")
        }
    }
    
    private func getReports() {
        do {
            try DatabaseManager.shared.dbPool.read { db in
                // Expert Fix: Use Timezone Offset for accurate daily bars
                let dailyRows = try Row.fetchAll(db, sql: """
                    SELECT DATE(timestamp, '+' || timezone_offset || ' minutes') as date, 
                           SUM(duration_seconds) / 3600.0 as hours
                    FROM session_logs
                    WHERE timestamp >= DATETIME('now', '-7 days')
                    GROUP BY date
                    ORDER BY date ASC
                    """)
                
                // Project Distribution (Using Projects table for accurate names)
                let projectRows = try Row.fetchAll(db, sql: """
                    SELECT COALESCE(p.name, l.tag, 'Untagged') as name, 
                           SUM(l.duration_seconds) / 3600.0 as value
                    FROM session_logs l
                    LEFT JOIN projects p ON l.project_id = p.id
                    GROUP BY name
                    ORDER BY value DESC
                    """)
                
                // Task Breakdown
                let taskRows = try Row.fetchAll(db, sql: """
                    SELECT COALESCE(l.task_title, t.title, 'Unselected Activity') as title, 
                           COALESCE(p.name, l.tag, 'Untagged') as tag, 
                           SUM(l.duration_seconds) as duration
                    FROM session_logs l
                    LEFT JOIN tasks t ON l.task_id = t.id
                    LEFT JOIN projects p ON l.project_id = p.id
                    GROUP BY title, tag
                    ORDER BY duration DESC
                    """)

                let dailyStats: [[String: Any]] = dailyRows.map { row in
                    return ["date": row["date"] as String, "hours": row["hours"] as Double]
                }
                
                let projectDist: [[String: Any]] = projectRows.map { row in
                    return ["name": row["name"] as String, "value": row["value"] as Double]
                }
                
                // Total Focus Time
                let totalTimeRow = try Row.fetchOne(db, sql: "SELECT SUM(duration_seconds) as total FROM session_logs")
                let totalTime = totalTimeRow?["total"] as Int? ?? 0
                
                // Total Sessions
                let totalSessionsRow = try Row.fetchOne(db, sql: "SELECT COUNT(*) as count FROM session_logs WHERE is_completion = 1")
                let totalSessions = totalSessionsRow?["count"] as Int? ?? 0

                let taskBreakdown: [[String: Any]] = taskRows.map { row in
                    return [
                        "title": row["title"] as String,
                        "tag": row["tag"] as String,
                        "duration": row["duration"] as Int
                    ]
                }
                
                // Streak Calculation (Using timezone corrected dates)
                let dateRows = try Row.fetchAll(db, sql: "SELECT DISTINCT DATE(timestamp, '+' || timezone_offset || ' minutes') as d FROM session_logs ORDER BY d DESC")
                let uniqueDates = dateRows.map { $0["d"] as String }
                
                var reportsData: [String: Any] = [:]
                reportsData["dailyStats"] = dailyStats
                reportsData["projectDistribution"] = projectDist
                reportsData["totalFocusTime"] = totalTime
                reportsData["totalSessions"] = totalSessions
                reportsData["taskBreakdown"] = taskBreakdown
                reportsData["streak"] = calculateStreak(uniqueDates)
                
                sendToJS(action: "db_reportsData", data: reportsData)
            }
        } catch {
            print("Bridge: db_getReports failed: \(error)")
        }
    }
    
    private func calculateStreak(_ dates: [String]) -> Int {
        guard !dates.isEmpty else { return 0 }
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        
        var streak = 0
        var current = Date()
        
        // Normalize current date to midnight for comparison
        let calendar = Calendar.current
        var currentComponents = calendar.dateComponents([.year, .month, .day], from: current)
        currentComponents.hour = 0
        currentComponents.minute = 0
        currentComponents.second = 0
        current = calendar.date(from: currentComponents)!
        
        for dateString in dates {
            guard let date = formatter.date(from: dateString) else { continue }
            
            let diff = calendar.dateComponents([.day], from: date, to: current).day ?? 0
            
            if diff <= 1 {
                streak += 1
                current = date
            } else {
                break
            }
        }
        
        return streak
    }
}

