import Foundation
import Security

/// Manages provider configuration and API keys.
/// Keys are stored in macOS Keychain. Config is stored in ~/.openharness/config.json.
class ConfigManager {
    static let shared = ConfigManager()

    private let configDir: URL
    private let configURL: URL
    private(set) var config: OpenHarnessConfig

    struct OpenHarnessConfig: Codable {
        var providers: [String: ProviderConfig]
        var defaultModel: String?
        var agents: AgentsConfig?

        struct AgentsConfig: Codable {
            var coder: AgentConfig?
            var summarizer: AgentConfig?
            var title: AgentConfig?
            var task: AgentConfig?
        }

        struct AgentConfig: Codable {
            var model: String?
        }

        private struct ServerProvider: Codable {
            var id: String
            var name: String
            var type: String
            var apiKey: String?
            var baseURL: String?
        }

        private enum CodingKeys: String, CodingKey {
            case providers
            case defaultModel
            case activeModel
            case agents
        }

        init(providers: [String: ProviderConfig], defaultModel: String?, agents: AgentsConfig?) {
            self.providers = providers
            self.defaultModel = defaultModel
            self.agents = agents
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            if let providerMap = try? container.decode([String: ProviderConfig].self, forKey: .providers) {
                providers = providerMap
            } else {
                let serverProviders = (try? container.decode([ServerProvider].self, forKey: .providers)) ?? []
                providers = Dictionary(uniqueKeysWithValues: serverProviders.map { provider in
                    let type: ProviderType
                    switch provider.type {
                    case "anthropic":
                        type = .anthropic
                    case "google", "gemini":
                        type = .gemini
                    default:
                        type = .openai
                    }
                    return (provider.id, ProviderConfig(
                        id: provider.id,
                        name: provider.name,
                        type: type,
                        apiKey: provider.apiKey,
                        baseURL: provider.baseURL
                    ))
                })
            }
            defaultModel = (try? container.decode(String.self, forKey: .defaultModel))
                ?? (try? container.decode(String.self, forKey: .activeModel))
            agents = try? container.decode(AgentsConfig.self, forKey: .agents)
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(providers, forKey: .providers)
            try container.encodeIfPresent(defaultModel, forKey: .defaultModel)
            try container.encodeIfPresent(defaultModel, forKey: .activeModel)
            try container.encodeIfPresent(agents, forKey: .agents)
        }
    }

    init() {
        let home = FileManager.default.homeDirectoryForCurrentUser
        self.configDir = home.appendingPathComponent(".openharness")
        self.configURL = configDir.appendingPathComponent("config.json")
        self.config = ConfigManager.loadConfig(from: configURL)
        self.migrateExistingConfigs()
    }

    // MARK: - Load / Save

    private static func loadConfig(from url: URL) -> OpenHarnessConfig {
        guard let data = try? Data(contentsOf: url),
              let config = try? JSONDecoder().decode(OpenHarnessConfig.self, from: data) else {
            return OpenHarnessConfig(providers: [:], defaultModel: nil, agents: nil)
        }
        return config
    }

