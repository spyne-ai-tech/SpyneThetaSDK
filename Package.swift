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
        )
    ]
)
