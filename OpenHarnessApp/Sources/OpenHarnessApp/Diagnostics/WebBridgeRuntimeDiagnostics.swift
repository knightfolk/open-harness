import Foundation
import WebKit

enum WebBridgeRuntimeProbe {
    static var isEnabled: Bool {
#if DEBUG
        let environment = ProcessInfo.processInfo.environment
        let arguments = ProcessInfo.processInfo.arguments
        return environment["OPENHARNESS_WEBBRIDGE_RUNTIME_PROBE"] == "1"
            || arguments.contains("--webbridge-runtime-probe")
#else
        return false
#endif
    }
}

enum WebBridgeRuntimeDiagnostics {
    static func appStructInitialized() {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS app struct init marker")
    }

    static func appLaunched() {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS app launch marker")
    }

    static func webViewCreated() {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS makeNSView lifecycle marker")
    }

    static func webViewLoaderReturned() {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS WebViewLoader.load returned")
    }

    static func allowedAboutBlankBootstrapNavigation() {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS allowed about:blank bootstrap navigation")
    }

    static func blockedUntrustedTargetFrameNavigation(to url: URL) {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS blocked untrusted target-frame navigation to \(url.absoluteString)")
    }

    static func blockedUntrustedInFrameNavigation(to url: URL) {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS blocked untrusted in-frame navigation to \(url.absoluteString)")
    }

    static func navigationFailed(_ error: Error) {
        trace("WEBBRIDGE_RUNTIME_PROBE: FAIL navigation failed: \(error.localizedDescription)")
    }

    static func provisionalNavigationFailed(_ error: Error) {
        trace("WEBBRIDGE_RUNTIME_PROBE: FAIL provisional navigation failed: \(error.localizedDescription)")
    }

    static func navigationFinished(urlDescription: String) {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS didFinish navigation url=\(urlDescription)")
    }

    static func deniedUntrustedBridgeMessage(action: String, callbackID: String?, url: URL) {
        if let callbackID {
            trace("WEBBRIDGE_RUNTIME_PROBE: PASS untrusted-origin bridge callback error action=\(action) callbackId=\(callbackID) url=\(url.absoluteString)")
        } else {
            trace("WEBBRIDGE_RUNTIME_PROBE: PASS untrusted-origin bridge no-callback case action=\(action) url=\(url.absoluteString)")
        }
    }

    static func noExecutablePathForWebViewLoad() {
        trace("WEBBRIDGE_RUNTIME_PROBE: FAIL no executable path; falling back to dev server")
    }

    static func foundBundledDist(at path: String) {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS found bundled dist at \(path)")
    }

    static func couldNotReadBundledIndex(at path: String) {
        trace("WEBBRIDGE_RUNTIME_PROBE: FAIL could not read bundled index.html at \(path)")
    }

    static func requestedBundledInlineHTMLLoad() {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS requested bundled inline HTML load")
    }

    static func noBundledDistFound() {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS no bundled dist found; loading dev server")
    }

    static func requestedDevUILoad(_ url: URL) {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS requested dev UI load \(url.absoluteString)")
    }

    static func wroteNativeProbeFixtures() {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS wrote native probe fixtures under /tmp")
    }

    static func failedToWriteNativeProbeFixtures(_ error: Error) {
        trace("WEBBRIDGE_RUNTIME_PROBE: FAIL writing probe fixtures: \(error.localizedDescription)")
    }

    static func requestedHiddenTrustedNavigationProbe() {
        trace("WEBBRIDGE_RUNTIME_PROBE: PASS requested hidden trusted navigation probe")
    }

    static func couldNotFindTrustedBundleDistURLForNavigationProbe() {
        trace("WEBBRIDGE_RUNTIME_PROBE: FAIL could not find trusted bundle dist URL for navigation probe")
    }

    private static func trace(_ message: String) {
        guard WebBridgeRuntimeProbe.isEnabled else { return }

        NSLog(message)
        let line = "\(Date()) | \(message)\n"
        fputs(line, stderr)
        let traceURLs = [
            URL(fileURLWithPath: "/tmp/webbridge-runtime-probe-trace.log"),
            FileManager.default.temporaryDirectory.appendingPathComponent("webbridge-runtime-probe-trace.log"),
            URL(fileURLWithPath: NSHomeDirectory())
                .appendingPathComponent("Library/Logs/OpenHarness/webbridge-runtime-probe-trace.log"),
        ]
        if let data = line.data(using: .utf8) {
            for traceURL in traceURLs {
                try? FileManager.default.createDirectory(
                    at: traceURL.deletingLastPathComponent(),
                    withIntermediateDirectories: true
                )
                if FileManager.default.fileExists(atPath: traceURL.path) {
                    if let handle = try? FileHandle(forWritingTo: traceURL) {
                        _ = try? handle.seekToEnd()
                        try? handle.write(contentsOf: data)
                        try? handle.close()
                    }
                } else {
                    try? data.write(to: traceURL)
                }
            }
        }
    }
}