    func save() {
        try? FileManager.default.createDirectory(at: configDir, withIntermediateDirectories: true)
        var root = existingConfigObject()
        let existingProviders = existingServerProviders(in: root)
        root["providers"] = config.providers.values
            .sorted { $0.id < $1.id }
            .map { provider in
                [
                    "id": provider.id,
                    "name": provider.name,
                    "type": serverType(for: provider.type),
                    "apiKey": provider.apiKey ?? "",
                    "baseURL": provider.baseURL ?? defaultBaseURL(for: provider.id, type: provider.type),
                    "models": existingProviders[provider.id]?["models"] ?? [],
                ] as [String: Any]
            }
        if let defaultModel = config.defaultModel {
            root["activeModel"] = defaultModel
        }
        if let data = try? JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys]) {
            try? data.write(to: configURL, options: .atomic)
        }
    }

    // MARK: - API Keys (Keychain)

    func getAPIKey(for providerID: String) -> String? {
        // 1. Check Keychain
        if let key = getKeychain(providerID: providerID) { return key }
        // 2. Check config file
        if let key = config.providers[providerID]?.apiKey { return key }
        // 3. Check environment variable
        let envMap: [String: String] = [
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "google": "GOOGLE_API_KEY",
            "minimax": "MINIMAX_API_KEY",
            "xai": "XAI_API_KEY",
            "groq": "GROQ_API_KEY",
            "openrouter": "OPENROUTER_API_KEY",
            "azure": "AZURE_OPENAI_API_KEY",
        ]
        if let envVar = envMap[providerID], let val = ProcessInfo.processInfo.environment[envVar] {
            return val
        }
        return nil
    }

    func setAPIKey(_ key: String, for providerID: String) {
        setKeychain(providerID: providerID, key: key)
        // Also update in-memory config
        if config.providers[providerID] != nil {
            config.providers[providerID]?.apiKey = key
        }
        save()
    }

    // MARK: - Keychain helpers

    private func getKeychain(providerID: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.openharness.providers",
            kSecAttrAccount as String: providerID,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func setKeychain(providerID: String, key: String) {
        guard let data = key.data(using: .utf8) else { return }
        // Delete existing
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.openharness.providers",
            kSecAttrAccount as String: providerID,
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        // Add new
        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.openharness.providers",
            kSecAttrAccount as String: providerID,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    // MARK: - Migrate existing configs

    private func migrateExistingConfigs() {
        var changed = false

        // MiniMax from ~/.mmx/config.json
        if config.providers["minimax"] == nil,
           let mmxData = try? Data(contentsOf: FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".mmx/config.json")),
           let mmx = try? JSONSerialization.jsonObject(with: mmxData) as? [String: Any],
           let mmxKey = mmx["api_key"] as? String {
            config.providers["minimax"] = ProviderConfig(id: "minimax", name: "MiniMax", type: .openai, apiKey: mmxKey)
            setKeychain(providerID: "minimax", key: mmxKey)
            changed = true
        }

        // OpenAI from env
        if config.providers["openai"] == nil,
           let key = ProcessInfo.processInfo.environment["OPENAI_API_KEY"] {
            config.providers["openai"] = ProviderConfig(id: "openai", name: "OpenAI", type: .openai, apiKey: key)
            changed = true
        }

        // Anthropic from env
        if config.providers["anthropic"] == nil,
           let key = ProcessInfo.processInfo.environment["ANTHROPIC_API_KEY"] {
            config.providers["anthropic"] = ProviderConfig(id: "anthropic", name: "Anthropic", type: .anthropic, apiKey: key)
            changed = true
        }

        if changed { save() }
    }

    private func existingConfigObject() -> [String: Any] {
        guard let data = try? Data(contentsOf: configURL),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [
                "version": 1,
                "mcpServers": [],
                "personality": "",
                "activeTheme": "midnight",
                "trustMode": "workspace-write",
                "roleAssignments": [:],
            ]
        }
        return object
    }

    private func existingServerProviders(in root: [String: Any]) -> [String: [String: Any]] {
        guard let providers = root["providers"] as? [[String: Any]] else { return [:] }
        return Dictionary(uniqueKeysWithValues: providers.compactMap { provider in
            guard let id = provider["id"] as? String else { return nil }
            return (id, provider)
        })
    }

    private func serverType(for type: ProviderType) -> String {
        switch type {
        case .anthropic:
            return "anthropic"
        case .gemini, .vertexai:
            return "google"
        case .openai, .bedrock:
            return "openai-compatible"
        }
    }

    private func defaultBaseURL(for providerID: String, type: ProviderType) -> String {
        switch providerID {
        case "anthropic":
            return "https://api.anthropic.com/v1"
        case "google":
            return "https://generativelanguage.googleapis.com/v1beta"
        case "minimax":
            return "https://api.minimax.io/v1"
        default:
            return type == .gemini ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1"
        }
    }
}
