// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Flumen",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "Flumen", targets: ["Flumen"])
    ],
    dependencies: [
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.6.4"),
        .package(url: "https://github.com/groue/GRDB.swift", from: "6.24.2")
    ],
    targets: [
        .executableTarget(
            name: "Flumen",
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
 
