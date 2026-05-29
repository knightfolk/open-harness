import Foundation
import Combine

/// Central registry of all providers and models. Observable for SwiftUI binding.
class ProviderRegistry: ObservableObject {
    @Published var activeModelID: String = "minimax.MiniMax-M2.7"
    private(set) var providers: [String: Provider] = [:]
    
    func reload() {
        providers.removeAll()
        let config = ConfigManager.shared.config

        // 1. Load configured providers from config
        for (id, providerConfig) in config.providers where !providerConfig.disabled {
            let apiKey = ConfigManager.shared.getAPIKey(for: id)
            var cfg = providerConfig
            cfg.apiKey = apiKey

            let models = ModelCatalog.allStaticModels.filter { $0.providerID == id }
            if models.isEmpty { continue }

            switch cfg.type {
            case .openai:
                providers[id] = OpenAIProvider(config: cfg, models: models)
            case .anthropic:
                providers[id] = AnthropicProvider(config: cfg, models: models)
            case .gemini:
                providers[id] = GeminiProvider(config: cfg, models: models)
            case .bedrock, .vertexai:
                break // TODO: future
            }
        }

        // 2. Auto-discover local providers
        Task {
            let discovered = await AutoDiscovery.shared.discoverAll()
            for dp in discovered {
                let cfg = ProviderConfig(id: dp.id, name: dp.name, type: .openai, apiKey: "dummy", baseURL: dp.baseURL)
                let models = dp.models.map { dm in
                    ModelConfig(id: dm.id, name: dm.name, providerID: dp.id, apiModel: dm.apiModel)
                }
                DispatchQueue.main.async {
                    self.providers[dp.id] = OpenAIProvider(config: cfg, models: models)
                    self.objectWillChange.send()
                }
            }
        }
    }

    // MARK: - Access

    func configuredProviders() -> [ProviderConfig] {
        let config = ConfigManager.shared.config
        var result = Array(config.providers.values)
        // Add discovered local providers
        for (_, provider) in providers {
            if config.providers[provider.config.id] == nil {
                result.append(provider.config)
            }
        }
        return result.filter { !$0.disabled }
    }

    func allModels() -> [ModelConfig] {
        var all = ModelCatalog.allStaticModels
        // Add dynamically discovered models
        for (_, provider) in providers {
            let existingIDs = Set(all.map { $0.id })
            for model in provider.models {
                if !existingIDs.contains(model.id) {
                    all.append(model)
                }
            }
        }
        return all.sorted { $0.name < $1.name }
    }

    func availableModels() -> [ModelConfig] {
        // Only models from configured/available providers
        var result: [ModelConfig] = []
        for (_, provider) in providers {
            result.append(contentsOf: provider.models)
        }
        return result.sorted { $0.name < $1.name }
    }

    // MARK: - Streaming

    func stream(modelID: String, messages: [[String: String]], workingDir: String?) async throws -> AsyncThrowingStream<ProviderEvent, Error> {
        guard let model = allModels().first(where: { $0.id == modelID }) else {
            throw NSError(domain: "ProviderRegistry", code: -1, userInfo: [NSLocalizedDescriptionKey: "Model not found: \(modelID)"])
        }
        guard let provider = providers[model.providerID] else {
            throw NSError(domain: "ProviderRegistry", code: -2, userInfo: [NSLocalizedDescriptionKey: "Provider not configured: \(model.providerID). Add an API key in Settings."])
        }
        return try await provider.stream(messages: messages, model: model, workingDir: workingDir)
    }
}
