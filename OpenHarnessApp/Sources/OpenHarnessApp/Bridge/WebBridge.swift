import Foundation
import WebKit

class WebBridge: NSObject, WKScriptMessageHandler {
    static let shared = WebBridge()
    private var webView: WKWebView?
    private var trustedWorkspaces: Set<String> = []
    private let allowedActions: Set<String> = [
        "sendMessage",
        "listSessions",
        "createSession",
        "getSession",
        "deleteSession",
        "listDirectory",
        "readFile",
        "openFolder",
        "getProviders",
        "getModels",
        "setModel",
        "setProviderKey",
    ]

    static func isTrustedBridgeOrigin(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        if scheme == "file" {
            let normalizedPath = URL(fileURLWithPath: url.path).standardized.path.lowercased()
            let bundlePath = Bundle.main.bundlePath.lowercased()
            return normalizedPath.hasPrefix(bundlePath + "/")
                && (normalizedPath.contains("/openharnessapp_openharnessapp.bundle/resources/dist")
                    || normalizedPath.contains("/resources/dist"))
        }
        if scheme == "http" || scheme == "https" {
            #if !DEBUG
            return false
            #else
            let host = url.host?.lowercased()
            return (host == "localhost" || host == "127.0.0.1") && (url.port == 5173 || url.port == nil)
            #endif
        }
        return false
    }

    func setWebView(_ webView: WKWebView) {
        self.webView = webView
    }

    // MARK: - Receiving messages from JS

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard
            message.name == "nativeBridge",
            message.frameInfo.isMainFrame,
            let messageURL = message.frameInfo.request.url,
            WebBridge.isTrustedBridgeOrigin(messageURL),
            let body = message.body as? [String: Any],
            let action = body["action"] as? String,
            allowedActions.contains(action)
        else {
            if message.name == "nativeBridge",
               let messageURL = message.frameInfo.request.url,
               let body = message.body as? [String: Any],
               let action = body["action"] as? String {
                if let payload = body["payload"] as? [String: Any],
                   let callbackID = payload["callbackId"] as? String {
                    WebBridgeRuntimeDiagnostics.deniedUntrustedBridgeMessage(action: action, callbackID: callbackID, url: messageURL)
                    reply(callbackID: callbackID, data: ["error": "Bridge access denied"])
                } else {
                    WebBridgeRuntimeDiagnostics.deniedUntrustedBridgeMessage(action: action, callbackID: nil, url: messageURL)
                }
                return
            }
            if let body = (message.body as? [String: Any]),
               let payload = body["payload"] as? [String: Any],
               let callbackID = payload["callbackId"] as? String {
                reply(callbackID: callbackID, data: ["error": "Bridge access denied"])
            }
            return
        }

        let payload = body["payload"] as? [String: Any] ?? [:]
        let callbackID = payload["callbackId"] as? String

