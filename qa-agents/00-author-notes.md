# Author notes: SpyneThetaSDK unit tests

Branch: `feature/unit-tests-core-logic` (created from main, nothing committed or pushed). The vendored xcframework is untouched.

## Files

| File | Purpose |
|---|---|
| `package.json` | `npm test` -> `node tests/integrity/run-all.mjs`; no dependencies |
| `tests/integrity/lib.mjs` | helpers: plist parser, Mach-O/FAT + load-command parser, header parser, snapshot builder/differ (not a test) |
| `tests/integrity/run-all.mjs` | runner that passes explicit `*.test.mjs` paths to `node --test` |
| `tests/integrity/package-manifest.test.mjs` | Package.swift wiring + SPM source observations (13 tests) |
| `tests/integrity/xcframework-structure.test.mjs` | root plist vs disk, per-slice layout, plists, modulemaps, dSYM (about 40) |
| `tests/integrity/binaries.test.mjs` | Mach-O magic/arch/platform/minos/install-name per slice (about 30) |
| `tests/integrity/header-api.test.mjs` | header sanity, API snapshot diff, required capabilities (about 30) |
| `tests/integrity/upstream-version.test.mjs` | tries to find upstream theta-client version (5) |
| `tests/integrity/api-snapshot.json` + `update-snapshot.mjs` | committed API snapshot (266 interfaces, 37 protocols, 0 NS_ENUM, 2 categories) and generator |
| `Tests/THETAClientTests/{KotlinEnum,ValueType,ExceptionType,HttpHelper,ApiSurface}Tests.swift` | XCTest smoke tests |
| `Package.swift` | only change: added `.testTarget(THETAClientTests)` |
| `.github/workflows/unit-tests.yml` | jobs `integrity` and `swift-smoke` |

Deviation from the brief: `npm test` runs `run-all.mjs` instead of literal `node --test tests/integrity`. On Node 22 (local) a directory argument is treated as a glob and fails with MODULE_NOT_FOUND; on Node 20 it recurses and would execute `update-snapshot.mjs` as a test. The runner passes explicit files and works on both; both scripts also exit early under `NODE_TEST_CONTEXT` so a directory sweep cannot rewrite the snapshot.

## Counts

- Node: 112 leaf tests (15 suites). Local run (Node 22.19): 111 pass, 1 fail. The one failure is an intended-behaviour assertion exposing a packaging defect (Finding 1).
- Swift: 78 XCTest methods (Enum 30, ValueType 22, HttpHelper 11, ExceptionType 8, ApiSurface 7). Not compiled or run (Windows).

## Findings (packaging)

