import Foundation
import Logging
import MCP

/// Stdio transport that injects SEP-973 `serverInfo.icons` into initialize responses.
///
/// Swift MCP SDK 0.12.1's `Server` convenience initializer does not yet accept icons,
/// so this keeps Flumen branding on `initialize` without forking the SDK.
actor IconInjectingStdioTransport: Transport {
    nonisolated let logger: Logger
    private let inner: StdioTransport
    private let iconsJSON: [[String: Any]]

    init(logger: Logger, icons: [Icon] = FlumenMCPIcons.brand) {
        self.logger = logger
        self.inner = StdioTransport(logger: logger)
        self.iconsJSON = icons.map { icon in
            var object: [String: Any] = ["src": icon.src]
            if let mimeType = icon.mimeType {
                object["mimeType"] = mimeType
            }
            if let sizes = icon.sizes {
                object["sizes"] = sizes
            }
            if let theme = icon.theme {
                object["theme"] = theme.rawValue
            }
            return object
        }
    }

    func connect() async throws {
        try await inner.connect()
    }

    func disconnect() async {
        await inner.disconnect()
    }

    func send(_ data: Data) async throws {
        try await inner.send(augmentInitializeServerInfo(data))
    }

    func receive() -> AsyncThrowingStream<Data, any Error> {
        AsyncThrowingStream { continuation in
            Task {
                let stream = await self.inner.receive()
                do {
                    for try await message in stream {
                        continuation.yield(message)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    private func augmentInitializeServerInfo(_ data: Data) -> Data {
        guard var root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              root["error"] == nil,
              var result = root["result"] as? [String: Any],
              result["protocolVersion"] != nil,
              result["capabilities"] != nil,
              var serverInfo = result["serverInfo"] as? [String: Any],
              serverInfo["name"] != nil
        else {
            return data
        }

        if serverInfo["icons"] == nil {
            serverInfo["icons"] = iconsJSON
        }
        if serverInfo["websiteUrl"] == nil {
            serverInfo["websiteUrl"] = "https://saranshbarua.github.io/flumen/"
        }

        result["serverInfo"] = serverInfo
        root["result"] = result

        guard let encoded = try? JSONSerialization.data(
            withJSONObject: root,
            options: [.sortedKeys, .withoutEscapingSlashes]
        ) else {
            return data
        }
        return encoded
    }
}