extension WebViewCoordinator {
    func runNativeProbeIfEnabled(_ webView: WKWebView) {
        guard WebBridgeRuntimeProbe.isEnabled else { return }
        guard !didRunNativeProbe else { return }
        didRunNativeProbe = true

        let probePath = URL(fileURLWithPath: "/tmp/webbridge-native-probe-target.html")
        let probeHTML = """
        <!doctype html>
        <html>
        <body>
            <h1>OpenHarness Native Runtime Probe</h1>
            <script>
                window.webkit.messageHandlers.nativeBridge.postMessage({
                    action: "sendMessage",
                    payload: {
                        callbackId: "probe-callback-when-untrusted",
                        sessionId: "probe-session",
                        content: "probe with callback"
                    }
                });

                window.webkit.messageHandlers.nativeBridge.postMessage({
                    action: "sendMessage",
                    payload: {
                        sessionId: "probe-session",
                        content: "probe without callback"
                    }
                });

                var probeFrame = document.createElement("iframe");
                probeFrame.src = "file:///tmp/webbridge-runtime-probe-main-frame.html";
                probeFrame.style.display = "none";
                document.body.appendChild(probeFrame);

                setTimeout(() => {
                    const anchor = document.createElement("a");
                    anchor.href = "file:///tmp/webbridge-runtime-probe-main-frame.html";
                    anchor.target = "_blank";
                    anchor.click();
                }, 400);

                setTimeout(() => {
                    window.location.href = "file:///tmp/webbridge-runtime-probe-main-frame.html";
                }, 800);
            </script>
        </body>
        </html>
        """

        let targetPath = URL(fileURLWithPath: "/tmp/webbridge-runtime-probe-main-frame.html")
        let targetHTML = """
        <!doctype html>
        <html><body><h1>Untrusted Probe Target</h1></body></html>
        """

        do {
            try probeHTML.write(to: probePath, atomically: true, encoding: .utf8)
            try targetHTML.write(to: targetPath, atomically: true, encoding: .utf8)
            WebBridgeRuntimeDiagnostics.wroteNativeProbeFixtures()
        } catch {
            WebBridgeRuntimeDiagnostics.failedToWriteNativeProbeFixtures(error)
            return
        }

        let probeConfig = WKWebViewConfiguration()
        probeConfig.userContentController.add(WebBridge.shared, name: "nativeBridge")
        let probeWebView = WKWebView(frame: .zero, configuration: probeConfig)
        nativeProbeWebView = probeWebView
        probeWebView.loadFileURL(probePath, allowingReadAccessTo: probePath.deletingLastPathComponent())

        if let trustedBaseURL = WebViewLoader.trustedBundleDistURL() {
            let navigationConfig = WKWebViewConfiguration()
            let navigationWebView = WKWebView(frame: .zero, configuration: navigationConfig)
            navigationWebView.navigationDelegate = self
            nativeProbeNavigationWebView = navigationWebView
            navigationWebView.loadHTMLString("""
            <!doctype html>
            <html>
            <body>
                <h1>Trusted Navigation Runtime Probe</h1>
                <script>
                    setTimeout(() => {
                        const probeFrame = document.createElement("iframe");
                        probeFrame.src = "file:///tmp/webbridge-runtime-probe-main-frame.html";
                        probeFrame.style.display = "none";
                        document.body.appendChild(probeFrame);
                    }, 100);

                    setTimeout(() => {
                        const anchor = document.createElement("a");
                        anchor.href = "file:///tmp/webbridge-runtime-probe-main-frame.html";
                        anchor.target = "_blank";
                        anchor.click();
                    }, 400);

                    setTimeout(() => {
                        window.location.href = "file:///tmp/webbridge-runtime-probe-main-frame.html";
                    }, 800);
                </script>
            </body>
            </html>
            """, baseURL: trustedBaseURL)
            WebBridgeRuntimeDiagnostics.requestedHiddenTrustedNavigationProbe()
        } else {
            WebBridgeRuntimeDiagnostics.couldNotFindTrustedBundleDistURLForNavigationProbe()
        }
    }
}
