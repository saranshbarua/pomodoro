import Foundation
import Darwin

public final class UnixSocketServer: @unchecked Sendable {
    public typealias Handler = @Sendable (IPCRequest) async -> IPCResponse

    public let path: String
    private let handler: Handler
    private let acceptQueue = DispatchQueue(label: "com.flumen.ipc.accept", qos: .userInitiated)
    private let connectionQueue = DispatchQueue(label: "com.flumen.ipc.connections", qos: .userInitiated, attributes: .concurrent)
    private let lock = NSLock()
    private var listener: Int32 = -1
    private var clients: Set<Int32> = []
    private var running = false

    public init(path: String, handler: @escaping Handler) {
        self.path = path
        self.handler = handler
    }

    public func start() throws {
        lock.lock()
        defer { lock.unlock() }
        guard !running else { return }

        let directory = URL(fileURLWithPath: path).deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
        unlink(path)

        let fd = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard fd >= 0 else { throw socketError("create listener") }
        do {
            try configure(fd)
            var address = try makeAddress(path)
            let result = withUnsafePointer(to: &address) {
                $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                    Darwin.bind(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
                }
            }
            guard result == 0 else { throw socketError("bind") }
            guard Darwin.listen(fd, 8) == 0 else { throw socketError("listen") }
            guard chmod(path, 0o600) == 0 else { throw socketError("secure socket") }
        } catch {
            Darwin.close(fd)
            unlink(path)
            throw error
        }

        listener = fd
        running = true
        acceptQueue.async { [weak self] in self?.acceptLoop(fd) }
    }

    public func stop() {
        lock.lock()
        guard running else { lock.unlock(); return }
        running = false
        let listener = self.listener
        self.listener = -1
        let clients = self.clients
        self.clients.removeAll()
        lock.unlock()

        if listener >= 0 {
            shutdown(listener, SHUT_RDWR)
            Darwin.close(listener)
        }
        for client in clients {
            shutdown(client, SHUT_RDWR)
            Darwin.close(client)
        }
        unlink(path)
    }

    deinit { stop() }

    private func acceptLoop(_ fd: Int32) {
        while isRunning {
            let client = Darwin.accept(fd, nil, nil)
            if client < 0 {
                if errno == EINTR { continue }
                if isRunning { usleep(20_000) }
                continue
            }

            var peerUID: uid_t = 0
            var peerGID: gid_t = 0
            guard getpeereid(client, &peerUID, &peerGID) == 0, peerUID == geteuid() else {
                Darwin.close(client)
                continue
            }
            try? configure(client)
            lock.lock()
            clients.insert(client)
            lock.unlock()
            connectionQueue.async { [weak self] in self?.serve(client) }
        }
    }

    private func serve(_ fd: Int32) {
        defer {
            lock.lock()
            clients.remove(fd)
            lock.unlock()
            Darwin.close(fd)
        }

        var buffer = Data()
        while isRunning {
            do {
                guard let line = try readLine(fd: fd, buffer: &buffer) else { return }
                let request: IPCRequest
                do {
                    request = try IPCCodec.decode(IPCRequest.self, from: line)
                } catch {
                    let response = IPCResponse(
                        requestId: "unknown",
                        error: IPCStructuredError(code: "invalid_request", message: "Malformed IPC request: \(error.localizedDescription)")
                    )
                    try writeAll(IPCCodec.encode(response), fd: fd)
                    continue
                }
                guard request.version == FlumenIPC.protocolVersion else {
                    try writeAll(IPCCodec.encode(IPCResponse(
                        requestId: request.requestId,
                        error: IPCStructuredError(
                            code: "unsupported_version",
                            message: "Unsupported IPC version \(request.version). Expected \(FlumenIPC.protocolVersion)."
                        )
                    )), fd: fd)
                    continue
                }

                let semaphore = DispatchSemaphore(value: 0)
                let box = ResponseBox()
                Task {
                    let value = await handler(request)
                    box.value = value
                    semaphore.signal()
                }
                semaphore.wait()
                try writeAll(IPCCodec.encode(box.value!), fd: fd)
            } catch {
                return
            }
        }
    }

    private var isRunning: Bool {
        lock.lock()
        defer { lock.unlock() }
        return running
    }
}

public final class UnixSocketClient: @unchecked Sendable {
    public let path: String
    public let metadata: IPCClientMetadata
    public let timeout: TimeInterval

    public init(path: String, metadata: IPCClientMetadata, timeout: TimeInterval = FlumenIPC.defaultTimeout) {
        self.path = path
        self.metadata = metadata
        self.timeout = timeout
    }

    public func send(
        operation: String,
        parameters: [String: JSONValue] = [:],
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        let request = IPCRequest(
            idempotencyKey: idempotencyKey,
            client: metadata,
            operation: operation,
            parameters: parameters
        )
        return try await send(request)
    }

