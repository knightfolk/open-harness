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

func webbridgeRuntimeTrace(_ message: String) {
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
            webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: PASS wrote native probe fixtures under /tmp")
        } catch {
            webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: FAIL writing probe fixtures: \(error.localizedDescription)")
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
            webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: PASS requested hidden trusted navigation probe")
        } else {
            webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: FAIL could not find trusted bundle dist URL for navigation probe")
        }
    }
}
