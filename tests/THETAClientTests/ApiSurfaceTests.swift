import XCTest
import THETAClient

/// Compile-time and link-time smoke test that the symbols the Spyne capture apps depend on are present in the
/// binary and resolvable at runtime (class objects are loaded from the framework). Nothing is instantiated that
/// needs a camera.
final class ApiSurfaceTests: XCTestCase {

    func testModuleImportsAndFrameworkBundleLoads() {
        let bundle = Bundle(for: ThetaRepository.self)
        XCTAssertEqual(bundle.bundleIdentifier, "com.ricoh360.thetaclient.THETAClient")
        XCTAssertTrue(bundle.isLoaded)
    }

    func testCaptureBuilderTypesAreLinked() {
        let types: [AnyClass] = [
            PhotoCapture.Builder.self,
            VideoCapture.Builder.self,
            BurstCapture.Builder.self,
            MultiBracketCapture.Builder.self,
            TimeShiftCapture.Builder.self,
            TimeShiftManualCapture.Builder.self,
            ShotCountSpecifiedIntervalCapture.Builder.self,
            CompositeIntervalCapture.Builder.self,
            ContinuousCapture.Builder.self,
            LimitlessIntervalCapture.Builder.self,
        ]
        XCTAssertEqual(types.count, 10)
        XCTAssertEqual(Set(types.map { NSStringFromClass($0) }).count, 10, "builder classes must be distinct")
    }

    func testRepositoryAndStateTypesAreLinked() {
        let types: [AnyClass] = [
            ThetaRepository.self,
            ThetaRepository.Config.self,
            ThetaRepository.Options.self,
            ThetaRepository.ThetaState.self,
            ThetaRepository.ThetaInfo.self,
            ThetaRepository.ThetaFiles.self,
            ThetaRepository.FileInfo.self,
            EventWebSocket.self,
            CameraEvent.self,
        ]
        for t in types { XCTAssertFalse(NSStringFromClass(t).isEmpty) }
    }

    func testRepositoryCompanionIsAvailableWithoutConnecting() {
        // Accessing the companion must not touch the network; only calling doNewInstance would.
        XCTAssertNotNil(ThetaRepository.companion)
    }

    func testCallbackProtocolsExist() {
        // Compile-time proof the protocols are exported under their Swift names.
        _ = PhotoCaptureTakePictureCallback.self
        _ = EventWebSocketCallback.self
        _ = VideoCaptureStartCaptureCallback.self
        _ = BurstCaptureStartCaptureCallback.self
    }

    func testOptionsCanBeConstructedEmpty() {
        // Options is a plain data holder in the repository API; an empty instance must not require a camera.
        let o = ThetaRepository.Options()
        XCTAssertNil(o.iso)
        XCTAssertNil(o.captureMode)
        XCTAssertNil(o.whiteBalance)
    }

    func testOptionsAcceptCaptureSettingsUsedBySpinShoots() {
        let o = ThetaRepository.Options()
        o.iso = ThetaRepository.IsoEnum.iso200
        o.captureMode = ThetaRepository.CaptureModeEnum.image
        o.whiteBalance = ThetaRepository.WhiteBalanceEnum.auto
        XCTAssertTrue(o.iso === ThetaRepository.IsoEnum.iso200)
        XCTAssertTrue(o.captureMode === ThetaRepository.CaptureModeEnum.image)
        XCTAssertTrue(o.whiteBalance === ThetaRepository.WhiteBalanceEnum.auto)
    }
}
