// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "THETAClientPackage",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "THETAClientPackage",
            targets: ["THETAClientSPM"]
        )
    ],
    dependencies: [
        
    ],
    targets: [
        .target(
            name: "THETAClientSPM",
            dependencies: [
                "THETAClient",
                
            ],
//            swiftSettings: [
//                .unsafeFlags([
//                    "-enable-library-evolution",
//                    "-emit-module-interface"
//                ]),
//            ]
        ),
        .binaryTarget(
            name: "THETAClient",
            path: "Sources/THETAClient/THETAClient.xcframework"
        ),
        // Camera-independent smoke tests of the generated Objective-C/Kotlin API (no network, no camera).
        .testTarget(
            name: "THETAClientTests",
            dependencies: [
                "THETAClientSPM",
                // Direct dependency so `import THETAClient` resolves the binary framework's module.
                "THETAClient",
            ],
            // Tests live in lowercase tests/ (SwiftPM defaults to Tests/); explicit so it also resolves on case-sensitive volumes.
            path: "tests/THETAClientTests",
            // The Kotlin/Native generated API predates Swift 6 strict concurrency; keep tests in Swift 5 mode.
            swiftSettings: [.swiftLanguageMode(.v5)]
        )
    ]
)
