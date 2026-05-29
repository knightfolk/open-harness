import SwiftUI

@main
struct CMDuiApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 900, minHeight: 600)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: true))
        .defaultSize(width: 1280, height: 800)
        .commands {
            CommandGroup(after: .newItem) {
                Button("Open Folder...") {
                    NotificationCenter.default.post(name: .openFolder, object: nil)
                }
                .keyboardShortcut("o", modifiers: .command)
            }
            CommandMenu("Model") {
                ModelCommands()
            }
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    let backend = BackendService.shared

    func applicationDidFinishLaunching(_ notification: Notification) {
        backend.initialize()
    }
}

extension Notification.Name {
    static let openFolder = Notification.Name("openFolder")
    static let modelChanged = Notification.Name("modelChanged")
}
