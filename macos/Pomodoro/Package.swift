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
    dependencies: [],
    targets: [
        .executableTarget(
            name: "Pomodoro",
            dependencies: [],
            path: "Sources",
            resources: [
                .copy("dist"), .process("click.mp3")
            ]
        )
    ]
)
 
