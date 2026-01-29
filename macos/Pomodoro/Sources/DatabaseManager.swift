import Foundation
import GRDB

/**
 * High-performance persistence layer using SQLite and GRDB.
 * Handles schema migrations, relational integrity, and optimized reporting.
 */
class DatabaseManager {
    static let shared = DatabaseManager()
    
    var dbPool: DatabasePool!
    
    private init() {
        setupDatabase()
    }
    
    private func setupDatabase() {
        do {
            let fileManager = FileManager.default
            let appSupportURL = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            let dbFolderURL = appSupportURL.appendingPathComponent("com.saranshbarua.pomodoro", isDirectory: true)
            
            if !fileManager.fileExists(atPath: dbFolderURL.path) {
                try fileManager.createDirectory(at: dbFolderURL, withIntermediateDirectories: true)
            }
            
            let dbURL = dbFolderURL.appendingPathComponent("db.sqlite")
            print("DatabaseManager: Path -> \(dbURL.path)")
            
            dbPool = try DatabasePool(path: dbURL.path)
            
            try migrator.migrate(dbPool)
            
            // Perform legacy migration if needed
            migrateFromUserDefaults()
            
        } catch {
            print("DatabaseManager: Setup failed: \(error)")
        }
    }
    
    private var migrator: DatabaseMigrator {
        var migrator = DatabaseMigrator()
        
        migrator.registerMigration("v1") { db in
            // Tasks table
            try db.create(table: "tasks") { t in
                t.column("id", .text).primaryKey()
                t.column("title", .text).notNull()
                t.column("tag", .text)
                t.column("estimated_pomos", .integer).notNull().defaults(to: 1)
                t.column("completed_pomos", .integer).notNull().defaults(to: 0)
                t.column("is_completed", .boolean).notNull().defaults(to: false)
                t.column("created_at", .datetime).notNull()
            }
            
            // Session Logs table
            try db.create(table: "session_logs") { t in
                t.column("id", .text).primaryKey()
                t.column("task_id", .text).references("tasks", onDelete: .setNull)
                t.column("task_title", .text)
                t.column("tag", .text)
                t.column("duration_seconds", .integer).notNull()
                t.column("is_completion", .boolean).notNull().defaults(to: false)
                t.column("timestamp", .datetime).notNull()
            }
            
            // App Settings table
            try db.create(table: "app_settings") { t in
                t.column("key", .text).primaryKey()
                t.column("value", .text)
            }
            
            // Indexes
            try db.create(index: "idx_session_logs_timestamp", on: "session_logs", columns: ["timestamp"])
            try db.create(index: "idx_tasks_is_completed", on: "tasks", columns: ["is_completed"])
        }
        
        migrator.registerMigration("v2") { db in
            // 1. Create Projects table
            try db.create(table: "projects") { t in
                t.column("id", .text).primaryKey()
                t.column("name", .text).notNull()
                t.column("color_hex", .text)
                t.column("is_archived", .boolean).notNull().defaults(to: false)
                t.column("created_at", .datetime).notNull()
            }
            
            // 2. Enhance Tasks table
            // Note: SQLite doesn't support easy column modification, so we handle existing data carefully
            try db.alter(table: "tasks") { t in
                t.add(column: "project_id", .text).references("projects", onDelete: .setNull)
                t.add(column: "status", .integer).notNull().defaults(to: 0) // 0: Active, 1: Completed, 2: Archived
            }
            
            // Migrate existing is_completed to status
            try db.execute(sql: "UPDATE tasks SET status = 1 WHERE is_completed = 1")
            
            // 3. Enhance Session Logs table
            try db.alter(table: "session_logs") { t in
                t.add(column: "project_id", .text).references("projects", onDelete: .setNull)
                t.add(column: "timezone_offset", .integer).notNull().defaults(to: 0)
            }
            
            // 4. Create optimized reporting index
            try db.create(index: "idx_logs_reporting_v2", on: "session_logs", columns: ["timestamp", "project_id", "duration_seconds"])
        }
        
        migrator.registerMigration("v3") { db in
            // Add estimated_pomos to session_logs to snapshot estimates
            try db.alter(table: "session_logs") { t in
                t.add(column: "estimated_pomos", .integer).notNull().defaults(to: 1)
            }
        }
        
        migrator.registerMigration("v4") { db in
            // Add snapshot_focus_duration to session_logs to handle variable pomo lengths
            try db.alter(table: "session_logs") { t in
                t.add(column: "snapshot_focus_duration", .integer).notNull().defaults(to: 1500) // Default to 25 mins
            }
        }
        
        return migrator
    }
    
    /**
     * One-time migration from legacy UserDefaults JSON storage.
     */
    private func migrateFromUserDefaults() {
        let key = "pomodoroState"
        let migrationFlag = "is_migrated_to_sqlite_v1"
        
        if UserDefaults.standard.bool(forKey: migrationFlag) { return }
        
        guard let stateString = UserDefaults.standard.string(forKey: key),
              let data = stateString.data(using: .utf8) else {
            return
        }
        
        print("DatabaseManager: Starting legacy migration...")
        
        do {
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                try dbPool.write { db in
                    // Migrate Tasks
                    if let tasksData = json["tasks"] as? [String: Any],
                       let tasksArray = tasksData["tasks"] as? [[String: Any]] {
                        for taskJson in tasksArray {
                            let createdAtMs = taskJson["createdAt"] as? Double ?? Date().timeIntervalSince1970 * 1000.0
                            let createdAt = createdAtMs / 1000.0
                            
                            let id = taskJson["id"] as? String ?? UUID().uuidString
                            let title = taskJson["title"] as? String ?? "Untitled"
                            let tag = taskJson["tag"] as? String
                            let est = taskJson["estimatedPomos"] as? Int ?? 1
                            let comp = taskJson["completedPomos"] as? Int ?? 0
                            let isComp = taskJson["isCompleted"] as? Bool ?? false
                            
                            try db.execute(sql: """
                                INSERT OR IGNORE INTO tasks (id, title, tag, estimated_pomos, completed_pomos, is_completed, created_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                                """, arguments: [
                                    id, title, tag, est, comp, isComp, Date(timeIntervalSince1970: createdAt)
                                ])
                        }
                    }
                    
                    // Migrate Stats (Session Logs)
                    if let statsData = json["stats"] as? [String: Any],
                       let logsArray = statsData["logs"] as? [[String: Any]] {
                        for logJson in logsArray {
                            let timestampMs = logJson["timestamp"] as? Double ?? Date().timeIntervalSince1970 * 1000.0
                            let timestamp = timestampMs / 1000.0
                            
                            let id = logJson["id"] as? String ?? UUID().uuidString
                            let taskId = logJson["taskId"] as? String
                            let taskTitle = logJson["taskTitle"] as? String
                            let tag = logJson["tag"] as? String
                            let duration = logJson["durationSeconds"] as? Int ?? 0
                            let isComp = logJson["isCompletion"] as? Bool ?? false
                            
                            try db.execute(sql: """
                                INSERT OR IGNORE INTO session_logs (id, task_id, task_title, tag, duration_seconds, is_completion, timestamp)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                                """, arguments: [
                                    id, taskId, taskTitle, tag, duration, isComp, Date(timeIntervalSince1970: timestamp)
                                ])
                        }
                    }
                }
                
                UserDefaults.standard.set(true, forKey: migrationFlag)
                print("DatabaseManager: Legacy migration completed successfully.")
            }
        } catch {
            print("DatabaseManager: Legacy migration failed: \(error)")
        }
    }
}
