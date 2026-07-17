import XCTest
import GRDB
@testable import FlumenCore
import FlumenIPC

final class AppRepositoryTests: XCTestCase {
    private var dbPool: DatabasePool!
    private var repository: AppRepository!

    override func setUpWithError() throws {
        let path = NSTemporaryDirectory().appending("flumen-test-\(UUID().uuidString).sqlite")
        dbPool = try DatabasePool(path: path)
        try DatabaseManager.migrator.migrate(dbPool)
        let manager = try DatabaseManager(dbPool: dbPool)
        repository = AppRepository(database: manager)
    }

    func testAddAndListTasks() throws {
        try repository.addTask(id: "t1", title: "Ship MCP", tag: nil, projectId: nil, estimatedPomos: 2)
        let tasks = try repository.listTasks()
        XCTAssertEqual(tasks.count, 1)
        XCTAssertEqual(tasks[0]["title"] as? String, "Ship MCP")
        XCTAssertEqual(tasks[0]["revision"] as? Int, 1)
    }

    func testUpdateTaskRejectsStaleRevision() throws {
        try repository.addTask(id: "t1", title: "Ship MCP", tag: nil, projectId: nil, estimatedPomos: 2)
        _ = try repository.updateTask(id: "t1", title: "Ship MCP v2", tag: nil, projectId: nil, estimatedPomos: 3, expectedRevision: 1)
        do {
            _ = try repository.updateTask(id: "t1", title: "Stale", tag: nil, projectId: nil, estimatedPomos: 1, expectedRevision: 1)
            XCTFail("Expected revision conflict")
        } catch let error as IPCStructuredError {
            XCTAssertEqual(error.code, "revision_conflict")
        }
    }

    func testAdHocLogIsNotCompletion() throws {
        let activity = try repository.logActivity(
            duration: 600,
            taskId: nil,
            taskTitle: "Design review",
            tag: nil,
            projectId: nil,
            estimatedPomos: 1,
            snapshotFocusDuration: 1500,
            isCompletion: true,
            source: "manual",
            durationOrigin: "user_supplied"
        )
        XCTAssertEqual(activity["isCompletion"] as? Bool, false)
        XCTAssertEqual(activity["source"] as? String, "manual")
        XCTAssertEqual(activity["durationSeconds"] as? Int, 600)
    }

    func testIdempotentLogReturnsSameActivity() throws {
        let first = try repository.logActivity(
            duration: 300,
            taskId: nil,
            taskTitle: "Quick fix",
            tag: nil,
            projectId: nil,
            estimatedPomos: 1,
            snapshotFocusDuration: 1500,
            isCompletion: false,
            source: "agent",
            durationOrigin: "user_supplied",
            sourceClient: "cursor",
            idempotencyKey: "key-1"
        )
        let second = try repository.logActivity(
            duration: 300,
            taskId: nil,
            taskTitle: "Quick fix",
            tag: nil,
            projectId: nil,
            estimatedPomos: 1,
            snapshotFocusDuration: 1500,
            isCompletion: false,
            source: "agent",
            durationOrigin: "user_supplied",
            sourceClient: "cursor",
            idempotencyKey: "key-1"
        )
        XCTAssertEqual(first["id"] as? String, second["id"] as? String)
    }

    func testCorrectTimeEntryKeepsRevisionHistory() throws {
        let activity = try repository.logActivity(
            duration: 900,
            taskId: nil,
            taskTitle: "Meeting",
            tag: nil,
            projectId: nil,
            estimatedPomos: 1,
            snapshotFocusDuration: 1500,
            isCompletion: false,
            source: "manual",
            durationOrigin: "user_supplied"
        )
        let id = activity["id"] as! String
        let corrected = try repository.correctTimeEntry(
            id: id,
            expectedRevision: 1,
            duration: 1200,
            timestamp: nil,
            title: "Design meeting",
            projectId: nil,
            reason: "Forgot break",
            sourceClient: "manual"
        )
        XCTAssertEqual(corrected["durationSeconds"] as? Int, 1200)
        XCTAssertEqual(corrected["revision"] as? Int, 2)
        XCTAssertEqual(corrected["taskTitle"] as? String, "Design meeting")
    }

    func testRejectsFarFutureActivity() throws {
        let future = Date().addingTimeInterval(3600)
        do {
            _ = try repository.logActivity(
                duration: 600,
                taskId: nil,
                taskTitle: "Future work",
                tag: nil,
                projectId: nil,
                estimatedPomos: 1,
                snapshotFocusDuration: 1500,
                isCompletion: false,
                timestamp: future,
                source: "agent",
                durationOrigin: "user_supplied"
            )
            XCTFail("Expected future validation failure")
        } catch let error as IPCStructuredError {
            XCTAssertEqual(error.code, "validation_error")
            XCTAssertTrue(error.message.lowercased().contains("future"))
        }
    }

    func testQueryActivityFiltersBySource() throws {
        _ = try repository.logActivity(
            duration: 300,
            taskId: nil,
            taskTitle: "Timer session",
            tag: nil,
            projectId: nil,
            estimatedPomos: 1,
            snapshotFocusDuration: 1500,
            isCompletion: true,
            timestamp: Date().addingTimeInterval(-3600),
            source: "timer",
            durationOrigin: "observed"
        )
        _ = try repository.logActivity(
            duration: 300,
            taskId: nil,
            taskTitle: "Agent session",
            tag: nil,
            projectId: nil,
            estimatedPomos: 1,
            snapshotFocusDuration: 1500,
            isCompletion: false,
            timestamp: Date().addingTimeInterval(-1800),
            source: "agent",
            durationOrigin: "user_supplied",
            sourceClient: "cursor"
        )
        let start = Date().addingTimeInterval(-7200)
        let end = Date().addingTimeInterval(60)
        let agentOnly = try repository.queryActivity(start: start, end: end, source: "agent")
        XCTAssertEqual(agentOnly.count, 1)
        XCTAssertEqual(agentOnly[0]["taskTitle"] as? String, "Agent session")
    }
}
