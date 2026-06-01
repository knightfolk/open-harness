import Foundation

/// Native Anthropic Messages API adapter for Claude models.
class AnthropicProvider: Provider {
    let config: ProviderConfig
    let models: [ModelConfig]

    init(config: ProviderConfig, models: [ModelConfig]) {
        self.config = config
        self.models = models
    }

    func stream(messages: [[String: String]], model: ModelConfig, workingDir: String?) async throws -> AsyncThrowingStream<ProviderEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let url = URL(string: "https://api.anthropic.com/v1/messages")!
                    var request = URLRequest(url: url)
                    request.httpMethod = "POST"
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.setValue(config.apiKey ?? "", forHTTPHeaderField: "x-api-key")
                    request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

                    var systemPrompt = "You are a helpful AI coding assistant. Respond concisely with code examples. Use markdown formatting."
                    if let dir = workingDir {
                        systemPrompt += "\n\nThe user has a project open at: \(dir)"
                    }

                    // Convert messages to Anthropic format
                    var apiMessages: [[String: Any]] = []
                    for msg in messages {
                        let role = msg["role"] ?? "user"
                        let content = msg["content"] ?? ""
                        if role == "system" { continue }
                        apiMessages.append(["role": role, "content": content])
                    }

                    let body: [String: Any] = [
                        "model": model.apiModel,
                        "max_tokens": model.defaultMaxTokens,
                        "system": systemPrompt,
                        "messages": apiMessages,
                        "stream": true,
                    ]
                    request.httpBody = try JSONSerialization.data(withJSONObject: body)

                    let (bytes, response) = try await URLSession.shared.bytes(for: request)

                    guard let httpResponse = response as? HTTPURLResponse else {
                        continuation.finish(throwing: NSError(domain: "AnthropicProvider", code: -1))
                        return
                    }

                    if httpResponse.statusCode != 200 {
                        var errorBody = ""
                        for try await line in bytes.lines { errorBody += line }
                        continuation.finish(throwing: NSError(domain: "AnthropicProvider", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorBody]))
                        return
                    }

                    for try await line in bytes.lines {
                        guard line.hasPrefix("data: ") else { continue }
                        let data = String(line.dropFirst(6))
                        guard let jsonData = data.data(using: .utf8),
                              let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
                              let type = json["type"] as? String else { continue }

                        switch type {
                        case "content_block_delta":
                            if let delta = json["delta"] as? [String: Any],
                               let text = delta["text"] as? String {
                                continuation.yield(.contentDelta(text: text))
                            }
                        case "tool_use_start":
                            if let tool = json["content_block"] as? [String: Any] {
                                let id = tool["id"] as? String ?? UUID().uuidString
                                let name = tool["name"] as? String ?? ""
                                continuation.yield(.toolUseStart(id: id, name: name, input: nil))
                            }
                        case "input_json_delta":
                            if let delta = json["delta"] as? [String: Any],
                               let input = delta["partial_json"] as? String {
                                // Could batch or forward individually
                                continuation.yield(.toolUseDelta(id: "", inputDelta: input))
                            }
                        case "message_stop":
                            continuation.yield(.complete)
                        case "error":
                            let errMsg = json["error"] as? [String: Any]
                            let msg = errMsg?["message"] as? String ?? "Unknown error"
                            continuation.yield(.error(message: msg))
                        default:
                            break
                        }
                    }

                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}
