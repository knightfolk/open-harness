import Foundation
import WebKit

class WebBridge: NSObject, WKScriptMessageHandler {
    static let shared = WebBridge()
    private var webView: WKWebView?

    func setWebView(_ webView: WKWebView) {
        self.webView = webView
    }

    // MARK: - Receiving messages from JS

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativeBridge",
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

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
        case "execCommand":
            handleExecCommand(payload, callbackID: callbackID)
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

        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript("""
            if (window.__OPENHARNESS_EVENT) {
                window.__OPENHARNESS_EVENT('\(event)', \(jsonString));
            }
            """)
        }
    }

    // MARK: - Reply to a specific callback

    private func reply(callbackID: String?, data: [String: Any]) {
        guard let id = callbackID else { return }
        let jsonData = try? JSONSerialization.data(withJSONObject: data)
        let jsonString = jsonData.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"

        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript("""
            if (window.__OPENHARNESS_CALLBACK) {
                window.__OPENHARNESS_CALLBACK('\(id)', \(jsonString));
            }
            """)
        }
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
        let workingDir = payload["workingDir"] as? String
        let session = BackendService.shared.createSession(title: title, workingDir: workingDir)
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
        guard let path = payload["path"] as? String else { return }
        let entries = FileSystemService.listDirectory(path: path)
        reply(callbackID: callbackID, data: ["path": path, "entries": entries])
    }

    private func handleReadFile(_ payload: [String: Any], callbackID: String?) {
        guard let path = payload["path"] as? String else { return }
        let result = FileSystemService.readFile(path: path)
        reply(callbackID: callbackID, data: result)
    }

    private func handleExecCommand(_ payload: [String: Any], callbackID: String?) {
        guard let command = payload["command"] as? String else { return }
        let cwd = payload["cwd"] as? String
        let result = ProcessRunner.run(command: command, cwd: cwd)
        reply(callbackID: callbackID, data: [
            "command": command,
            "output": result.output,
            "exitCode": result.exitCode,
            "duration": result.duration,
            "cwd": result.cwd,
        ])
    }

    private func handleOpenFolder(callbackID: String?) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.prompt = "Open Folder"

        if panel.runModal() == .OK, let url = panel.url {
            reply(callbackID: callbackID, data: ["path": url.path])
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
