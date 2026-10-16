import XCTest
import THETAClient

/// Pure helpers in the HTTP layer: URL parsing and digest-auth header construction. No sockets are opened.
final class HttpHelperTests: XCTestCase {

    // MARK: - BaseHttpClient.URL

    func testURL_defaultPortConstant() {
        XCTAssertEqual(BaseHttpClient.URLCompanion.shared.DEFAULT_PORT, 80)
    }

    func testURL_parsesHostPathAndDefaultPort() {
        let u = BaseHttpClient.URL(url: "http://192.168.1.1/osc/info")
        XCTAssertEqual(u.host, "192.168.1.1")
        XCTAssertEqual(u.path, "/osc/info")
        XCTAssertEqual(u.port, BaseHttpClient.URL.companion.DEFAULT_PORT)
    }

    func testURL_parsesExplicitPort() {
        let u = BaseHttpClient.URL(url: "http://192.168.1.1:8080/osc/commands/execute")
        XCTAssertEqual(u.host, "192.168.1.1")
        XCTAssertEqual(u.port, 8080)
        XCTAssertEqual(u.path, "/osc/commands/execute")
    }

    func testURL_fieldsAreMutable() {
        let u = BaseHttpClient.URL(url: "http://192.168.1.1/a")
        u.host = "10.0.0.5"
        u.port = 9000
        u.path = "/b"
        XCTAssertEqual(u.host, "10.0.0.5")
        XCTAssertEqual(u.port, 9000)
        XCTAssertEqual(u.path, "/b")
    }

    // MARK: - DigestAuth

    func testDigestAuth_usernameOnlyInitialiser() {
        let a = DigestAuth(username: "placeholder-user")
        XCTAssertEqual(a.username, "placeholder-user")
        XCTAssertEqual(a.password, "", "password is expected to default to the empty string")
    }

    func testDigestAuth_usernameAndPasswordInitialiser() {
        let a = DigestAuth(username: "placeholder-user", password: "placeholder-pass")
        XCTAssertEqual(a.username, "placeholder-user")
        XCTAssertEqual(a.password, "placeholder-pass")
    }

    func testDigestAuth_nilPasswordFallsBackToEmpty() {
        let a = DigestAuth(username: "placeholder-user", password: nil)
        XCTAssertEqual(a.password, "")
    }

    func testDigestAuth_headerIsADigestSchemeAndEchoesInputs() {
        // Challenge values below are the public RFC 2617 example, not a real credential.
        let a = DigestAuth(username: "Mufasa", password: "Circle Of Life")
        a.setAuthHeaderInfo(realm: "testrealm@host.com", nonce: "dcd98b7102dd2f0e8b11d0f600bfb0c093", qop: "auth")
        let header = a.makeDigestHeader(uri: "/dir/index.html", method: "GET")
        XCTAssertTrue(header.hasPrefix("Digest "), "expected a Digest scheme header, got a different prefix")
        XCTAssertTrue(header.contains("username=\"Mufasa\""))
        XCTAssertTrue(header.contains("realm=\"testrealm@host.com\""))
        XCTAssertTrue(header.contains("uri=\"/dir/index.html\""))
        XCTAssertFalse(header.contains("Circle Of Life"), "the clear-text password must never appear in the header")
    }

    func testDigestAuth_headerResponseDependsOnMethod() {
        let a = DigestAuth(username: "Mufasa", password: "Circle Of Life")
        a.setAuthHeaderInfo(realm: "testrealm@host.com", nonce: "dcd98b7102dd2f0e8b11d0f600bfb0c093", qop: "auth")
        let get = a.makeDigestHeader(uri: "/x", method: "GET")
        let post = a.makeDigestHeader(uri: "/x", method: "POST")
        XCTAssertNotEqual(get, post)
    }

    // MARK: - Platform / Greeting (generated sample classes shipped in the framework)

    func testPlatformAndGreetingAreNonEmpty() {
        XCTAssertFalse(Platform().platform.isEmpty)
        XCTAssertFalse(Greeting().greeting().isEmpty)
    }

    func testPlatformReportsIOS() {
        XCTAssertTrue(Platform().platform.hasPrefix("iOS"), "Platform.platform is expected to start with iOS on an iOS simulator/device")
    }
}
