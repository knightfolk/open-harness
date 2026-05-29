import Foundation

/// Native Google Gemini API adapter.
class GeminiProvider: Provider {
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
                    let apiKey = config.apiKey ?? ""
                    let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(model.apiModel):streamGenerateContent?alt=sse&key=\(apiKey)")!
                    var request = URLRequest(url: url)
                    request.httpMethod = "POST"
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

                    var systemPrompt = "You are a helpful AI coding assistant. Respond concisely with code examples. Use markdown formatting."
                    if let dir = workingDir {
                        systemPrompt += "\n\nThe user has a project open at: \(dir)"
                    }

                    // Convert messages to Gemini format
                    var contents: [[String: Any]] = []
                    for msg in messages {
                        let role = msg["role"] ?? "user"
                        let content = msg["content"] ?? ""
                        if role == "system" { continue }
                        let geminiRole = role == "assistant" ? "model" : "user"
                        contents.append([
                            "role": geminiRole,
                            "parts": [["text": content]]
                        ])
                    }

                    let body: [String: Any] = [
                        "contents": contents,
                        "systemInstruction": ["parts": [["text": systemPrompt]]],
                        "generationConfig": [
                            "maxOutputTokens": model.defaultMaxTokens,
                        ]
                    ]
                    request.httpBody = try JSONSerialization.data(withJSONObject: body)

                    let (bytes, response) = try await URLSession.shared.bytes(for: request)

                    guard let httpResponse = response as? HTTPURLResponse else {
                        continuation.finish(throwing: NSError(domain: "GeminiProvider", code: -1))
                        return
                    }

                    if httpResponse.statusCode != 200 {
                        var errorBody = ""
                        for try await line in bytes.lines { errorBody += line }
                        continuation.finish(throwing: NSError(domain: "GeminiProvider", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorBody]))
                        return
                    }

                    for try await line in bytes.lines {
                        guard line.hasPrefix("data: ") else { continue }
                        let data = String(line.dropFirst(6))
                        guard let jsonData = data.data(using: .utf8),
                              let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
                              let candidates = json["candidates"] as? [[String: Any]],
                              let content = candidates.first?["content"] as? [String: Any],
                              let parts = content["parts"] as? [[String: Any]] else { continue }

                        for part in parts {
                            if let text = part["text"] as? String {
                                continuation.yield(.contentDelta(text: text))
                            }
                            if let funcCall = part["functionCall"] as? [String: Any] {
                                let name = funcCall["name"] as? String ?? ""
                                let args = funcCall["args"] as? [String: Any] ?? [:]
                                let argsJSON = (try? JSONSerialization.data(withJSONObject: args)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
                                continuation.yield(.toolUseStart(id: UUID().uuidString, name: name, input: argsJSON))
                            }
                        }
                    }

                    continuation.yield(.complete)
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}
