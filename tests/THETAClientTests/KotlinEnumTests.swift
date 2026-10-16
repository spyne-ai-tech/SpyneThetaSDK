import XCTest
import THETAClient

/// Structural invariants of the Kotlin/Native-generated enum classes. Pure value logic; no camera, no network.
/// Every enum referenced here is declared in THETAClient.h with `values()` and `entries`.
final class KotlinEnumTests: XCTestCase {

    /// Checks the invariants every Kotlin enum must satisfy once exported to Objective-C.
    private func assertEnumInvariants<E: AnyObject>(
        _ label: String,
        entries: [E],
        values: KotlinArray<E>,
        ordinal: (E) -> Int32,
        name: (E) -> String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertFalse(entries.isEmpty, "\(label): entries is empty", file: file, line: line)
        XCTAssertEqual(Int(values.size), entries.count, "\(label): values().size != entries.count", file: file, line: line)
        for (i, e) in entries.enumerated() {
            XCTAssertEqual(ordinal(e), Int32(i), "\(label): ordinal of \(name(e)) is not its position", file: file, line: line)
            XCTAssertFalse(name(e).isEmpty, "\(label): empty name at \(i)", file: file, line: line)
            XCTAssertTrue(values.get(index: Int32(i)) === e, "\(label): values()[\(i)] is not the singleton entries[\(i)]", file: file, line: line)
        }
        XCTAssertEqual(Set(entries.map(name)).count, entries.count, "\(label): duplicate names", file: file, line: line)
    }

    // MARK: - invariants across many enums