    public func send(_ request: IPCRequest) async throws -> JSONValue {
        try await Task.detached(priority: .userInitiated) { [path, timeout] in
            var lastError: Error?
            for attempt in 0..<2 {
                if attempt > 0 { try await Task.sleep(nanoseconds: 100_000_000) }
                do {
                    return try Self.sendOnce(request, path: path, timeout: timeout)
                } catch {
                    lastError = error
                }
            }
            if let error = lastError as? IPCStructuredError { throw error }
            throw IPCStructuredError(
                code: "app_unavailable",
                message: "Flumen is not available. Open Flumen on this Mac, turn on Agent Access, and try again.",
                details: ["socketPath": .string(path)],
                retryable: true
            )
        }.value
    }

    private static func sendOnce(_ request: IPCRequest, path: String, timeout: TimeInterval) throws -> JSONValue {
        let fd = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard fd >= 0 else { throw socketError("create client") }
        defer { Darwin.close(fd) }
        try configure(fd, timeout: timeout)
        var address = try makeAddress(path)
        let connected = withUnsafePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.connect(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        guard connected == 0 else { throw socketError("connect") }

        try writeAll(IPCCodec.encode(request), fd: fd)
        var buffer = Data()
        guard let line = try readLine(fd: fd, buffer: &buffer) else {
            throw IPCStructuredError(code: "connection_closed", message: "Flumen closed the IPC connection.", retryable: true)
        }
        let response = try IPCCodec.decode(IPCResponse.self, from: line)
        guard response.requestId == request.requestId else {
            throw IPCStructuredError(code: "response_mismatch", message: "Flumen returned a mismatched response.")
        }
        if let error = response.error { throw error }
        return response.result ?? .null
    }
}

private final class ResponseBox: @unchecked Sendable {
    var value: IPCResponse?
}

private func makeAddress(_ path: String) throws -> sockaddr_un {
    guard path.utf8.count < MemoryLayout.size(ofValue: sockaddr_un().sun_path) else {
        throw IPCStructuredError(code: "socket_path_too_long", message: "Unix socket path is too long.")
    }
    var address = sockaddr_un()
    address.sun_family = sa_family_t(AF_UNIX)
    let maxLength = MemoryLayout.size(ofValue: address.sun_path)
    path.withCString { source in
        withUnsafeMutablePointer(to: &address) { addressPointer in
            let sunPath = UnsafeMutableRawPointer(addressPointer)
                .advanced(by: MemoryLayout<sockaddr_un>.offset(of: \.sun_path)!)
                .assumingMemoryBound(to: CChar.self)
            _ = strlcpy(sunPath, source, maxLength)
        }
    }
    return address
}

private func configure(_ fd: Int32, timeout: TimeInterval? = nil) throws {
    var noSigPipe: Int32 = 1
    guard setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &noSigPipe, socklen_t(MemoryLayout<Int32>.size)) == 0 else {
        throw socketError("configure socket")
    }
    if let timeout {
        var value = timeval(
            tv_sec: Int(timeout),
            tv_usec: Int32((timeout - floor(timeout)) * 1_000_000)
        )
        _ = setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &value, socklen_t(MemoryLayout<timeval>.size))
        _ = setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &value, socklen_t(MemoryLayout<timeval>.size))
    }
}

private func readLine(fd: Int32, buffer: inout Data) throws -> Data? {
    while true {
        if let newline = buffer.firstIndex(of: 0x0A) {
            let line = Data(buffer[...newline])
            buffer.removeSubrange(...newline)
            return line
        }
        guard buffer.count < FlumenIPC.maximumMessageBytes else {
            throw IPCStructuredError(code: "message_too_large", message: "IPC message exceeds the 1 MiB limit.")
        }
        var chunk = [UInt8](repeating: 0, count: 4096)
        let count = Darwin.recv(fd, &chunk, chunk.count, 0)
        if count == 0 { return nil }
        if count < 0 {
            if errno == EINTR { continue }
            throw socketError("read")
        }
        buffer.append(contentsOf: chunk.prefix(count))
    }
}

private func writeAll(_ data: Data, fd: Int32) throws {
    try data.withUnsafeBytes { bytes in
        guard var base = bytes.baseAddress else { return }
        var remaining = bytes.count
        while remaining > 0 {
            let sent = Darwin.send(fd, base, remaining, 0)
            if sent < 0 {
                if errno == EINTR { continue }
                throw socketError("write")
            }
            remaining -= sent
            base = base.advanced(by: sent)
        }
    }
}

private func socketError(_ action: String) -> IPCStructuredError {
    IPCStructuredError(
        code: "ipc_failure",
        message: "Unable to \(action): \(String(cString: strerror(errno))).",
        retryable: true
    )
}