        switch action {
        case "sendMessage":
            handleSendMessage(payload, callbackID: callbackID)
        case "listSessions":
            handleListSessions(callbackID: callbackID)
        case "createSession":
            handleCreateSession(payload, callbackID: callbackID)
        case "getSession":
            handleGetSession(payload, callbackID: callbackID)
        case "deleteSession":
            handleDeleteSession(payload, callbackID: callbackID)
        case "listDirectory":
            handleListDirectory(payload, callbackID: callbackID)
        case "readFile":
            handleReadFile(payload, callbackID: callbackID)
        case "openFolder":
            handleOpenFolder(callbackID: callbackID)
        case "getProviders":
            handleGetProviders(callbackID: callbackID)
        case "getModels":
            handleGetModels(callbackID: callbackID)
        case "setModel":
            handleSetModel(payload, callbackID: callbackID)
        case "setProviderKey":
            handleSetProviderKey(payload, callbackID: callbackID)
        default:
            break
        }
    }

    // MARK: - Send event to JS

    func sendEvent(_ event: String, data: [String: Any] = [:]) {
        let jsonData = try? JSONSerialization.data(withJSONObject: data)
        let jsonString = jsonData.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        let escapedEvent = jsonStringEscapedJSLiteral(event)

        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript("""
            if (window.__OPENHARNESS_EVENT) {
                window.__OPENHARNESS_EVENT('\(escapedEvent)', \(jsonString));
            }
            """)
        }
    }

    // MARK: - Reply to a specific callback

    private func reply(callbackID: String?, data: [String: Any]) {
        guard let id = callbackID else { return }
        let jsonData = try? JSONSerialization.data(withJSONObject: data)
        let jsonString = jsonData.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        let escapedID = jsonStringEscapedJSLiteral(id)

        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript("""
            if (window.__OPENHARNESS_CALLBACK) {
                window.__OPENHARNESS_CALLBACK('\(escapedID)', \(jsonString));
            }
            """)
        }
    }

    private func replyError(_ callbackID: String?, message: String) {
        reply(callbackID: callbackID, data: ["error": message])
    }

    private func registerWorkspaceRoot(_ path: String) -> Bool {
        let normalized = normalizedWorkspacePath(path)
        guard let normalized else { return false }
        trustedWorkspaces.insert(normalized)
        return true
    }

    private func normalizedWorkspacePath(_ path: String) -> String? {
        let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let url = URL(fileURLWithPath: trimmed).standardizedFileURL.resolvingSymlinksInPath()
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory),
              isDirectory.boolValue else { return nil }
        return url.path
    }

    private func normalizeCandidatePath(_ path: String) -> String? {
        let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return URL(fileURLWithPath: trimmed).standardizedFileURL.resolvingSymlinksInPath().path
    }

    private func ensurePathUnderAllowedWorkspace(_ path: String) -> String? {
        guard let normalized = normalizeCandidatePath(path),
              isPathAllowed(normalized) else { return nil }
        return normalized
    }

    private func isPathAllowed(_ normalizedPath: String) -> Bool {
        guard !trustedWorkspaces.isEmpty else { return false }
        let needle = normalizedPath.lowercased()
        return trustedWorkspaces.contains { root in
            let candidate = root.lowercased()
            return needle == candidate || needle.hasPrefix(candidate + "/")
        }
    }

    private func resolveSessionWorkspacePath(from payload: [String: Any]) -> String? {
        if let path = payload["path"] as? String {
            return path
        }
        if let sessionId = payload["sessionId"] as? String,
           let workingDir = BackendService.shared.getSession(id: sessionId)?.workingDir {
            return workingDir
        }
        return nil
    }

    private func jsonStringEscapedJSLiteral(_ value: String) -> String {
        return value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
    }

    // MARK: - Handlers

    private func handleSendMessage(_ payload: [String: Any], callbackID: String?) {
        guard let sessionID = payload["sessionId"] as? String,
              let content = payload["content"] as? String else { return }

        let backend = BackendService.shared
        let modelID = payload["modelId"] as? String ?? backend.providerRegistry.activeModelID

        // Send user message event immediately
        let userMsgID = UUID().uuidString
        sendEvent("user_message", data: [
            "id": userMsgID,
            "role": "user",
            "content": content,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
        ])

        let assistantID = UUID().uuidString
        sendEvent("assistant_start", data: ["id": assistantID, "role": "assistant"])

        // Stream the response
        Task {
            do {
                let messages = backend.getMessages(for: sessionID)
                var allMessages = messages.map { ["role": $0.role, "content": $0.content] }
                allMessages.append(["role": "user", "content": content])

                let stream = try await backend.providerRegistry.stream(
                    modelID: modelID,
                    messages: allMessages,
                    workingDir: backend.getWorkingDir(for: sessionID)
                )

                for try await event in stream {
                    switch event {
                    case .contentDelta(let text):
                        sendEvent("text", data: ["id": assistantID, "text": text])
                    case .toolUseDelta(let id, let inputDelta):
                        sendEvent("tool_call_delta", data: ["id": id, "inputDelta": inputDelta])
                    case .toolUseStart(let id, let name, let input):
                        sendEvent("tool_call", data: ["id": id, "name": name, "status": "running", "input": input ?? ""])
                    case .toolUseStop(let id, let output):
                        sendEvent("tool_call", data: ["id": id, "status": "complete", "output": output ?? ""])
                    case .thinkingDelta(let text):
                        sendEvent("thinking", data: ["id": assistantID, "text": text])
                    case .complete:
                        sendEvent("done", data: ["id": assistantID])
                    case .error(let message):
                        sendEvent("error", data: ["error": message])
                    }
                }

                // Save message
                backend.saveMessage(sessionID: sessionID, role: "user", content: content)
                // assistant content is accumulated on the JS side

            } catch {
                sendEvent("error", data: ["error": error.localizedDescription])
            }
        }
    }

    private func handleListSessions(callbackID: String?) {
        let sessions = BackendService.shared.listSessions()
        reply(callbackID: callbackID, data: ["sessions": sessions.map { [
            "id": $0.id,
            "title": $0.title,
            "workingDir": $0.workingDir as Any,
            "createdAt": ISO8601DateFormatter().string(from: $0.createdAt),
            "updatedAt": ISO8601DateFormatter().string(from: $0.updatedAt),
            "preview": $0.messages.last?.content.prefix(80) ?? "",
            "messageCount": $0.messages.count,
        ]}])
    }

    private func handleCreateSession(_ payload: [String: Any], callbackID: String?) {
        let title = payload["title"] as? String ?? "New Session"
        if let requestedDir = payload["workingDir"] as? String {
            guard let normalizedDir = normalizedWorkspacePath(requestedDir) else {
                replyError(callbackID, message: "Invalid workingDir")
                return
            }
            guard isPathAllowed(normalizedDir) else {
                replyError(callbackID, message: "Open the folder before creating a session in it")
                return
            }
            let session = BackendService.shared.createSession(title: title, workingDir: normalizedDir)
            reply(callbackID: callbackID, data: [
                "id": session.id,
                "title": session.title,
                "workingDir": session.workingDir as Any,
                "messages": [],
                "createdAt": ISO8601DateFormatter().string(from: session.createdAt),
                "updatedAt": ISO8601DateFormatter().string(from: session.updatedAt),
            ])
            return
        }
        let session = BackendService.shared.createSession(title: title, workingDir: nil)
        reply(callbackID: callbackID, data: [
            "id": session.id,
            "title": session.title,
            "workingDir": session.workingDir as Any,
            "messages": [],
            "createdAt": ISO8601DateFormatter().string(from: session.createdAt),
            "updatedAt": ISO8601DateFormatter().string(from: session.updatedAt),
        ])
    }

    private func handleGetSession(_ payload: [String: Any], callbackID: String?) {
        guard let id = payload["id"] as? String,
              let session = BackendService.shared.getSession(id: id) else {
            reply(callbackID: callbackID, data: ["error": "Session not found"])
            return
        }
        reply(callbackID: callbackID, data: [
            "id": session.id,
            "title": session.title,
            "workingDir": session.workingDir as Any,
            "messages": session.messages.map { [
                "id": $0.id,
                "role": $0.role,
                "content": $0.content,
                "timestamp": ISO8601DateFormatter().string(from: $0.timestamp),
            ]},
            "createdAt": ISO8601DateFormatter().string(from: session.createdAt),
            "updatedAt": ISO8601DateFormatter().string(from: session.updatedAt),
        ])
    }

    private func handleDeleteSession(_ payload: [String: Any], callbackID: String?) {
        if let id = payload["id"] as? String {
            BackendService.shared.deleteSession(id: id)
        }
        reply(callbackID: callbackID, data: [:])
    }

    private func handleListDirectory(_ payload: [String: Any], callbackID: String?) {
        guard let path = resolveSessionWorkspacePath(from: payload),
              let allowedPath = ensurePathUnderAllowedWorkspace(path) else {
            replyError(callbackID, message: "Path is not allowed")
            return
        }
        let entries = FileSystemService.listDirectory(path: allowedPath)
        reply(callbackID: callbackID, data: ["path": allowedPath, "entries": entries])
    }

    private func handleReadFile(_ payload: [String: Any], callbackID: String?) {
        guard let path = resolveSessionWorkspacePath(from: payload),
              let allowedPath = ensurePathUnderAllowedWorkspace(path) else {
            replyError(callbackID, message: "Path is not allowed")
            return
        }
        let result = FileSystemService.readFile(path: allowedPath)
        reply(callbackID: callbackID, data: result)
    }

    private func handleOpenFolder(callbackID: String?) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.prompt = "Open Folder"

        if panel.runModal() == .OK,
           let url = panel.url,
           let normalized = normalizedWorkspacePath(url.path) {
            _ = registerWorkspaceRoot(normalized)
            reply(callbackID: callbackID, data: ["path": normalized])
        } else {
            reply(callbackID: callbackID, data: ["path": NSNull()])
        }
    }

    private func handleGetProviders(callbackID: String?) {
        let providers = BackendService.shared.providerRegistry.configuredProviders()
        let encoded = providers.map { ["id": $0.id, "name": $0.name, "type": $0.type.rawValue] }
        reply(callbackID: callbackID, data: ["providers": encoded])
    }

    private func handleGetModels(callbackID: String?) {
        let models = BackendService.shared.providerRegistry.allModels()
        let encoded = models.map { ["id": $0.id, "name": $0.name, "providerID": $0.providerID] }
        reply(callbackID: callbackID, data: ["models": encoded])
    }

    private func handleSetModel(_ payload: [String: Any], callbackID: String?) {
        if let modelID = payload["modelId"] as? String {
            BackendService.shared.providerRegistry.activeModelID = modelID
        }
        reply(callbackID: callbackID, data: [:])
    }

    private func handleSetProviderKey(_ payload: [String: Any], callbackID: String?) {
        guard let providerID = payload["providerId"] as? String,
              let apiKey = payload["apiKey"] as? String else { return }
        ConfigManager.shared.setAPIKey(apiKey, for: providerID)
        BackendService.shared.providerRegistry.reload()
        reply(callbackID: callbackID, data: [:])
    }
}
