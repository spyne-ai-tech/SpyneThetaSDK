import XCTest
import THETAClient

/// Constructors, accessors, `doCopy` and equality of the Kotlin data classes exported to Objective-C.
/// Every initialiser used here is declared in THETAClient.h. No camera and no network.
final class ValueTypeTests: XCTestCase {

    // MARK: - ThetaRepository.Timeout

    func testTimeout_storesAllThreeValues() {
        let t = ThetaRepository.Timeout(connectTimeout: 1_000, requestTimeout: 2_000, socketTimeout: 3_000)
        XCTAssertEqual(t.connectTimeout, 1_000)
        XCTAssertEqual(t.requestTimeout, 2_000)
        XCTAssertEqual(t.socketTimeout, 3_000)
    }

    func testTimeout_supportsValuesBeyondInt32() {
        let big: Int64 = 5_000_000_000
        let t = ThetaRepository.Timeout(connectTimeout: big, requestTimeout: big + 1, socketTimeout: big + 2)
        XCTAssertEqual(t.connectTimeout, big)
        XCTAssertEqual(t.requestTimeout, big + 1)
        XCTAssertEqual(t.socketTimeout, big + 2)
    }

    func testTimeout_equalityAndCopy() {
        let a = ThetaRepository.Timeout(connectTimeout: 1, requestTimeout: 2, socketTimeout: 3)
        let b = ThetaRepository.Timeout(connectTimeout: 1, requestTimeout: 2, socketTimeout: 3)
        let c = a.doCopy(connectTimeout: 1, requestTimeout: 2, socketTimeout: 99)
        XCTAssertEqual(a, b)
        XCTAssertNotEqual(a, c)
        XCTAssertEqual(c.socketTimeout, 99)
        XCTAssertEqual(c.connectTimeout, 1)
    }

    // MARK: - ThetaRepository.GpsInfo

    func testGpsInfo_storesFields() {
        let g = ThetaRepository.GpsInfo(latitude: 35.6586, longitude: 139.7454, altitude: 12.5, dateTimeZone: "2025:01:02 03:04:05+09:00")
        XCTAssertEqual(g.latitude, 35.6586, accuracy: 0.0001)
        XCTAssertEqual(g.longitude, 139.7454, accuracy: 0.0001)
        XCTAssertEqual(g.altitude, 12.5, accuracy: 0.0001)
        XCTAssertEqual(g.dateTimeZone, "2025:01:02 03:04:05+09:00")
    }

    func testGpsInfo_realFixIsNotDisabled() {
        let g = ThetaRepository.GpsInfo(latitude: 35.6586, longitude: 139.7454, altitude: 12.5, dateTimeZone: "2025:01:02 03:04:05+09:00")
        XCTAssertFalse(g.isDisabled())
    }

    func testGpsInfo_equalityAndCopy() {
        let a = ThetaRepository.GpsInfo(latitude: 1, longitude: 2, altitude: 3, dateTimeZone: "tz")
        let b = ThetaRepository.GpsInfo(latitude: 1, longitude: 2, altitude: 3, dateTimeZone: "tz")
        let c = a.doCopy(latitude: 9, longitude: 2, altitude: 3, dateTimeZone: "tz")
        XCTAssertEqual(a, b)
        XCTAssertNotEqual(a, c)
        XCTAssertEqual(c.latitude, 9, accuracy: 0.0001)
    }

    // MARK: - ThetaRepository.BracketSetting / BracketSettingList

    func testBracketSetting_allNilByDefault() {
        let s = ThetaRepository.BracketSetting(aperture: nil, colorTemperature: nil, exposureCompensation: nil, exposureProgram: nil, iso: nil, shutterSpeed: nil, whiteBalance: nil)
        XCTAssertNil(s.aperture)
        XCTAssertNil(s.colorTemperature)
        XCTAssertNil(s.exposureCompensation)
        XCTAssertNil(s.exposureProgram)
        XCTAssertNil(s.iso)
        XCTAssertNil(s.shutterSpeed)
        XCTAssertNil(s.whiteBalance)
    }

