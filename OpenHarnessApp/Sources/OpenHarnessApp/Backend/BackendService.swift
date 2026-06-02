import Foundation

/// Central backend service — singleton that owns all state.
class BackendService {
    static let shared = BackendService()

    let providerRegistry = ProviderRegistry()
    private var sessions: [String: SessionData] = [:]

    // MARK: - Init

    func initialize() {
        providerRegistry.reload()

        if providerRegistry.providers.isEmpty {
            print("⚠  No providers configured. Add API keys in ~/.openharness/config.json or set environment variables.")
        } else {
            print("✓ Providers loaded: \(providerRegistry.providers.keys.sorted().joined(separator: ", "))")
            print("✓ Models available: \(providerRegistry.availableModels().count)")
        }
    }

    func discoverProviders() {
        providerRegistry.reload()
    }

    // MARK: - Sessions

    func createSession(title: String, workingDir: String? = nil) -> SessionData {
        let session = SessionData(
            id: UUID().uuidString,
            title: title,
            workingDir: workingDir,
            messages: [],
            createdAt: Date(),
            updatedAt: Date()
        )
        sessions[session.id] = session
        return session
    }

    func getSession(id: String) -> SessionData? {
        return sessions[id]
    }

    func listSessions() -> [SessionData] {
        return sessions.values.sorted { $0.updatedAt > $1.updatedAt }
    }

    func deleteSession(id: String) {
        sessions.removeValue(forKey: id)
    }

    func getMessages(for sessionID: String) -> [MessageData] {
        return sessions[sessionID]?.messages ?? []
    }

    func getWorkingDir(for sessionID: String) -> String? {
        return sessions[sessionID]?.workingDir
    }

    func saveMessage(sessionID: String, role: String, content: String) {
        guard sessions[sessionID] != nil else { return }
        let msg = MessageData(id: UUID().uuidString, role: role, content: content, timestamp: Date())
        sessions[sessionID]?.messages.append(msg)
        sessions[sessionID]?.updatedAt = Date()
    }
}
