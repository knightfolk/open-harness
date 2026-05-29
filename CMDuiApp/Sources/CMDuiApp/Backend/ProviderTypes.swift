import Foundation

// MARK: - Provider

enum ProviderType: String, Codable {
    case openai       // OpenAI + all OpenAI-compatible (MiniMax, xAI, Groq, OpenRouter, Ollama, LM Studio, OMLX, Azure, Copilot)
    case anthropic    // Anthropic Claude (native Messages API)
    case gemini       // Google Gemini (native API)
    case bedrock      // AWS Bedrock
    case vertexai     // Google Vertex AI
}

struct ProviderConfig: Codable {
    let id: String
    let name: String
    let type: ProviderType
    var apiKey: String?
    var baseURL: String?
    var disabled: Bool

    init(id: String, name: String, type: ProviderType, apiKey: String? = nil, baseURL: String? = nil, disabled: Bool = false) {
        self.id = id
        self.name = name
        self.type = type
        self.apiKey = apiKey
        self.baseURL = baseURL
        self.disabled = disabled
    }
}

// MARK: - Model

struct ModelConfig: Codable, Identifiable {
    let id: String             // e.g., "minimax.MiniMax-M2.7"
    let name: String           // e.g., "MiniMax M2.7"
    let providerID: String     // e.g., "minimax"
    let apiModel: String       // e.g., "MiniMax-M2.7"
    let contextWindow: Int
    let defaultMaxTokens: Int
    let costPer1MIn: Double
    let costPer1MOut: Double
    let canReason: Bool
    let supportsAttachments: Bool
    let supportsToolUse: Bool

    init(id: String, name: String, providerID: String, apiModel: String,
         contextWindow: Int = 128000, defaultMaxTokens: Int = 4096,
         costPer1MIn: Double = 0, costPer1MOut: Double = 0,
         canReason: Bool = false, supportsAttachments: Bool = true, supportsToolUse: Bool = true) {
        self.id = id
        self.name = name
        self.providerID = providerID
        self.apiModel = apiModel
        self.contextWindow = contextWindow
        self.defaultMaxTokens = defaultMaxTokens
        self.costPer1MIn = costPer1MIn
        self.costPer1MOut = costPer1MOut
        self.canReason = canReason
        self.supportsAttachments = supportsAttachments
        self.supportsToolUse = supportsToolUse
    }
}

// MARK: - Streaming Events

enum ProviderEvent {
    case contentDelta(text: String)
    case toolUseStart(id: String, name: String, input: String?)
    case toolUseDelta(id: String, inputDelta: String)
    case toolUseStop(id: String, output: String?)
    case thinkingDelta(text: String)
    case complete
    case error(message: String)
}

// MARK: - Provider Protocol

protocol Provider: AnyObject {
    var config: ProviderConfig { get }
    var models: [ModelConfig] { get }
    func stream(messages: [[String: String]], model: ModelConfig, workingDir: String?) async throws -> AsyncThrowingStream<ProviderEvent, Error>
}

// MARK: - Session

struct SessionData {
    let id: String
    var title: String
    var workingDir: String?
    var messages: [MessageData]
    let createdAt: Date
    var updatedAt: Date
}

struct MessageData {
    let id: String
    let role: String
    let content: String
    let timestamp: Date
    var toolCalls: [ToolCallData]?
}

struct ToolCallData {
    let id: String
    let name: String
    let status: String
    let input: String?
    let output: String?
    let duration: Int?
}
