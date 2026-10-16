# QA agent pipeline (SpyneThetaSDK tests)

Author -> executor -> judge -> bug validator. Each stage's output is kept here.

| Stage | File | Status |
|---|---|---|
| Author | `00-author-notes.md` | 112 Node integrity tests and 78 XCTest methods |
| Executor | GitHub Actions (Ubuntu and macos-26 / Xcode 26.x) | Node job green; all 78 Swift tests passed on the iOS Simulator |
| Judge | `02-judge-verdicts.md` | Ship with two conditions (both applied); 47 of 58 mutations caught |
| Bug validator | `03-bug-validation.md` | Packaging defects are latent (nothing in the org consumes this package yet); upstream version unknown |

## Post-review changes
- Added `path: "tests/THETAClientTests"` to the Swift test target so it resolves on case-sensitive volumes (the directory is lowercase, SwiftPM defaults to `Tests/`), plus a Node test that checks it.
- Added a CI step that fails the macOS job if fewer than 70 XCTest tests ran, so unlinking the test target cannot give a false green.
- The Swift tests needed two fixes to match the real generated API: a nonexistent `WhiteBalanceEnum.auto` member, and instantiating the abstract `ThetaRepositoryException`.

## Known defect, skipped on purpose
The simulator slice `Info.plist` (`ios-arm64_x86_64-simulator/THETAClient.framework/Info.plist:17-19`) declares `CFBundleSupportedPlatforms` as `iPhoneOS`; it should be `iPhoneSimulator`. The validator rates it Low (the simulator uses the Mach-O platform value and CI already ran tests on it). The test is skipped with the reason; remove the skip when the framework is rebuilt.

## What this suite does and does not prove
It verifies packaging integrity (Package.swift, xcframework structure, real Mach-O headers, the public API list) and a compile-and-link smoke of the generated API. It does not exercise camera behaviour, and the upstream Ricoh theta-client version cannot be determined from the binary.

## Backlog from the judge
Member-level API snapshot, sha256 hashes of the binaries and headers, an allowed-value lock in place of the permanent skip, simulator selection by UDID, and a note that the hard-coded enum counts will go red on a routine upstream upgrade.
