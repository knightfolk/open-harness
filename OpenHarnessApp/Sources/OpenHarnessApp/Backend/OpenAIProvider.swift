import Foundation

/// Universal adapter for any OpenAI-compatible API.
/// Covers: OpenAI, MiniMax, xAI, Groq, OpenRouter, Azure, Copilot, Ollama, LM Studio, OMLX, and any custom endpoint.
class OpenAIProvider: Provider {
    let config: ProviderConfig
    let models: [ModelConfig]
    private let baseURL: String
    private let apiKey: String?

    init(config: ProviderConfig, models: [ModelConfig]) {
        self.config = config
        self.models = models

        // Resolve base URL
        if let custom = config.baseURL {
            self.baseURL = custom
        } else {
            switch config.id {
            case "openai":      self.baseURL = "https://api.openai.com"
            case "minimax":     self.baseURL = "https://api.minimax.io"
            case "xai":         self.baseURL = "https://api.x.ai"
            case "groq":        self.baseURL = "https://api.groq.com/openai"
            case "openrouter":  self.baseURL = "https://openrouter.ai/api"
            case "azure":       self.baseURL = "https://RESOURCE.openai.azure.com" // placeholder
            case "ollama":      self.baseURL = "http://localhost:11434"
            case "lmstudio":    self.baseURL = "http://localhost:1234/v1"
            case "omlx":        self.baseURL = "http://localhost:8888/v1"
            case "copilot":     self.baseURL = "https://api.githubcopilot.com"
            default:            self.baseURL = "https://api.openai.com"
            }
        }
        self.apiKey = config.apiKey
    }

    func stream(messages: [[String: String]], model: ModelConfig, workingDir: String?) async throws -> AsyncThrowingStream<ProviderEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let url = URL(string: "\(baseURL)/v1/chat/completions")!
                    var request = URLRequest(url: url)
                    request.httpMethod = "POST"
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

                    if let key = apiKey, !key.isEmpty {
                        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
                    }

                    // Build system prompt
                    var systemPrompt = "You are a helpful AI coding assistant. Respond concisely with code examples where appropriate. Use markdown formatting."
                    if let dir = workingDir {
                        systemPrompt += "\n\nThe user has a project open at: \(dir)"
                    }

                    var apiMessages: [[String: String]] = [["role": "system", "content": systemPrompt]]
                    apiMessages.append(contentsOf: messages)

                    let body: [String: Any] = [
                        "model": model.apiModel,
                        "messages": apiMessages,
                        "stream": true,
                        "max_tokens": model.defaultMaxTokens,
                    ]
                    request.httpBody = try JSONSerialization.data(withJSONObject: body)

                    let (bytes, response) = try await URLSession.shared.bytes(for: request)

                    guard let httpResponse = response as? HTTPURLResponse else {
                        continuation.finish(throwing: NSError(domain: "OpenAIProvider", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"]))
                        return
                    }

                    if httpResponse.statusCode != 200 {
                        var errorBody = ""
                        for try await line in bytes.lines { errorBody += line }
                        continuation.finish(throwing: NSError(domain: "OpenAIProvider", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "API error: \(httpResponse.statusCode) \(errorBody)"]))
                        return
                    }

                    var buffer = ""
                    for try await line in bytes.lines {
                        let trimmed = line.trimmingCharacters(in: .whitespaces)
                        guard trimmed.hasPrefix("data: ") else { continue }
                        let data = String(trimmed.dropFirst(6))
                        if data == "[DONE]" { break }

                        if let jsonData = data.data(using: .utf8),
                           let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
                           let choices = json["choices"] as? [[String: Any]],
                           let delta = choices.first?["delta"] as? [String: Any] {

                            if let content = delta["content"] as? String, !content.isEmpty {
                                buffer += content
                                continuation.yield(.contentDelta(text: content))
                            }

                            // Handle tool calls in streaming
                            if let toolCalls = delta["tool_calls"] as? [[String: Any]] {
                                for tc in toolCalls {
                                    let id = tc["id"] as? String ?? UUID().uuidString
                                    let fn = tc["function"] as? [String: Any]
                                    let name = fn?["name"] as? String ?? ""
                                    let arguments = fn?["arguments"] as? String ?? ""
                                    continuation.yield(.toolUseStart(id: id, name: name, input: arguments))
                                }
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
