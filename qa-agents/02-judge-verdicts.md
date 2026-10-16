# Judge verdicts: SpyneThetaSDK unit tests (branch feature/unit-tests-core-logic)

Scope: `tests/integrity/*`, `tests/THETAClientTests/*`, `Package.swift`, `.github/workflows/unit-tests.yml`, xcframework metadata.
Local `npm test` on the pristine copy: 112 tests, 111 pass, 1 skipped (Node 22.19, 1.4 s). Swift not runnable here; Swift judgement is by reading plus the executor's reported 78/78 green on macos-26 / Xcode 26.6.
Mutation testing ran on a copy outside the repo (no `.git`); the original working tree was not touched. Mutation harness: scratchpad `mut.mjs` (not committed).

## 1. Per-file verdict

| File | Strong | Weak / tautological | Verdict |
|---|---|---|---|
| `lib.mjs` | Hand-rolled plist and Mach-O parsers are exercised by every suite; mutations on plist, magic, cputype, LC_BUILD_VERSION and install name all landed. | The parsers are the oracle for 3 suites. A parser bug would pass everything silently (only cross-check is the executor's one-off `vtool/lipo` comparison, not a standing test). | Good |
| `package-manifest.test.mjs` (13) | Regex checks on active (comment-stripped) Package.swift: tools version, platforms, product, binaryTarget name/path, unsafeFlags, remote deps. All 9 Package.swift mutations that touch these were KILLED. | 2 tests are `assert.ok(true)` (unsafeFlags comment observation, SpyneAutomobileSPM comment observation) = tautological, diagnostics only. "tools version is 6.2" is a change detector, not a correctness check. Nothing checks the `.testTarget` (see survivors). | Good, 2 dead tests |
| `xcframework-structure.test.mjs` (~40) | Root plist vs disk both directions, per-slice paths, variant, architectures, bundle id, executable, min OS, dSYM, stray-file check, header byte-identity. 14 of 16 mutations KILLED. | Modulemap OBSERVATION test only checks both contain `framework module THETAClient` (differences are by design ignored). `export *` and any extra modulemap directive are not asserted (survived). `MinimumOSVersion === '12.0'` is pinned equal (drift detector, brittle across upgrades). The simulator `CFBundleSupportedPlatforms` test is an unconditional `skip`: it can never fail and never tells anyone when the defect is fixed (M22 survived: sim plist set to AppleTVOS). `CFBundleVersion` unpinned (M24). | Good, 3 gaps |
| `binaries.test.mjs` (~30) | Strongest file. Magic, fat/thin kind, cputype set vs plist, fat-vs-thin cputype agreement, filetype, install name, LC_BUILD_VERSION platform, minos, segments, size, swap/duplicate detection. 12 of 13 binary mutations KILLED. | No content integrity: a single flipped byte inside `__TEXT` passes (M33). "size > 5 MB" and "ncmds > 5" are loose floors. Does not parse symbols, code signature, or bitcode/strip status. | Good structurally, blind to content |
| `header-api.test.mjs` (~30) | Header sanity (parse, balance, dup names, forward decls), snapshot diff with readable output, required-class and required-selector lists tied to Spyne usage. Caught rename, removal, superclass change, added interface, added protocol, truncation, one-slice drift. | Snapshot covers only class name, superclass, category, protocol and NS_ENUM names: no methods, properties, nullability, types, enum cases. Real upstream upgrades mostly add or change members on existing classes, so it passes them (M41 method renamed, M42 property type changed both SURVIVED). Required-selector test only checks 15 selector names on the repository class. `swift_name` coverage allows up to 20 misses (loose). `>= 250` floor is loose vs the exact snapshot (fine, redundant). | Medium: catches coarse swaps, misses member drift |
| `upstream-version.test.mjs` (5) | Lineage check ("some slice has a `theta-client/` marker") is real but weak (a source-path string). | 3 of 5 tests assert nothing when no version is found (diagnostic only, `assert.ok(ver)` on CFBundleShortVersionString which is always present). The file cannot fail in any realistic scenario and gives no version signal. | Mostly tautological; keep as documentation only |
| `run-all.mjs`, `update-snapshot.mjs` | Cross-version runner is correct; `NODE_TEST_CONTEXT` guard prevents accidental rewrite under `node --test <dir>`. | `update-snapshot.mjs` writes unconditionally (see section 3). | OK |
| `tests/THETAClientTests/KotlinEnumTests.swift` (30) | `assertEnumInvariants` (values().size == entries.count, ordinal == index, singleton identity, unique names) across 14 enums is derived from the header and is robust across versions. | Hard-coded counts (IsoEnum 23, LanguageEnum 9, ThetaModel 8, FileTypeEnum 3, TopBottomCorrectionOptionEnum 7) and `isBeforeThetaV` S/Z1/X are brittle: Ricoh adds ISO values, languages and camera models in minor releases. They act as upgrade tripwires, but the failure message does not distinguish bug from upgrade (IsoEnum and ThetaModel messages do, the others do not). `IsoEnum.name` vs member-name matching and `get(value:)` returning nil are upstream-behaviour inferences. | Strong core, brittle counts |
| `ValueTypeTests.swift` (22) | Constructor/accessor/`doCopy`/equality for Kotlin data classes; header-derived and stable. | `BitrateNumber(...).rawValue == "4096"`, `BitrateNumber.get(str:)` nil, `GpsInfo.isDisabled()` false: inferred from Kotlin source, brittle. Equality tests pass on any `isEqual` implementation (largely round-trips of the same constructor args, mid-strength). | Good |
| `HttpHelperTests.swift` (11) | `URL` parsing (host, path, explicit port) and default port 80 are real logic tests. Digest header asserts scheme prefix and `username=/realm=/uri=` plus password not leaked. | `DigestAuth` password defaulting to "", header field order/quoting, response depends on method, and `Platform().platform.hasPrefix("iOS")` / non-empty `Greeting` are upstream-behaviour inferences. No RFC 2617 response-hash vector is checked (the real correctness property), only `notEqual` between GET and POST. | Good, brittle on 6 assertions |
| `ExceptionTypeTests.swift` (8) | Message round trips, hierarchy via casts, sibling distinctness; header-derived. | `e is ThetaRepositoryException` for objects statically typed as their subclass can be compile-time true. Weak but harmless. | Good |
| `ApiSurfaceTests.swift` (7) | Bundle identifier and link-time presence of 10 builders and key types; options holder smoke. | `NSStringFromClass(t).isEmpty` is nearly tautological once the class compiles. Bundle id assertion duplicates the Node plist test. `Options().iso == nil` default is an upstream inference. | Adequate smoke test |
| `Package.swift` testTarget | OK | No explicit `path:`; relies on case-insensitive match of `tests/` to SwiftPM's default `Tests/` (see issue 2). | Fragile |
| `.github/workflows/unit-tests.yml` | Pinned permissions, concurrency, timeouts, failure artefacts. | See section 5. | OK with risks |

### Swift assertions inferred from upstream behaviour (brittle across upstream versions)
- `IsoEnum.name` vs member name (case/underscore-insensitive), `IsoEnum.companion.get(value:)` nil for -1/unknown.
- `ThetaModel.companion.isBeforeThetaV` (S true, Z1/X false) and `get(model:serialNumber:)` nil cases; `ThetaModel` count 8.
- Entry counts: IsoEnum 23, LanguageEnum 9, FileTypeEnum 3, TopBottomCorrectionOptionEnum 7.
- `BaseHttpClient.URL` defaults (port 80, host/path split), `DEFAULT_PORT == 80`.
- `DigestAuth` password defaults to "", header content/shape, method dependence.
- `BitrateNumber.rawValue == "4096"`, `BitrateNumber.get(str:)` nil, `GpsInfo.isDisabled()`.
- `Platform().platform` prefix `iOS`, `Greeting().greeting()` non-empty (sample classes shipped in the framework).
- `Bundle(for: ThetaRepository.self).bundleIdentifier` equals `com.ricoh360.thetaclient.THETAClient` (framework plist, not the header).
- `Options()` defaults nil.
Header-derived (stable): all initialisers and accessors, `doCopy` signatures, enum invariants, exception initialisers and hierarchy.

## 2. Mutation testing (integrity suite, copy outside the repo)

58 mutations. 47 KILLED, 11 SURVIVED (81% kill rate; 6 of the 11 are in Swift-side or non-contractual areas).

| # | Mutation | Result | Caught by |
|---|---|---|---|
| M01 | Package: rename binaryTarget | KILLED | `has a THETAClient binaryTarget pointing at an xcframework path that exists` |
| M02 | Package: binaryTarget path wrong | KILLED | same |
| M03 | Package: add active unsafeFlags | KILLED | `no active unsafeFlags` |
| M04 | Package: iOS floor v16 to v13 | KILLED | `declares iOS 16 as the only platform` |
| M05 | Package: tools 6.2 to 5.9 | KILLED | `swift-tools-version is 6.2` |
| M06 | Package: delete the `.testTarget` | SURVIVED | none (Swift job would run 0 tests, likely exit 0) |
| M07 | Package: remove `swiftLanguageMode(.v5)` | SURVIVED | none |
| M08 | Package: add remote package dependency | KILLED | `no remote package dependencies` |
| M09 | Package: binaryTarget to url+checksum | KILLED | binaryTarget path test |
| M10 | Package: library product renamed | KILLED | `package and library product names` |
| M11 | Package: SPM target drops THETAClient dep | KILLED | `THETAClientSPM target that depends on THETAClient` |
| M12 | Package: testTarget path set to nonexistent dir | SURVIVED | none (Swift job would break) |
| M13 | Remove device slice dir | KILLED | root plist vs disk, binaries, header tests |
| M14 | Remove simulator slice dir | KILLED | same family |
| M15 | Root plist: device LibraryIdentifier renamed | KILLED | `lists exactly the slices that exist on disk`, arch test |
| M16 | Root plist: drop x86_64 from sim archs | KILLED | `architectures in the Mach-O equal SupportedArchitectures` |
| M17 | Root plist: remove simulator variant | KILLED | `SupportedPlatformVariant matches the slice name` |
| M18 | Root plist: BinaryPath wrong | KILLED | `BinaryPath resolves to a real file` |
| M19 | Root plist: format version 2.0 | KILLED | `is an XFWK format 1.0 plist` |
| M20 | Fw plist: bundle id changed | KILLED | `framework Info.plist has expected identity keys` |
| M21 | Fw plist: MinimumOSVersion 17.0 | KILLED | min OS tests |
| M22 | Fw plist (sim): CFBundleSupportedPlatforms to AppleTVOS | SURVIVED | none (the check is unconditionally skipped) |
| M23 | Fw plist (device): platforms to iPhoneSimulator | KILLED | `INTENDED: CFBundleSupportedPlatforms matches the slice` (device only) |
| M24 | Fw plist: CFBundleVersion bumped | SURVIVED | none (version not pinned or compared) |
| M25 | Device binary: corrupt magic | KILLED | `binaries.test.mjs` load failure |
| M26 | Sim binary: corrupt arm64 thin magic | KILLED | `binaries.test.mjs` load failure |
| M27 | Device binary: cputype to x86_64 | KILLED | arch vs plist, `arm64 only` |
| M28 | Sim fat header: arm64 entry cputype changed | KILLED | `fat header cputype matches the embedded Mach-O header cputype` (first attempt was a no-op, re-run on the correct fat entry) |
| M29 | Device binary: LC_BUILD_VERSION platform to macOS | KILLED | `LC_BUILD_VERSION platform is ios` |
| M30 | Device binary: minos 17.0 | KILLED | `deployment target (minos) at or below iOS 16` |
| M31 | Device binary: install name changed | KILLED | `install name is @rpath/...` |
| M32 | Device binary: truncated to 1 MB | KILLED | size tests |
| M33 | Device binary: one byte flipped in `__TEXT` | SURVIVED | none (no content hash) |
| M34 | Device binary replaced by copy of sim binary | KILLED | thin/fat, platform, arch tests |
| M35 | Binaries swapped | KILLED | same |
| M36 | Sim binary replaced by thin device binary | KILLED | `is a FAT binary`, platform tests |
| M37 | Device DWARF emptied | KILLED | `dSYM DWARF file is a valid Mach-O`, dSYM size |
| M38 | Header: rename THETACThetaRepository (both) | KILLED | snapshot, forward-decl check, required classes |
| M39 | Header: rename DigestAuth (both) | KILLED | snapshot, `classes present: networking and auth` |
| M40 | Header: required selector renamed (getVideoCaptureBuilder) | KILLED | `exposes the camera-facing operations Spyne uses` |
| M41 | Header: non-listed method renamed (takePicture) | SURVIVED | none (snapshot has no members) |
| M42 | Header: property type int64 to int32 (both) | SURVIVED | none |
| M43 | Header: new interface added (simulated upgrade) | KILLED | `header API matches the committed snapshot` |
| M44 | Header: CameraEvent interface removed | KILLED | snapshot, forward-decl test |
| M45 | Header: superclass changed | KILLED | snapshot, exception-hierarchy test |
| M46 | Header differs in one slice only | KILLED | `headers in both slices are byte-identical` |
| M47 | Header: new protocol added | KILLED | snapshot |
| M48 | Header truncated to 150 KB | KILLED | floor, forward decl, balance |
| M49 | Modulemap (sim): umbrella header renamed | KILLED | modulemap test |
| M50 | Modulemap (device): module renamed | KILLED | modulemap test |
| M51 | Modulemap (device): `export *` removed | SURVIVED | none (second `export *` in `module * { export * }` satisfies the regex; see note) |
| M52 | Modulemap (device): bogus `link` directive added | SURVIVED | none (no exact-content check) |
| M53 | Stray `.DS_Store` in device framework | KILLED | `no stray files at framework root` |
| M54 | Stray `_CodeSignature` in sim framework | KILLED | same |
| M55 | Orphan third slice dir | KILLED | `lists exactly the slices that exist on disk` |
| M56 | Real code added to ThetaClientSPM.swift | KILLED | `contains no code` observation test |
| M57 | Snapshot file entry deleted | KILLED | snapshot test |
| M58 | A Swift test file deleted | SURVIVED | none (no test-count guard, 78 becomes fewer without a signal) |

Note on M51: the device modulemap has two `export *` (module level and inside `module * { export * }`); my mutation removed only the first, and the test regex matches the second. Real but narrow weakness: the test would also pass if the module-level export were dropped. Assert the normalised modulemap text exactly.

### Recommended tests for survivors
1. M06, M07, M12, M58: add a Node test that parses the `.testTarget` (name, `dependencies`, `swiftSettings`, explicit `path`) and counts `func test` methods in `tests/THETAClientTests/*.swift` (floor 78). In CI, parse `xcodebuild` output for `Executed N tests` and fail when N is below the floor (zero tests currently exits 0 and shows green).
2. M22: replace the permanent skip with a lock: assert the simulator slice value is in `{iPhoneOS (known defect), iPhoneSimulator}` and emit a diagnostic or fail with "defect fixed, tighten to iPhoneSimulator" so a regression to a third value is caught and a fix is noticed.
3. M24: pin `CFBundleShortVersionString` and `CFBundleVersion` per slice in a manifest; a version-only bump then forces a conscious update.
4. M33: add a `checksums.json` (sha256 of each slice binary and header, committed) and a test that compares them, with an update script gated like the snapshot. This is the only way to detect a binary swap or byte corruption that preserves the Mach-O structure.
5. M41, M42: extend the snapshot to member level (per interface: selectors with parameter types and property types, nullability). Cheap regex over `^- (` and `^@property` lines under each `@interface`; store sorted per class. That catches the typical Ricoh upgrade, which adds options and methods to existing classes.
6. M51, M52: assert the modulemap normalised text equals an expected string per slice (device and sim differ by `use Foundation`, so two literals).

## 3. API snapshot: does it catch a real upgrade, is the update workflow safe

- Catches: new or removed top-level classes, protocols, categories, superclass changes (M38, M39, M43, M44, M45, M47, M57 all killed with a readable +/-/~ diff).
- Does not catch: methods, properties, parameter types, nullability, enum cases, constants, or anything inside a class body (M41, M42 survived). Ricoh upgrades usually add options and capture parameters to existing classes (for example new `Options` properties for a new camera model). A realistic upstream upgrade can therefore pass the suite with a different binary and header. Verdict: catches a binary swap between wildly different builds, not routine point upgrades.
- Update workflow safety: acceptable but light. `update-snapshot.mjs` is guarded against `node --test` sweep, always reads the device slice header, and prints counts. Gaps: it does not verify the two slice headers are identical first (the other test does), writes no upstream version or date metadata, and nothing forces human review, so a red CI can be turned green by running one command. Add CODEOWNERS or a PR checklist line for `api-snapshot.json`, and print the diff to the console when regenerating.

## 4. False-confidence risks (what the suite cannot catch)

- Runtime behaviour of the Kotlin/Native binary on a camera: HTTP protocol, OSC command shapes, digest challenge from real firmware, capture state machine, live preview, file download. Nothing exercises `doNewInstance` or any capture builder `build()`.
- Camera model quirks (per-model option support, Z1 vs X vs V differences) and Wi-Fi AP behaviour on iOS (local-network permission, captive-portal detection).
- Upstream version drift: no version string exists in header, plists or binary strings (author finding 6), and the upstream-version tests assert nothing. A byte-for-byte different binary with the same API shape and the same Mach-O layout passes everything (M33).
- Code signing, entitlements, privacy manifest (`PrivacyInfo.xcprivacy`) and App Store validation: not checked. The known simulator `CFBundleSupportedPlatforms` defect is exactly the kind of thing that fails upload validation, yet it is skipped.
- Link/embed behaviour in a host app (the Swift smoke job tests an XCTest bundle, not an app embedding the framework with `Embed & Sign`).
- arm64 device execution: only structural validation; the x86_64 simulator sub-slice is parsed, never executed.
- DMS/dealer-side integration is out of scope for this repo (the SDK is the 360 spin-shoot camera layer, not a DMS integration), so passing here says nothing about listing or merchandising turn time.

## 5. CI readiness

| Item | Assessment |
|---|---|
| Trigger | `pull_request` to `main` plus `workflow_dispatch`. A push to the feature branch does not run it (acceptable, note it). |
| Job `integrity` | ubuntu-latest, Node 20, zero deps, about 2 s of tests plus checkout of 60 MB binaries. Low risk. Verified green on GitHub Actions per executor; locally on Node 22. Windows CRLF Package.swift passes (regexes use `\s`). Action tags `@v4` are not SHA-pinned (low). |
| Job `swift-smoke` | `macos-26` label: available now (executor ran it) but a hosted-runner label that can be deprecated or limited by plan; the comment's `macos-15` fallback depends on that image keeping Xcode 26.x side by side. Xcode selection regex `^Xcode_26[0-9._]*\.app$` plus `sort -V`: fine, fails fast if absent; will not pick betas, will drift to a newer 26.x silently (e.g. 26.6 to 26.7) which can change SwiftPM or Swift warnings. Pinning an exact version trades drift for breakage when images rotate; recommend an env var with the expected major.minor and a warning on mismatch. |
| Simulator selection | Auto-detects the first iPhone not SE/Air, then passes `name=`; if two runtimes expose the same device name xcodebuild warns and picks one. Prefer `id=<UDID>` from `simctl`. Needs an arm64 runner (macos-26 is arm64) so only the arm64 sim slice is exercised. |
| Scheme choice | `THETAClientPackage-Package` with fallback to `THETAClientPackage`; the fallback scheme does not include the test target, so a fallback would run no tests yet could exit 0 (same false-green as M06). Add the `Executed N tests` guard. |
| Time and cache | No SPM or DerivedData cache; the only dependency is the local binary, so cold build is short. 45 min timeout is generous; consider 20. |
| Flakiness | Low for the Node job. Swift job risks: simulator boot or runtime availability, first-launch `xcodebuild` (CoreSimulator service) hiccups, and Medium-confidence assertions drifting with an Xcode or upstream change. Results are uploaded only on failure; add a JUnit or step-summary of counts on success. |
| `swiftLanguageMode(.v5)` | Valid under tools 6.2 and necessary only to dodge strict-concurrency diagnostics on Kotlin/Native types. Fragile if the tools version is lowered (the API requires 6.0+) and it is not guarded by any test (M07 survived). Low severity but worth a guard. |
| Empty `THETAClientSPM` target | Works today (CI green) because a comment-only `.swift` file exists, and the Node test requires exactly one file. If someone deletes the file, SwiftPM errors out ("Source files for target ... should be located under ..."). Test also depends on this target only to satisfy `import`; a future Xcode that warns on empty modules would add noise. Low to medium. |
| Directory case | Tests live in `tests/THETAClientTests` (lowercase) while SwiftPM defaults to `Tests/`. Works on case-insensitive APFS (macOS runners, most dev Macs). Fails on Linux or case-sensitive APFS volumes. Also `git config core.ignorecase=true` on the author machine hides case mismatches. Author notes refer to `Tests/`. |

## 6. Ranked issues

1. HIGH: Zero-test false green. Deleting or unlinking the test target (M06, M12, M58) leaves the Node job green and the Swift job potentially exit 0 with no tests. Add a Node check on `.testTarget` plus a test-count floor in CI.
2. HIGH (portability): `tests/` vs SwiftPM default `Tests/`. Set `path: "tests/THETAClientTests"` on the test target or rename the directory to `Tests`. Not a current CI failure.
3. MEDIUM: API snapshot is top-level only. A realistic Ricoh point upgrade (members added to `Options`, new builder arguments) passes (M41, M42). Extend the snapshot to member signatures.
4. MEDIUM: No binary content hash. A byte-different binary of the same shape passes (M33) and there is no upstream version string; add committed sha256 for binaries and headers.
5. MEDIUM: The known simulator `CFBundleSupportedPlatforms` defect is protected only by a permanent skip; regressions in that field are invisible (M22). Replace with an allowed-set lock.
6. MEDIUM: Hard-coded enum counts (IsoEnum 23, ThetaModel 8, LanguageEnum 9, FileTypeEnum 3, TopBottomCorrectionOptionEnum 7) and inferred behaviours will go red on routine upstream upgrades, and failure messages for 3 of the 5 do not explain that. Add the same upgrade hint everywhere or move counts into the snapshot.
7. LOW: Tautological tests (2 in package-manifest, 3 effectively in upstream-version, modulemap observation) inflate the 112 count; real count of meaningful assertions is about 105.
8. LOW: Modulemap content not asserted exactly (M51, M52); simulator workflow uses `name=` not `id=`; actions not SHA-pinned; success run uploads nothing.
9. LOW: `update-snapshot.mjs` lacks a header-identical precheck and diff print.
10. INFO: Author note says the Node job is "RED by design"; it is now green via a skip, which is the better outcome but see issue 5.

## 7. Verdict

SHIP, with conditions. The integrity suite is genuinely discriminating at the packaging level (81% mutation kill rate; every structural packaging mutation was caught, including slice swaps, Mach-O corruption, plist drift and header renames), and the Swift suite compiled and passed 78/78 on a pinned toolchain. It is not a regression net for binary behaviour or for member-level API drift.

Merge conditions (small, no re-architecture): (a) add an explicit `path:` on the test target (issue 2), (b) add a test-count guard (issue 1). Everything else can follow as backlog (issues 3 to 6). Do not describe this suite to stakeholders as "SDK behaviour tested"; it verifies packaging integrity and a compile/link smoke of the generated API, nothing about the camera path.
