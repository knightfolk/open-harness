import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        WebViewRepresentable()
            .ignoresSafeArea()
    }
}

// MARK: - WKWebView Wrapper

struct WebViewRepresentable: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.preferences = WKPreferences()
        config.preferences.isElementFullscreenEnabled = true

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

        // Load the bundled React app
        if let resourceURL = Bundle.main.resourceURL {
            let htmlURL = resourceURL.appendingPathComponent("dist/index.html")
            if FileManager.default.fileExists(atPath: htmlURL.path) {
                webView.loadFileURL(htmlURL, allowingReadAccessTo: resourceURL)
            } else {
                // Dev mode: load from localhost
                if let url = URL(string: "http://localhost:5173") {
                    webView.load(URLRequest(url: url))
                }
            }
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
        // Open external links in the default browser
        if let url = navigationAction.request.url,
           navigationAction.targetFrame == nil {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Inject provider/model data once the page loads
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
