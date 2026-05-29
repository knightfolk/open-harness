import Foundation

/// Static catalog of known models. Ported from OpenCode's model definitions.
enum ModelCatalog {

    // MARK: - OpenAI
    static let openaiModels: [ModelConfig] = [
        ModelConfig(id: "openai.gpt-4.1", name: "GPT-4.1", providerID: "openai", apiModel: "gpt-4.1", contextWindow: 1047576, defaultMaxTokens: 32768, costPer1MIn: 2.0, costPer1MOut: 8.0),
        ModelConfig(id: "openai.gpt-4.1-mini", name: "GPT-4.1 mini", providerID: "openai", apiModel: "gpt-4.1-mini", contextWindow: 1047576, defaultMaxTokens: 32768, costPer1MIn: 0.4, costPer1MOut: 1.6),
        ModelConfig(id: "openai.gpt-4.1-nano", name: "GPT-4.1 nano", providerID: "openai", apiModel: "gpt-4.1-nano", contextWindow: 1047576, defaultMaxTokens: 32768, costPer1MIn: 0.1, costPer1MOut: 0.4),
        ModelConfig(id: "openai.o3", name: "o3", providerID: "openai", apiModel: "o3", contextWindow: 200000, defaultMaxTokens: 100000, costPer1MIn: 2.0, costPer1MOut: 8.0, canReason: true),
        ModelConfig(id: "openai.o4-mini", name: "o4-mini", providerID: "openai", apiModel: "o4-mini", contextWindow: 200000, defaultMaxTokens: 100000, costPer1MIn: 1.1, costPer1MOut: 4.4, canReason: true),
    ]

    // MARK: - Anthropic
    static let anthropicModels: [ModelConfig] = [
        ModelConfig(id: "anthropic.claude-sonnet-4", name: "Claude Sonnet 4", providerID: "anthropic", apiModel: "claude-sonnet-4-20250514", contextWindow: 200000, defaultMaxTokens: 64000, costPer1MIn: 3.0, costPer1MOut: 15.0),
        ModelConfig(id: "anthropic.claude-3.7-sonnet", name: "Claude 3.7 Sonnet", providerID: "anthropic", apiModel: "claude-3-7-sonnet-20250219", contextWindow: 200000, defaultMaxTokens: 64000, costPer1MIn: 3.0, costPer1MOut: 15.0),
        ModelConfig(id: "anthropic.claude-3.5-haiku", name: "Claude 3.5 Haiku", providerID: "anthropic", apiModel: "claude-3-5-haiku-20241022", contextWindow: 200000, defaultMaxTokens: 8192, costPer1MIn: 0.8, costPer1MOut: 4.0),
    ]

    // MARK: - Google Gemini
    static let geminiModels: [ModelConfig] = [
        ModelConfig(id: "google.gemini-2.5-pro", name: "Gemini 2.5 Pro", providerID: "google", apiModel: "gemini-2.5-pro-preview-06-05", contextWindow: 1048576, defaultMaxTokens: 65536, costPer1MIn: 1.25, costPer1MOut: 10.0),
        ModelConfig(id: "google.gemini-2.5-flash", name: "Gemini 2.5 Flash", providerID: "google", apiModel: "gemini-2.5-flash-preview-05-20", contextWindow: 1048576, defaultMaxTokens: 65536, costPer1MIn: 0.15, costPer1MOut: 0.6),
    ]

    // MARK: - MiniMax
    static let minimaxModels: [ModelConfig] = [
        ModelConfig(id: "minimax.MiniMax-M2.7", name: "MiniMax M2.7", providerID: "minimax", apiModel: "MiniMax-M2.7", contextWindow: 1048576, defaultMaxTokens: 16384, costPer1MIn: 0.2, costPer1MOut: 1.0),
    ]

    // MARK: - xAI
    static let xaiModels: [ModelConfig] = [
        ModelConfig(id: "xai.grok-3", name: "Grok 3", providerID: "xai", apiModel: "grok-3", contextWindow: 131072, defaultMaxTokens: 32768),
        ModelConfig(id: "xai.grok-3-mini", name: "Grok 3 Mini", providerID: "xai", apiModel: "grok-3-mini", contextWindow: 131072, defaultMaxTokens: 32768, canReason: true),
    ]

    // MARK: - Groq
    static let groqModels: [ModelConfig] = [
        ModelConfig(id: "groq.llama-4-maverick", name: "Llama 4 Maverick", providerID: "groq", apiModel: "meta-llama/llama-4-maverick-17b-128e-instruct", contextWindow: 131072, defaultMaxTokens: 32768),
        ModelConfig(id: "groq.qwen3-32b", name: "Qwen3 32B", providerID: "groq", apiModel: "qwen/qwen3-32b", contextWindow: 131072, defaultMaxTokens: 32768),
    ]

    // MARK: - OpenRouter (popular models)
    static let openrouterModels: [ModelConfig] = [
        ModelConfig(id: "openrouter.gpt-4.1", name: "GPT-4.1 (OpenRouter)", providerID: "openrouter", apiModel: "openai/gpt-4.1", contextWindow: 1047576, defaultMaxTokens: 32768, costPer1MIn: 2.0, costPer1MOut: 8.0),
        ModelConfig(id: "openrouter.claude-3.7-sonnet", name: "Claude 3.7 Sonnet (OpenRouter)", providerID: "openrouter", apiModel: "anthropic/claude-3.7-sonnet", contextWindow: 200000, defaultMaxTokens: 64000, costPer1MIn: 3.0, costPer1MOut: 15.0),
        ModelConfig(id: "openrouter.deepseek-r1", name: "DeepSeek R1 (OpenRouter)", providerID: "openrouter", apiModel: "deepseek/deepseek-r1", contextWindow: 163840, defaultMaxTokens: 32768, canReason: true),
    ]

    // MARK: - All static models
    static let allStaticModels: [ModelConfig] =
        openaiModels + anthropicModels + geminiModels + minimaxModels +
        xaiModels + groqModels + openrouterModels
}
