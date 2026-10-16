# 03 - Bug validation: SpyneThetaSDK packaging findings

Scope: validator pass over author notes findings 1-6 plus consumer search. Nothing committed. Xcode, `codesign`, `xcodebuild` and App Store validation were NOT run (Windows host, no Apple toolchain); Apple-tool behaviour below is stated as expected behaviour from how those tools work, not as observed. The Blue Brain MCP tools were not queried; consumers were found by grepping the sibling clones. Blue Brain's own CLAUDE.md for this repo says "Called by: none detected", which is consistent with the grep (nobody imports this SPM package).

## Evidence gathered

- Both slices' `THETAClient.h` are byte-identical (md5 47773b63...). The generated API is the same in both slices.
- Plist formatting differs: device plist is 4-space indented with a trailing-space line (`<integer>2</integer>       `); simulator plist is tab indented. Different files, produced by different steps.
- Simulator binary string table contains `/Users/matsuoka/Documents/SourceTree/theta-client/kotlin-multiplatform/src/iosMain/kotlin/.../Platform.kt` (a Ricoh developer's local path, upstream build residue, not Spyne's). Device binary has no such string. Both binaries carry the same `com.ricoh360.thetaclient...` Kotlin symbol families (sim has about 2x the strings because it is a 2-arch FAT).
- No semver string anywhere. Framework plists are the default 1.0 / build 1.
- Consumers:
  - `spyne-automobile-ios-sdk/Podfile:25` `pod 'THETAClient'` (unpinned in the Podfile); `Podfile.lock:103` resolves **THETAClient 1.11.0** (CocoaPods trunk). It is used by `RicohThetaManager.swift`, `ThetaSdk.swift`, `RicohThetaViewController.swift`, `InteriorRecoThetaShootView`. No `import`/reference to `THETAClientPackage` or `SpyneThetaSDK` exists in that repo.
  - `spyne-automobile-android-sdk/gradle/libs.versions.toml:38` `theta = "1.15.0"` (`com.ricoh360.thetaclient:theta-client`).
  - Nothing in spyne-food-ios-sdk, SpyneAutomobileSDK, spyne-automobile-media-sdk, spyne-automobile-android-app, 360-backend references this package. (media-sdk hits were localisation JSON only.)
  - So: this SPM package currently has ZERO consumers in the cloned Spyne repos. The live iOS consumer uses the CocoaPods pod at 1.11.0; Android is at 1.15.0. iOS (1.11.0) and Android (1.15.0) already disagree by four minor versions, and the vendored binary's version is unknown, so a third value is in play.

## Per-finding verdicts

### 1. Simulator slice Info.plist says CFBundleSupportedPlatforms=[iPhoneOS]
- Verdict: REAL (metadata defect), but LATENT in impact.
- Evidence it is tolerated: author notes report macOS CI built, linked and ran 78 tests on the simulator slice (note: those notes say Swift tests were "Not compiled or run (Windows)"; the CI run result was reported to me by the caller, I did not see it). That shows SwiftPM resolve, link and simulator test launch are tolerated. Simulator loading is driven by the Mach-O LC_BUILD_VERSION platform (7), not the plist key, so simulator launch is expected to work.
- Where it can bite: (a) archive/App Store validation of an app that embeds THETAClient.framework. Xcode's embed step copies only the device slice (ios-arm64) into an archive, and that slice's plist says iPhoneOS, so the wrong plist does not ship in a release build. Low chance of an App Store rejection from this key. (b) Debug builds for the simulator embed the sim framework; Xcode normally does not validate the key there. Possible `codesign`/`xcodebuild` warning at most; cannot confirm without the toolchain. (c) A "build for any iOS Device" universal archive flow that merges slices (rare) could mis-tag.
- Reachability: simulator-only builds (developer machines, CI). Not in the shipped IPA.
- Severity: Low.
- Minimal fix: set `CFBundleSupportedPlatforms` to `iPhoneSimulator` in the simulator slice plist, or better, rebuild the xcframework with `xcodebuild -create-xcframework` from properly built per-platform frameworks so Xcode stamps it. Do not hand-edit if the binary is later re-signed or checksummed by upstream.
- Test: remove the `skip` at `tests/integrity/xcframework-structure.test.mjs:107` only after the plist is corrected. Until then keep it skipped (or mark expected-fail) so CI is not red for a defect with no shipped impact.

### 2. modulemap `use Foundation` only on device; UIRequiredDeviceCapabilities only on device
- Verdict: NOT A BUG as a defect; REAL as a provenance signal (the two slice directories were not produced by an identical step).
- `use Foundation` in a framework modulemap is a long-deprecated/ignored directive for clang modules (header already imports Foundation); its presence or absence does not change the module that Swift imports. The sim slice built and tested fine without it. `UIRequiredDeviceCapabilities=arm64` on the device only is actually correct/harmless: a simulator slice has no device capability requirement.
- Do not over-read "two pipelines": the headers are byte-identical, so the API source is the same. More likely a single Kotlin build whose device plist/modulemap were later hand-touched (4-space indent vs tabs supports a manual edit).
- Consumer impact: none observed. Reachability: none. Severity: Low (informational). Fix: none required; on rebuild let one script generate both. Test: nothing to un-skip.

