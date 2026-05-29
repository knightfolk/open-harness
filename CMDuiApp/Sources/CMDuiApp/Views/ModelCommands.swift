import SwiftUI

struct ModelCommands: View {
    @ObservedObject private var registry = BackendService.shared.providerRegistry

    var body: some View {
        // Group models by provider
        let grouped = Dictionary(grouping: registry.allModels()) { $0.providerID }

        ForEach(grouped.keys.sorted(), id: \.self) { providerID in
            Menu(providerID.capitalized) {
                ForEach(grouped[providerID] ?? [], id: \.id) { model in
                    Button(action: {
                        registry.activeModelID = model.id
                        NotificationCenter.default.post(name: .modelChanged, object: nil, userInfo: ["modelID": model.id])
                    }) {
                        HStack {
                            Text(model.name)
                            if registry.activeModelID == model.id {
                                Spacer()
                                Text("✓")
                            }
                        }
                    }
                }
            }
        }

        Divider()

        Button("Refresh Providers") {
            BackendService.shared.discoverProviders()
        }
        .keyboardShortcut("r", modifiers: [.command, .shift])
    }
}
