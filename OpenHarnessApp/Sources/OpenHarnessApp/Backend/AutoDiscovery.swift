import Foundation

/// Auto-discovers local AI providers running on common ports.
/// Scans for: Ollama (:11434), LM Studio (:1234), OMLX (:8888)
class AutoDiscovery {
    struct DiscoveredProvider {
        let id: String
        let name: String
        let baseURL: String
        let models: [DiscoveredModel]
    }

    struct DiscoveredModel {
        let id: String
        let name: String
        let apiModel: String
    }

    static let shared = AutoDiscovery()

    func discoverAll() async -> [DiscoveredProvider] {
        await withTaskGroup(of: DiscoveredProvider?.self) { group in
            var results: [DiscoveredProvider] = []

            group.addTask { await self.probe(id: "ollama", name: "Ollama", baseURL: "http://localhost:11434") }
            group.addTask { await self.probe(id: "lmstudio", name: "LM Studio", baseURL: "http://localhost:1234") }
            group.addTask { await self.probe(id: "omlx", name: "OMLX", baseURL: "http://localhost:8888") }

            for await provider in group {
                if let p = provider { results.append(p) }
            }

            return results.sorted { $0.name < $1.name }
        }
    }

    private func probe(id: String, name: String, baseURL: String) async -> DiscoveredProvider? {
        // Try the /v1/models endpoint (OpenAI-compatible)
        guard let url = URL(string: "\(baseURL)/v1/models") else { return nil }

        var request = URLRequest(url: url)
        request.timeoutInterval = 3
        request.httpMethod = "GET"

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else { return nil }

            // Parse the models response
            let models = parseModelsResponse(data, providerID: id)
            guard !models.isEmpty else { return nil }

            return DiscoveredProvider(
                id: id,
                name: name,
                baseURL: baseURL,
                models: models
            )
        } catch {
            return nil
        }
    }

    private func parseModelsResponse(_ data: Data, providerID: String) -> [DiscoveredModel] {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let modelData = json["data"] as? [[String: Any]] else { return [] }

        return modelData.compactMap { model in
            guard let id = model["id"] as? String else { return nil }
            return DiscoveredModel(
                id: "\(providerID).\(id)",
                name: friendlyName(id),
                apiModel: id
            )
        }
    }

    private func friendlyName(_ modelID: String) -> String {
        // Simple friendly name generation
        let name = modelID
            .replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .split(separator: "/").last.map(String.init) ?? modelID

        return name.split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }
}