    func testEnumInvariants_IsoEnum() {
        assertEnumInvariants("IsoEnum", entries: ThetaRepository.IsoEnum.entries, values: ThetaRepository.IsoEnum.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    func testEnumInvariants_LanguageEnum() {
        assertEnumInvariants("LanguageEnum", entries: ThetaRepository.LanguageEnum.entries, values: ThetaRepository.LanguageEnum.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    func testEnumInvariants_ThetaModel() {
        assertEnumInvariants("ThetaModel", entries: ThetaRepository.ThetaModel.entries, values: ThetaRepository.ThetaModel.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    func testEnumInvariants_CameraErrorEnum() {
        assertEnumInvariants("CameraErrorEnum", entries: ThetaRepository.CameraErrorEnum.entries, values: ThetaRepository.CameraErrorEnum.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    func testEnumInvariants_AuthModeEnum() {
        assertEnumInvariants("AuthModeEnum", entries: ThetaRepository.AuthModeEnum.entries, values: ThetaRepository.AuthModeEnum.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    func testEnumInvariants_ChargingStateEnum() {
        assertEnumInvariants("ChargingStateEnum", entries: ThetaRepository.ChargingStateEnum.entries, values: ThetaRepository.ChargingStateEnum.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    func testEnumInvariants_CaptureStatusEnum() {
        assertEnumInvariants("CaptureStatusEnum", entries: ThetaRepository.CaptureStatusEnum.entries, values: ThetaRepository.CaptureStatusEnum.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    func testEnumInvariants_CaptureModeEnum() {
        assertEnumInvariants("CaptureModeEnum", entries: ThetaRepository.CaptureModeEnum.entries, values: ThetaRepository.CaptureModeEnum.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    func testEnumInvariants_ApertureEnum() {
        assertEnumInvariants("ApertureEnum", entries: ThetaRepository.ApertureEnum.entries, values: ThetaRepository.ApertureEnum.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    func testEnumInvariants_ShutterSpeedEnum() {
        assertEnumInvariants("ShutterSpeedEnum", entries: ThetaRepository.ShutterSpeedEnum.entries, values: ThetaRepository.ShutterSpeedEnum.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    func testEnumInvariants_WhiteBalanceEnum() {
        assertEnumInvariants("WhiteBalanceEnum", entries: ThetaRepository.WhiteBalanceEnum.entries, values: ThetaRepository.WhiteBalanceEnum.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    func testEnumInvariants_ExposureProgramEnum() {
        assertEnumInvariants("ExposureProgramEnum", entries: ThetaRepository.ExposureProgramEnum.entries, values: ThetaRepository.ExposureProgramEnum.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    func testEnumInvariants_FileTypeEnum() {
        assertEnumInvariants("FileTypeEnum", entries: ThetaRepository.FileTypeEnum.entries, values: ThetaRepository.FileTypeEnum.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    func testEnumInvariants_ContinuousNumberEnum() {
        assertEnumInvariants("ContinuousNumberEnum", entries: ThetaRepository.ContinuousNumberEnum.entries, values: ThetaRepository.ContinuousNumberEnum.values(), ordinal: { $0.ordinal }, name: { $0.name })
    }

    // MARK: - IsoEnum specifics (header-derived)

    func testIsoEnum_declaredMembersAndOrdinals() {
        let iso = ThetaRepository.IsoEnum.self
        XCTAssertEqual(iso.isoAuto.ordinal, 0)
        XCTAssertEqual(iso.iso50.ordinal, 1)
        XCTAssertEqual(iso.entries.first, iso.isoAuto)
        XCTAssertEqual(iso.entries.last, iso.iso6400)
        XCTAssertEqual(iso.entries.count, 23, "IsoEnum entry count changed; update this test with the header (23 entries at snapshot time)")
    }

    func testIsoEnum_valueMatchesIsoNumber() {
        let iso = ThetaRepository.IsoEnum.self
        XCTAssertEqual(iso.iso50.value, 50)
        XCTAssertEqual(iso.iso100.value, 100)
        XCTAssertEqual(iso.iso200.value, 200)
        XCTAssertEqual(iso.iso800.value, 800)
        XCTAssertEqual(iso.iso6400.value, 6400)
    }

    func testIsoEnum_valuesStrictlyIncreaseExceptAutoFirst() {
        let numeric = ThetaRepository.IsoEnum.entries.filter { $0 !== ThetaRepository.IsoEnum.isoAuto }
        for pair in zip(numeric, numeric.dropFirst()) {
            XCTAssertLessThan(pair.0.value, pair.1.value)
        }
    }

    func testIsoEnum_companionLookupRoundTrips() {
        let companion = ThetaRepository.IsoEnum.companion
        for e in ThetaRepository.IsoEnum.entries {
            XCTAssertTrue(companion.get(value: e.value) === e, "companion.get(value:) did not round-trip \(e.name)")
        }
    }

    func testIsoEnum_companionLookupUnknownIsNil() {
        XCTAssertNil(ThetaRepository.IsoEnum.companion.get(value: 987_654))
        XCTAssertNil(ThetaRepository.IsoEnum.companion.get(value: -1))
    }

    func testIsoEnum_compareToFollowsOrdinal() {
        let iso = ThetaRepository.IsoEnum.self
        XCTAssertLessThan(iso.iso100.compareTo(other: iso.iso200), 0)
        XCTAssertGreaterThan(iso.iso800.compareTo(other: iso.iso100), 0)
        XCTAssertEqual(iso.iso100.compareTo(other: iso.iso100), 0)
    }

    func testIsoEnum_isSingletonAndEquatable() {
        XCTAssertTrue(ThetaRepository.IsoEnum.iso100 === ThetaRepository.IsoEnum.iso100)
        XCTAssertEqual(ThetaRepository.IsoEnum.iso100, ThetaRepository.IsoEnum.iso100)
        XCTAssertNotEqual(ThetaRepository.IsoEnum.iso100, ThetaRepository.IsoEnum.iso200)
    }

    func testIsoEnum_nameMatchesCaseIgnoringSeparators() {
        // Kotlin enum names are SCREAMING_SNAKE_CASE; the ObjC member is camelCase. Compare ignoring case and underscores.
        func norm(_ s: String) -> String { s.replacingOccurrences(of: "_", with: "").lowercased() }
        XCTAssertEqual(norm(ThetaRepository.IsoEnum.isoAuto.name), "isoauto")
        XCTAssertEqual(norm(ThetaRepository.IsoEnum.iso100.name), "iso100")
        XCTAssertEqual(norm(ThetaRepository.IsoEnum.iso6400.name), "iso6400")
    }

    // MARK: - Other enums (header-derived)

    func testLanguageEnum_hasTheNineDocumentedLanguages() {
        let l = ThetaRepository.LanguageEnum.self
        XCTAssertEqual(l.entries.count, 9)
        XCTAssertEqual(l.entries.map { $0.ordinal }, Array(0..<9))
        XCTAssertTrue(l.entries.contains { $0 === l.enUs })
        XCTAssertTrue(l.entries.contains { $0 === l.ja })
        XCTAssertEqual(l.de.ordinal, 0)
    }

    func testThetaModel_declaresAllKnownModels() {
        let m = ThetaRepository.ThetaModel.self
        XCTAssertEqual(m.entries.count, 8, "ThetaModel entry count changed; a new camera model was added/removed upstream")
        let expected: [ThetaRepository.ThetaModel] = [m.thetaS, m.thetaSc, m.thetaV, m.thetaZ1, m.thetaX, m.thetaSc2, m.thetaSc2B, m.thetaA1]
        XCTAssertEqual(m.entries, expected)
        for e in m.entries { XCTAssertFalse(e.value.isEmpty, "empty model string for \(e.name)") }
    }

    func testThetaModelCompanion_unknownModelIsNil() {
        let c = ThetaRepository.ThetaModel.companion
        XCTAssertNil(c.get(model: "NOT A RICOH CAMERA", serialNumber: nil))
        XCTAssertNil(c.get(model: nil, serialNumber: nil))
    }

    func testThetaModelCompanion_isBeforeThetaV() {
        let c = ThetaRepository.ThetaModel.companion
        let m = ThetaRepository.ThetaModel.self
        XCTAssertTrue(c.isBeforeThetaV(model: m.thetaS))
        XCTAssertFalse(c.isBeforeThetaV(model: m.thetaZ1))
        XCTAssertFalse(c.isBeforeThetaV(model: m.thetaX))
    }

    func testFileTypeEnum_allImageVideo() {
        let f = ThetaRepository.FileTypeEnum.self
        XCTAssertEqual(f.entries.count, 3)
        XCTAssertEqual(f.all.ordinal, 0)
        XCTAssertEqual(f.image.ordinal, 1)
        XCTAssertEqual(f.video.ordinal, 2)
    }

    func testContinuousNumberEnum_offIsFirst() {
        XCTAssertEqual(ThetaRepository.ContinuousNumberEnum.off.ordinal, 0)
        XCTAssertTrue(ThetaRepository.ContinuousNumberEnum.entries.first === ThetaRepository.ContinuousNumberEnum.off)
        XCTAssertTrue(ThetaRepository.ContinuousNumberEnum.entries[1] === ThetaRepository.ContinuousNumberEnum.max1)
    }

    func testCameraErrorEnum_unknownIsFirstAndNamedMembersExist() {
        let e = ThetaRepository.CameraErrorEnum.self
        XCTAssertEqual(e.unknown.ordinal, 0)
        for member in [e.noMemory, e.fileNumberOver, e.notEnoughBattery, e.highTemperature, e.batteryHighTemperature] {
            XCTAssertTrue(e.entries.contains { $0 === member })
        }
    }

    func testTopBottomCorrectionOptionEnum_declaredMembers() {
        let o = ThetaRepository.TopBottomCorrectionOptionEnum.self
        XCTAssertEqual(o.entries.count, 7)
        XCTAssertEqual(o.apply.ordinal, 0)
        XCTAssertEqual(o.disapply.ordinal, 5)
        XCTAssertEqual(o.manual.ordinal, 6)
    }
}
