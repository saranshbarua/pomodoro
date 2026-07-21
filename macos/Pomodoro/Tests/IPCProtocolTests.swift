import XCTest
import FlumenIPC

final class IPCProtocolTests: XCTestCase {
    func testRoundTripRequest() throws {
        let request = IPCRequest(
            requestId: "req-1",
            idempotencyKey: "idem-1",
            client: IPCClientMetadata(id: "c1", name: "cursor", version: "1.0"),
            operation: "get_focus_status",
            parameters: ["limit": .number(10)]
        )
        let encoded = try IPCCodec.encode(request)
        let decoded = try IPCCodec.decode(IPCRequest.self, from: encoded)
        XCTAssertEqual(decoded.requestId, "req-1")
        XCTAssertEqual(decoded.operation, "get_focus_status")
        XCTAssertEqual(decoded.parameters["limit"]?.intValue, 10)
        XCTAssertEqual(decoded.client.name, "cursor")
    }

    func testSocketPathUsesApplicationSupport() {
        let path = FlumenSocketPath.path(bundleIdentifier: "com.saranshbarua.flumen")
        XCTAssertTrue(path.contains("Application Support") || path.contains("com.saranshbarua.flumen"))
        XCTAssertTrue(path.hasSuffix("agent.sock"))
    }
}
