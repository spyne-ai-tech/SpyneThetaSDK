import XCTest
import THETAClient

/// Kotlin exception hierarchy as exported to Swift. These are constructed locally and never thrown across a network.
final class ExceptionTypeTests: XCTestCase {

    func testThrowable_messageAndCause() {
        let inner = KotlinThrowable(message: "inner")
        let outer = KotlinThrowable(message: "outer", cause: inner)
        XCTAssertEqual(outer.message, "outer")
        XCTAssertTrue(outer.cause === inner)
        XCTAssertNil(inner.cause)
    }

    func testThrowable_messageIsNilWhenNotProvided() {
        XCTAssertNil(KotlinThrowable().message)
        XCTAssertNil(KotlinThrowable(cause: nil).message)
    }

    func testThetaRepositoryException_preservesMessage() {
        // ThetaRepositoryException is abstract in Kotlin (cannot be instantiated), so read the message through a concrete subclass typed as the base.
        let e: ThetaRepository.ThetaRepositoryException = ThetaRepository.ArgumentException(message: "camera said no")
        XCTAssertEqual(e.message, "camera said no")
    }

    func testEveryThetaException_preservesItsMessage() {
        XCTAssertEqual(ThetaRepository.NotConnectedException(message: "nc").message, "nc")
        XCTAssertEqual(ThetaRepository.ThetaWebApiException(message: "web").message, "web")
        XCTAssertEqual(ThetaRepository.ArgumentException(message: "arg").message, "arg")
        XCTAssertEqual(ThetaRepository.ThetaUnauthorizedException(message: "auth").message, "auth")
    }

    func testEveryThetaException_isAThetaRepositoryException() {
        let all: [KotlinThrowable] = [
            ThetaRepository.NotConnectedException(message: "a"),
            ThetaRepository.ThetaWebApiException(message: "b"),
            ThetaRepository.ArgumentException(message: "c"),
            ThetaRepository.ThetaUnauthorizedException(message: "d"),
        ]
        for e in all {
            XCTAssertTrue(e is ThetaRepository.ThetaRepositoryException, "\(type(of: e)) must derive from ThetaRepositoryException")
        }
    }

    func testThetaRepositoryException_derivesFromKotlinRuntimeExceptionAndThrowable() {
        // ThetaRepositoryException is abstract in Kotlin; check the chain through a concrete subclass.
        let e: AnyObject = ThetaRepository.ArgumentException(message: "x")
        XCTAssertTrue(e is KotlinRuntimeException)
        XCTAssertTrue(e is KotlinException)
        XCTAssertTrue(e is KotlinThrowable)
    }

    func testSiblingExceptionsAreDistinctTypes() {
        let nc: AnyObject = ThetaRepository.NotConnectedException(message: "x")
        let wa: AnyObject = ThetaRepository.ThetaWebApiException(message: "x")
        XCTAssertFalse(nc is ThetaRepository.ThetaWebApiException)
        XCTAssertFalse(wa is ThetaRepository.NotConnectedException)
        XCTAssertFalse(wa is ThetaRepository.ThetaUnauthorizedException)
    }

    func testExceptionMessageSurvivesUnicode() {
        let msg = "THETA \u{30AB}\u{30E1}\u{30E9} \u{1F4F7} not reachable"
        XCTAssertEqual(ThetaRepository.NotConnectedException(message: msg).message, msg)
    }
}
