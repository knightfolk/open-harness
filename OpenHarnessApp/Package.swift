// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OpenHarnessApp",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "OpenHarnessApp", targets: ["OpenHarnessApp"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-crypto.git", from: "3.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "OpenHarnessApp",
            dependencies: [
                .product(name: "Crypto", package: "swift-crypto"),
            ],
            swiftSettings: [
                .unsafeFlags(["-parse-as-library"]),
            ]
        ),
    ]
)
