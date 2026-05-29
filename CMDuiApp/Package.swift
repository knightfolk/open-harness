// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CMDuiApp",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "CMDuiApp", targets: ["CMDuiApp"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-crypto.git", from: "3.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "CMDuiApp",
            dependencies: [
                .product(name: "Crypto", package: "swift-crypto"),
            ],
            resources: [
                .copy("Resources"),
            ],
            swiftSettings: [
                .unsafeFlags(["-parse-as-library"]),
            ]
        ),
    ]
)