### 3. minOS 14.0 (sim arm64) vs 12.0 (others) vs package floor iOS 16
- Verdict: NOT A BUG.
- Every minOS is at or below iOS 16, so nothing is excluded by the floor. The 14.0 vs 12.0 difference within the simulator FAT only matters for simulators older than iOS 14, which Xcode 26 cannot run anyway. The framework plist says 12.0 for both; it is a stale default, harmless.
- Severity: none. Fix: none. Test: the existing `<= 16` assertion is correct; keep.

### 4. `Sources/THETAClientSPM/ThetaClientSPM.swift` comment-only file, wrong header (SpyneAutomobileSPM)
- Verdict: LATENT.
- The file is non-empty so SwiftPM sees one Swift source and compiles an empty module without complaint; CI (tools 6.2, Xcode 26) already did so. A genuinely empty directory would be the risky case (SwiftPM errors "Source files for target ... should be located under..."), which is not the situation here. Residual risks: the target exports nothing, so `import THETAClientSPM` gives consumers nothing, and the product `THETAClientPackage` links only via the transitive binary; a consumer must still `import THETAClient`. Newer toolchains tightening empty-module rules is speculation; I found no evidence of that. The wrong header comment is cosmetic copy/paste debris (Daksh Singh, from the SpyneAutomobileSPM template).
- Severity: Low. Fix: add `@_exported import THETAClient` to the file (so `import THETAClientSPM` exposes the API) and correct the header; or point the product directly at the binary target. Re-run CI.
- Test: no skipped test; the OBSERVATION test "no code" must be updated if `@_exported import` is added.

### 5. Device slice lacks the `theta-client` source-path string the simulator has
- Verdict: NOT A BUG (weak evidence of different builds, not proof).
- I confirmed the asymmetry: the single path string is `_state_global$com.ricoh360.thetaclient$/Users/matsuoka/.../theta-client/kotlin-multiplatform/src/iosMain/kotlin/.../Platform.kt`, a Kotlin/Native global-state symbol, present only in the sim binary. Plausible benign causes: dead-code elimination or symbol stripping of that one global in the device link (headers and symbol families are identical). Versus a different build: the identical header argues against different API versions, but cannot rule out different patch builds. Inference limit: the slices share an API surface; nothing more about version can be derived.
- Side finding: the sim binary leaks a Ricoh developer's absolute local path (username `matsuoka`). Upstream residue, not a Spyne secret; no action beyond awareness.
- Severity: Low. Fix: rebuild both slices from one pinned upstream tag in one command. Test: nothing to un-skip; the upstream-version test should keep recording "not determinable".

### 6. Upstream version not determinable
- Verdict: REAL (supply-chain/provenance gap), currently LATENT because nothing consumes the package.
- Consumer cannot map the binary to a Ricoh release, so cannot say whether a fixed upstream bug or advisory applies. Compounded by Spyne already running 1.11.0 (iOS pod) and 1.15.0 (Android). I did not invent a version for this binary, and neither should the README; "Created by Daksh Singh" (commit `cb04e55 added theta`) suggests a one-time manual copy.
- Reachability: becomes real the moment a capture app adopts this SPM package instead of the pod. A mis-pinned camera client (Ricoh changes the camera API per model firmware) would show up as THETA Z1 / X shoot failures in the field during a rooftop spin shoot, which is hard to attribute.
- Severity: Medium (provenance), High if the package is adopted without fixing it.
- Minimal fix, in priority order: (1) Ask the author (Daksh Singh) which Ricoh release/tag it was built from; if unknown, rebuild from a chosen tag (match iOS pod 1.11.0 or Android 1.15.0 deliberately, one decision for both). (2) Record it in-repo: put the upstream tag and source commit in a `UPSTREAM_VERSION` file, set `CFBundleShortVersionString` to it in both plists, and create git tag `vX.Y.Z-spyne.N`. (3) Consider consuming Ricoh's own published SPM binary release by `url` + `checksum` in Package.swift so the version is the URL. (4) Let the existing `api-snapshot.json` act as the upgrade detector; add a test that fails if CFBundleShortVersionString is still `1.0`. (5) Align Android and iOS to one Ricoh version. Do not use the binary's strings to guess.
- Test: no skip to remove; the upstream-version test should be changed from "diagnostic only" to asserting the new `UPSTREAM_VERSION` file matches plist.

## Ranked fixes

1. Pin and document the upstream Ricoh version (finding 6), and decide the single target version across iOS pod 1.11.0 and Android 1.15.0. Highest value, gates any adoption.
2. Decide whether this package is meant to replace the CocoaPod THETAClient 1.11.0 in `spyne-automobile-ios-sdk`; today it is unused, so the packaging defects below are not hurting any release.
3. Rebuild the xcframework in one pipeline from the pinned tag (fixes 1, 2, 5, plist 1.0 default together) and then remove the skip at `xcframework-structure.test.mjs:107`.
4. Make `THETAClientSPM` do something (`@_exported import THETAClient`) and fix its header comment (finding 4).
5. Everything else (minOS differences, modulemap `use Foundation`) needs no action.

## Skipped test

`tests/integrity/xcframework-structure.test.mjs:107` (simulator plist platform). Un-skip only after the simulator plist is corrected or the framework is rebuilt. Not before.