1. DEFECT (test fails by design): `Sources/THETAClient/THETAClient.xcframework/ios-arm64_x86_64-simulator/THETAClient.framework/Info.plist:17-19` has `CFBundleSupportedPlatforms = [iPhoneOS]`. A simulator framework should declare `iPhoneSimulator` (the binary's LC_BUILD_VERSION correctly says platform 7, simulator). Can cause App Store/validation or embed warnings. Test: `INTENDED: CFBundleSupportedPlatforms matches the slice`.
2. Inconsistency (observation, not failing): module maps differ; device slice has `use Foundation` (`ios-arm64/.../module.modulemap:7`), simulator does not. Device slice plist also has `UIRequiredDeviceCapabilities` (line 30), simulator does not. Suggests two different build pipelines.
3. Observation: simulator arm64 sub-slice has minos 14.0, x86_64 and device have 12.0 (Mach-O LC_BUILD_VERSION). All are at or below the package's iOS 16 floor, so tests only assert `<= 16`. Framework plist says `MinimumOSVersion 12.0` for both.
4. Observation: `Sources/THETAClientSPM/ThetaClientSPM.swift` is not byte-empty (109 bytes) but contains only a header comment, and that comment says `SpyneAutomobileSPM` (copy/paste leftover, line 2-3). The test asserts "no code", named OBSERVATION.
5. Observation: `Package.swift` has a commented-out `unsafeFlags` block (lines 21-26 originally). Asserted not active.
6. Upstream version: NOT DETERMINABLE. No semver string in header, plists or binary strings. The simulator slice embeds only the source path `theta-client/kotlin-multiplatform/src/iosMain/kotlin`; the device slice has no theta-client path string at all (also a sign the two slices were built/stripped differently). Framework plist version is the default 1.0 / build 1. No version was invented; the API snapshot is the substitute upgrade detector.
7. No credential-looking strings were seen or printed. Header/plist checks only count PEM/AKIA patterns (zero).

## Coverage map

- Package.swift: tools 6.2, iOS 16, product, target deps, binaryTarget path exists and name matches, no active unsafeFlags, no remote deps.
- xcframework root plist: slice list == directories, per-slice LibraryPath/BinaryPath/DebugSymbolsPath/platform/variant/architectures.
- Per slice: Headers, modulemap (`framework module THETAClient`, umbrella `THETAClient.h`), framework plist (bundle id `com.ricoh360.thetaclient.THETAClient`, executable, min OS), dSYM, no stray files, headers byte-identical.
- Binaries: valid Mach-O/FAT parse, arch set equals plist, simulator has arm64+x86_64, device arm64 only, dylib filetype, install name `@rpath/...`, LC_BUILD_VERSION platform ios vs ios-simulator, minos <= 16, segments, size floors, not duplicates of each other.
- Header: all `@interface` lines parse, floor >= 250, no duplicate class/protocol, THETAC prefix, superclass chain closed, forward `@class`/`@protocol` all defined, balanced pragmas/`@end`, swift_name coverage, snapshot diff (readable +/-/~ lines), required classes/protocols (repository, config, options, all 10 capture builders, state/info/files/file info, exposure enums, exceptions, DigestAuth, EventWebSocket), `ThetaRepository` selectors (getPhotoCaptureBuilder, getOptions/setOptions, listFiles, getLivePreview, ...), companion `doNewInstance`.
- Swift: Kotlin enum invariants for 14 enums, IsoEnum value/ordinal/companion get(value:)/compareTo, ThetaModel companion, value types (Timeout, GpsInfo, BracketSetting(+List), OffDelay/SleepDelay, BitrateNumber, Proxy, Config, TopBottomCorrectionRotation, Kotlin boxes), exceptions, `BaseHttpClient.URL`, `DigestAuth`, Platform/Greeting, symbol linkage and Options holder.

## Impossible without a camera or device

Everything under `ThetaRepository.companion.doNewInstance` (suspend, opens HTTP to 192.168.1.1), capture builders `build()`/`takePicture`/`startCapture`, `getOptions/setOptions`, `listFiles`, live preview, `EventWebSocket` connect, `MultipartPostClient`, plugin/firmware/reset calls. They require a THETA on its Wi-Fi AP (or a mock HTTP server, out of scope here). Behaviour that depends on camera model quirks (option support per model, digest challenge from real firmware) is likewise untestable. Binary behaviour on real arm64 hardware (dyld load with the real device slice) is only validated structurally (Mach-O load commands), not executed.

## Risks

- CI toolchain: `swift-tools-version: 6.2` needs Xcode 26.x. Workflow uses `macos-26`; if that label is not available to the org, change to `macos-15` (Xcode 26.x installed side by side; workflow selects newest `Xcode_26*`). If no Xcode 26 exists the job fails fast with a clear error.
- Scheme name: workflow prefers `THETAClientPackage-Package` (all targets incl. tests) and falls back to `THETAClientPackage`. `xcodebuild -list` output is uploaded on failure.
- Test target dependencies: `["THETAClientSPM", "THETAClient"]` (direct binary dep added so `import THETAClient` resolves). `THETAClientSPM` has no code; if SwiftPM complains about an empty Swift target, a stub file will be required (Package/source change, not made).
- Test target uses `.swiftLanguageMode(.v5)` to avoid Swift 6 strict-concurrency noise from Kotlin/Native generated types.
- Simulator/xctest loading of a dynamic binary framework without a host app: normally SwiftPM embeds it; if the test bundle cannot load the framework the whole Swift job fails at launch, not per test.
- Node 20 on CI vs Node 22 local: runner is version-agnostic; verified only on 22.
- The Node job will be RED because of Finding 1. That is intentional (intended-behaviour assertion). Fix the plist or mark it expected-fail; do not weaken the test.

## Swift assertions by confidence (executor: check these first if red)

High (derived from header declarations): all enum invariants, counts (IsoEnum 23, LanguageEnum 9, ThetaModel 8, FileTypeEnum 3, TopBottomCorrectionOptionEnum 7), initialisers, property accessors, `doCopy`, exception message round trips and hierarchy, `get(value:)` round trip.

Medium (inferred from upstream Kotlin source behaviour, not the header):
- `IsoEnum.name` equals the camelCase member ignoring case/underscores (`testIsoEnum_nameMatchesCaseIgnoringSeparators`).
- `IsoEnum.companion.get(value: -1)` and unknown values return nil.
- `ThetaModel.companion.isBeforeThetaV` (S true; Z1, X false); `get(model:serialNumber:)` nil for unknown or nil model.
- `BaseHttpClient.URL` parsing: host/path/port with default 80; `DEFAULT_PORT == 80`.
- `DigestAuth`: username-only gives password `""`; nil password gives `""`; header starts with `Digest `, contains `username="..."`, `realm="..."`, `uri="..."`; differs by method.
- `BitrateNumber(value:).rawValue == "4096"`; `BitrateNumber.companion.get(str:)` nil for non-numeric.
- `GpsInfo.isDisabled()` false for a real fix.
- `Platform().platform` has prefix `iOS`; `Greeting().greeting()` non-empty.
- `Bundle(for: ThetaRepository.self).bundleIdentifier == com.ricoh360.thetaclient.THETAClient`.
Any failure in the Medium group is a test-assumption candidate, not necessarily a binary defect; check upstream (ricoh360/theta-client) source before blaming the packaging.

## What the executor must verify on macOS

1. `swift package describe` and `xcodebuild -list` succeed; scheme names as above.
2. Package builds with the new test target (empty `THETAClientSPM` target OK, `import THETAClient` resolves in tests).
3. Swift compile of every test: generated Swift names (`ThetaRepository.IsoEnum`, `PhotoCapture.Builder`, `KotlinInt(int:)`, `compareTo(other:)`, `ThetaRepository.OffDelaySec.sec_`, etc.) were taken from the header's `swift_name` attributes but never compiled.
4. Run on a simulator (arm64 Apple-silicon runner exercises the arm64-simulator sub-slice; x86_64 is not exercised).
5. Confirm Finding 1 with `plutil -p` and optionally `vtool -show-build` / `lipo -info` / `xcrun xcodebuild -checkFirstLaunchStatus` cross-checks of the Node Mach-O parser output.
6. Optionally run `xcodebuild -create-xcframework`-style validation or `xcrun altool`-less checks; not required.