    func testBracketSetting_keepsAssignedOptionsAndIsMutable() {
        let s = ThetaRepository.BracketSetting(aperture: nil, colorTemperature: KotlinInt(int: 5500), exposureCompensation: nil, exposureProgram: nil, iso: ThetaRepository.IsoEnum.iso200, shutterSpeed: nil, whiteBalance: nil)
        XCTAssertEqual(s.colorTemperature?.intValue, 5500)
        XCTAssertTrue(s.iso === ThetaRepository.IsoEnum.iso200)
        s.iso = ThetaRepository.IsoEnum.iso800
        XCTAssertTrue(s.iso === ThetaRepository.IsoEnum.iso800)
    }

    func testBracketSetting_equalityDependsOnFields() {
        func make(_ iso: ThetaRepository.IsoEnum?) -> ThetaRepository.BracketSetting {
            ThetaRepository.BracketSetting(aperture: nil, colorTemperature: nil, exposureCompensation: nil, exposureProgram: nil, iso: iso, shutterSpeed: nil, whiteBalance: nil)
        }
        XCTAssertEqual(make(ThetaRepository.IsoEnum.iso100), make(ThetaRepository.IsoEnum.iso100))
        XCTAssertNotEqual(make(ThetaRepository.IsoEnum.iso100), make(ThetaRepository.IsoEnum.iso200))
        XCTAssertNotEqual(make(nil), make(ThetaRepository.IsoEnum.iso100))
    }

    func testBracketSettingList_defaultIsUsableAndOriginalListInitKeepsOrder() {
        _ = ThetaRepository.BracketSettingList()
        let a = ThetaRepository.BracketSetting(aperture: nil, colorTemperature: nil, exposureCompensation: nil, exposureProgram: nil, iso: ThetaRepository.IsoEnum.iso100, shutterSpeed: nil, whiteBalance: nil)
        let b = ThetaRepository.BracketSetting(aperture: nil, colorTemperature: nil, exposureCompensation: nil, exposureProgram: nil, iso: ThetaRepository.IsoEnum.iso200, shutterSpeed: nil, whiteBalance: nil)
        let list = ThetaRepository.BracketSettingList(originalList: [a, b])
        XCTAssertEqual(list.list.count, 2)
        XCTAssertTrue(list.list[0] === a)
        XCTAssertTrue(list.list[1] === b)
    }

    // MARK: - Delay / bitrate value classes

    func testOffDelaySec_storesSecondsAndComparesByValue() {
        let a = ThetaRepository.OffDelaySec(sec: 600)
        XCTAssertEqual(a.sec_, 600)
        XCTAssertEqual(a, ThetaRepository.OffDelaySec(sec: 600))
        XCTAssertNotEqual(a, ThetaRepository.OffDelaySec(sec: 601))
    }

    func testSleepDelaySec_storesSecondsAndComparesByValue() {
        let a = ThetaRepository.SleepDelaySec(sec: 300)
        XCTAssertEqual(a.sec_, 300)
        XCTAssertEqual(a, ThetaRepository.SleepDelaySec(sec: 300))
        XCTAssertNotEqual(a, ThetaRepository.SleepDelaySec(sec: 1))
    }

    func testBitrateNumber_storesValueAndRawValue() {
        let b = ThetaRepository.BitrateNumber(value: 4096)
        XCTAssertEqual(b.value, 4096)
        XCTAssertEqual(b.rawValue, "4096")
    }

    func testBitrateNumberCompanion_rejectsNonNumericStrings() {
        XCTAssertNil(ThetaRepository.BitrateNumber.companion.get(str: "not-a-number"))
    }

    // MARK: - Proxy

    func testProxy_minimalInitialiserDefaultsOptionalFieldsToNil() {
        let p = ThetaRepository.Proxy(use: false)
        XCTAssertFalse(p.use)
        XCTAssertNil(p.url)
        XCTAssertNil(p.port)
        XCTAssertNil(p.userid)
        XCTAssertNil(p.password)
    }

    func testProxy_fullInitialiserAndCopy() {
        let p = ThetaRepository.Proxy(use: true, url: "proxy.example.test", port: KotlinInt(int: 8080), userid: "placeholder-user", password: "placeholder-pass")
        XCTAssertTrue(p.use)
        XCTAssertEqual(p.url, "proxy.example.test")
        XCTAssertEqual(p.port?.intValue, 8080)
        XCTAssertEqual(p.userid, "placeholder-user")
        let off = p.doCopy(use: false, url: p.url, port: p.port, userid: p.userid, password: p.password)
        XCTAssertFalse(off.use)
        XCTAssertNotEqual(p, off)
    }

