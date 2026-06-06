import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        WebViewRepresentable()
            .ignoresSafeArea()
            .frame(minWidth: 900, minHeight: 600)
    }
}

struct WebViewRepresentable: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView {
        webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: PASS makeNSView lifecycle marker")

        let config = WKWebViewConfiguration()
        config.preferences = WKPreferences()

        let bridge = WebBridge.shared
        config.userContentController.add(bridge, name: "nativeBridge")

        let bridgeScript = WKUserScript(
            source: """
            window.NativeBridge = {
                send: function(action, payload) {
                    window.webkit.messageHandlers.nativeBridge.postMessage({
                        action: action,
                        payload: payload
                    });
                }
            };
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(bridgeScript)

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.setValue(false, forKey: "drawsBackground")
        webView.translatesAutoresizingMaskIntoConstraints = false

        // Store ref so bridge can call back into it
        WebBridge.shared.setWebView(webView)

        // Load the UI now (WebViewLoader handles bundled dist vs dev fallback)
        WebViewLoader.load(webView: webView)
        webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: PASS WebViewLoader.load returned")

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            context.coordinator.runNativeProbeIfEnabled(webView)
        }

        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        // No-op: content loaded once in makeNSView
    }

    func makeCoordinator() -> WebViewCoordinator {
        WebViewCoordinator()
    }
}

class WebViewCoordinator: NSObject, WKNavigationDelegate {
    var didRunNativeProbe = false
    var nativeProbeWebView: WKWebView?
    var nativeProbeNavigationWebView: WKWebView?

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.request.url?.absoluteString == "about:blank" {
            webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: PASS allowed about:blank bootstrap navigation")
            decisionHandler(.allow)
            return
        }

        if let url = navigationAction.request.url,
           navigationAction.targetFrame == nil {
            if WebBridge.isTrustedBridgeOrigin(url) {
                decisionHandler(.allow)
                return
            }
            webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: PASS blocked untrusted target-frame navigation to \(url.absoluteString)")
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        if let url = navigationAction.request.url, !WebBridge.isTrustedBridgeOrigin(url) {
            webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: PASS blocked untrusted in-frame navigation to \(url.absoluteString)")
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("WebView navigation failed: \(error.localizedDescription)")
        webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: FAIL navigation failed: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation: WKNavigation!, withError error: Error) {
        print("WebView provisional navigation failed: \(error.localizedDescription)")
        webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: FAIL provisional navigation failed: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("WebView finished loading: \(webView.url?.absoluteString ?? "nil")")
        webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: PASS didFinish navigation url=\(webView.url?.absoluteString ?? "nil")")

        // Check if React actually mounted
        webView.evaluateJavaScript("document.getElementById('root').innerHTML.length") { result, error in
            if let len = result as? Int {
                print("Root element content length: \(len)")
            }
            if let err = error {
                print("JS eval error: \(err.localizedDescription)")
            }
        }

        // Inject provider/model data
        let providers = BackendService.shared.providerRegistry.configuredProviders()
        let models = BackendService.shared.providerRegistry.allModels()

        let encoder = JSONEncoder()
        if let providersJSON = try? encoder.encode(providers),
           let modelsJSON = try? encoder.encode(models) {
            let providersStr = String(data: providersJSON, encoding: .utf8) ?? "[]"
            let modelsStr = String(data: modelsJSON, encoding: .utf8) ?? "[]"

            webView.evaluateJavaScript("""
            if (window.__OPENHARNESS_BOOT) {
                window.__OPENHARNESS_BOOT({
                    providers: \(providersStr),
                    models: \(modelsStr)
                });
            }
            """)
        }

        runNativeProbeIfEnabled(webView)
    }
}

// Helper to load the page
class WebViewLoader {
    static func trustedBundleDistURL() -> URL? {
        guard let exePath = Bundle.main.executablePath else {
            return nil
        }

        let exeDir = URL(fileURLWithPath: exePath).deletingLastPathComponent()
        let candidates = [
            exeDir.appendingPathComponent("OpenHarnessApp_OpenHarnessApp.bundle/Resources"),
            exeDir.appendingPathComponent("OpenHarnessApp_OpenHarnessApp.bundle"),
            exeDir.appendingPathComponent("Resources"),
        ]

        for base in candidates {
            let htmlURL = base.appendingPathComponent("dist/index.html")
            if FileManager.default.fileExists(atPath: htmlURL.path) {
                return base.appendingPathComponent("dist")
            }
        }

        return nil
    }

    static func load(webView: WKWebView) {
        // Try loading bundled React app via inline HTML (avoids ES module CORS issues with file://)
        guard let exePath = Bundle.main.executablePath else {
            print("No executable path — falling back to dev server")
            webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: FAIL no executable path; falling back to dev server")
            _loadDev(webView)
            return
        }

        let exeDir = URL(fileURLWithPath: exePath).deletingLastPathComponent()
        let candidates = [
            exeDir.appendingPathComponent("OpenHarnessApp_OpenHarnessApp.bundle/Resources"),
            exeDir.appendingPathComponent("OpenHarnessApp_OpenHarnessApp.bundle"),
            exeDir.appendingPathComponent("Resources"),
        ]

        for base in candidates {
            let htmlURL = base.appendingPathComponent("dist/index.html")
            let jsDir = base.appendingPathComponent("dist/assets")

            if FileManager.default.fileExists(atPath: htmlURL.path) {
                webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: PASS found bundled dist at \(htmlURL.path)")
                // Read the JS files and inject them inline to bypass file:// CORS
                guard let htmlContent = try? String(contentsOf: htmlURL, encoding: .utf8) else {
                    print("Could not read index.html")
                    webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: FAIL could not read bundled index.html at \(htmlURL.path)")
                    _loadDev(webView)
                    return
                }

                // Find JS file
                let jsFiles = (try? FileManager.default.contentsOfDirectory(atPath: jsDir.path)) ?? []
                var jsContent = ""

                for file in jsFiles where file.hasSuffix(".js") {
                    let jsPath = jsDir.appendingPathComponent(file)
                    if let content = try? String(contentsOf: jsPath, encoding: .utf8) {
                        jsContent += content + "\n"
                    }
                }

                // Read CSS file too
                var cssHref = ""
                for file in jsFiles where file.hasSuffix(".css") {
                    cssHref = "./assets/\(file)"
                    break
                }

                // Build a self-contained HTML that doesn't need ES module loading
                let inlinedHTML = """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>OpenHarness — Agent Desktop</title>
                    <style>html { background: #0d0f11; }</style>
                    <link rel="stylesheet" href="\(cssHref)">
                </head>
                <body>
                    <div id="root"></div>
                    <script>\(jsContent)</script>
                </body>
                </html>
                """

                // Load with base URL so CSS relative paths resolve
                webView.loadHTMLString(inlinedHTML, baseURL: base.appendingPathComponent("dist"))
                webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: PASS requested bundled inline HTML load")
                print("Loaded inlined React UI from bundle")
                return
            }
        }

        // No bundled dist found — use dev server
        webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: PASS no bundled dist found; loading dev server")
        _loadDev(webView)
    }

    static func _loadDev(_ webView: WKWebView) {
        let devURL = URL(string: "http://localhost:5173")!
        print("Loading dev UI from: \(devURL.absoluteString)")
        webbridgeRuntimeTrace("WEBBRIDGE_RUNTIME_PROBE: PASS requested dev UI load \(devURL.absoluteString)")
        webView.load(URLRequest(url: devURL))
    }
}
