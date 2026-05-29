import Foundation
import Security

/// Manages provider configuration and API keys.
/// Keys are stored in macOS Keychain. Config is stored in ~/.cmdui/config.json.
class ConfigManager {
    static let shared = ConfigManager()

    private let configDir: URL
    private let configURL: URL
    private(set) var config: CMDuiConfig

    struct CMDuiConfig: Codable {
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
    }

    init() {
        let home = FileManager.default.homeDirectoryForCurrentUser
        self.configDir = home.appendingPathComponent(".cmdui")
        self.configURL = configDir.appendingPathComponent("config.json")
        self.config = ConfigManager.loadConfig(from: configURL)
        self.migrateExistingConfigs()
    }

    // MARK: - Load / Save

    private static func loadConfig(from url: URL) -> CMDuiConfig {
        guard let data = try? Data(contentsOf: url),
              let config = try? JSONDecoder().decode(CMDuiConfig.self, from: data) else {
            return CMDuiConfig(providers: [:], defaultModel: nil, agents: nil)
        }
        return config
    }

    func save() {
        try? FileManager.default.createDirectory(at: configDir, withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        if let data = try? encoder.encode(config) {
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
            kSecAttrService as String: "com.cmdui.providers",
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
            kSecAttrService as String: "com.cmdui.providers",
            kSecAttrAccount as String: providerID,
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        // Add new
        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.cmdui.providers",
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
}