    // MARK: - ThetaRepository.Config

    func testConfig_defaultInitialiserLeavesEverythingUnset() {
        let c = ThetaRepository.Config()
        XCTAssertNil(c.dateTime)
        XCTAssertNil(c.language)
        XCTAssertNil(c.offDelay)
        XCTAssertNil(c.sleepDelay)
        XCTAssertNil(c.shutterVolume)
        XCTAssertNil(c.clientMode)
    }

    func testConfig_fullInitialiserKeepsEveryField() {
        let auth = DigestAuth(username: "placeholder-user")
        let c = ThetaRepository.Config(
            dateTime: "2025:06:01 12:00:00+00:00",
            language: ThetaRepository.LanguageEnum.enUs,
            offDelay: ThetaRepository.OffDelaySec(sec: 600),
            sleepDelay: ThetaRepository.SleepDelaySec(sec: 300),
            shutterVolume: KotlinInt(int: 50),
            clientMode: auth
        )
        XCTAssertEqual(c.dateTime, "2025:06:01 12:00:00+00:00")
        XCTAssertTrue(c.language === ThetaRepository.LanguageEnum.enUs)
        XCTAssertEqual((c.offDelay as? ThetaRepository.OffDelaySec)?.sec_, 600)
        XCTAssertEqual((c.sleepDelay as? ThetaRepository.SleepDelaySec)?.sec_, 300)
        XCTAssertEqual(c.shutterVolume?.intValue, 50)
        XCTAssertTrue(c.clientMode === auth)
    }

    func testConfig_fieldsAreMutable() {
        let c = ThetaRepository.Config()
        c.language = ThetaRepository.LanguageEnum.ja
        c.shutterVolume = KotlinInt(int: 10)
        XCTAssertTrue(c.language === ThetaRepository.LanguageEnum.ja)
        XCTAssertEqual(c.shutterVolume?.intValue, 10)
    }

    func testConfig_doCopyChangesOnlyTheRequestedField() {
        let original = ThetaRepository.Config(dateTime: "d", language: ThetaRepository.LanguageEnum.fr, offDelay: nil, sleepDelay: nil, shutterVolume: KotlinInt(int: 1), clientMode: nil)
        let copy = original.doCopy(dateTime: "d2", language: original.language, offDelay: original.offDelay, sleepDelay: original.sleepDelay, shutterVolume: original.shutterVolume, clientMode: original.clientMode)
        XCTAssertEqual(copy.dateTime, "d2")
        XCTAssertTrue(copy.language === ThetaRepository.LanguageEnum.fr)
        XCTAssertEqual(original.dateTime, "d", "doCopy must not mutate the source")
    }

    // MARK: - TopBottomCorrectionRotation

    func testTopBottomCorrectionRotation_storesAngles() {
        let r = ThetaRepository.TopBottomCorrectionRotation(pitch: 1.5, roll: -2.5, yaw: 90)
        XCTAssertEqual(r.pitch, 1.5, accuracy: 0.0001)
        XCTAssertEqual(r.roll, -2.5, accuracy: 0.0001)
        XCTAssertEqual(r.yaw, 90, accuracy: 0.0001)
        XCTAssertEqual(r, ThetaRepository.TopBottomCorrectionRotation(pitch: 1.5, roll: -2.5, yaw: 90))
    }

    // MARK: - Kotlin number boxes

    func testKotlinNumberBoxes_roundTripValues() {
        XCTAssertEqual(KotlinInt(int: -7).intValue, -7)
        XCTAssertEqual(KotlinInt(int: Int32.max).intValue, Int(Int32.max))
        XCTAssertTrue(KotlinBoolean(bool: true).boolValue)
        XCTAssertFalse(KotlinBoolean(bool: false).boolValue)
        XCTAssertEqual(KotlinFloat(float: 1.25).floatValue, 1.25, accuracy: 0.0001)
    }
}
