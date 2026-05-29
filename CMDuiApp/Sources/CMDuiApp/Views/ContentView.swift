import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        WebViewRepresentable()
            .ignoresSafeArea()
    }
}

struct WebViewRepresentable: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.preferences = WKPreferences()

        // Register the Swift ↔ JS bridge
        let bridge = WebBridge.shared
        config.userContentController.add(bridge, name: "nativeBridge")

        // Inject bridge setup script
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

        // Find the bundled dist/index.html
        // SPM packages resources into a <target>.bundle with a Resources/ subdirectory
        var loaded = false
        guard let exePath = Bundle.main.executablePath else { return webView }
        let exeDir = URL(fileURLWithPath: exePath).deletingLastPathComponent()
        let candidateBases = [
            exeDir.appendingPathComponent("CMDuiApp_CMDuiApp.bundle/Resources"),
            exeDir.appendingPathComponent("CMDuiApp_CMDuiApp.bundle"),
            exeDir.appendingPathComponent("Resources"),
        ]
        for base in candidateBases {
            let htmlURL = base.appendingPathComponent("dist/index.html")
            if FileManager.default.fileExists(atPath: htmlURL.path) {
                print("Loading bundled UI from: \(htmlURL.path)")
                webView.loadFileURL(htmlURL, allowingReadAccessTo: base)
                loaded = true
                break
            }
        }

        // Fallback: dev mode from localhost
        if !loaded {
            let devURL = URL(string: "http://localhost:5173")!
            print("Loading dev UI from: \(devURL.absoluteString)")
            webView.load(URLRequest(url: devURL))
        }

        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    func makeCoordinator() -> WebViewCoordinator {
        WebViewCoordinator()
    }
}

class WebViewCoordinator: NSObject, WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url,
           navigationAction.targetFrame == nil {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("WebView navigation failed: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation: WKNavigation!, withError error: Error) {
        print("WebView provisional navigation failed: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("WebView finished loading")

        // Inject provider/model data
        let providers = BackendService.shared.providerRegistry.configuredProviders()
        let models = BackendService.shared.providerRegistry.allModels()

        let encoder = JSONEncoder()
        if let providersJSON = try? encoder.encode(providers),
           let modelsJSON = try? encoder.encode(models) {
            let providersStr = String(data: providersJSON, encoding: .utf8) ?? "[]"
            let modelsStr = String(data: modelsJSON, encoding: .utf8) ?? "[]"

            webView.evaluateJavaScript("""
            if (window.__CMDUI_BOOT) {
                window.__CMDUI_BOOT({
                    providers: \(providersStr),
                    models: \(modelsStr)
                });
            }
            """)
        }
    }
}
