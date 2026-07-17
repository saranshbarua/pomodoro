// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Flumen",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "Flumen", targets: ["Flumen"]),
        .executable(name: "flumen-mcp", targets: ["FlumenMCP"]),
        .library(name: "FlumenIPC", targets: ["FlumenIPC"])
    ],
    dependencies: [
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.6.4"),
        .package(url: "https://github.com/groue/GRDB.swift", from: "6.24.2"),
        .package(url: "https://github.com/modelcontextprotocol/swift-sdk.git", exact: "0.12.1")
    ],
    targets: [
        .target(
            name: "FlumenIPC",
            path: "IPC"
        ),
        .target(
            name: "FlumenCore",
            dependencies: [
                "FlumenIPC",
                .product(name: "GRDB", package: "GRDB.swift")
            ],
            path: "AppCore"
        ),
        .executableTarget(
            name: "Flumen",
            dependencies: [
                "FlumenIPC",
                "FlumenCore",
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "GRDB", package: "GRDB.swift")
            ],
            path: "Sources",
            exclude: ["AppIcon.icns"],
            resources: [
                .copy("dist"), .process("click.mp3")
            ],
            // AppKit/WKWebView UI remains on Swift 5 concurrency until fully audited.
            // IPC/Core/MCP targets use Swift 6.
            swiftSettings: [
                .swiftLanguageMode(.v5)
            ]
        ),
        .executableTarget(
            name: "FlumenMCP",
            dependencies: [
                "FlumenIPC",
                .product(name: "MCP", package: "swift-sdk")
            ],
            path: "MCP",
            exclude: ["Resources"]
        ),
        .testTarget(
            name: "FlumenTests",
            dependencies: [
                "FlumenIPC",
                "FlumenCore",
                .product(name: "GRDB", package: "GRDB.swift")
            ],
            path: "Tests"
        )
    ]
)
 
