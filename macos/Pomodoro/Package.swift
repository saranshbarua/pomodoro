// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Pomodoro",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "Pomodoro", targets: ["Pomodoro"])
    ],
    dependencies: [
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.6.4"),
        .package(url: "https://github.com/groue/GRDB.swift", from: "6.24.2")
    ],
    targets: [
        .executableTarget(
            name: "Pomodoro",
            dependencies: [
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "GRDB", package: "GRDB.swift")
            ],
            path: "Sources",
            resources: [
                .copy("dist"), .process("click.mp3")
            ]
        )
    ]
)
 
