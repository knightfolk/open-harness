import Foundation

enum FileSystemService {
    struct FileEntry: Encodable {
        let name: String
        let path: String
        let type: String // "file" or "directory"
        let extension_: String?
        let size: Int
        let modified: String
    }

    static func listDirectory(path: String) -> [[String: Any]] {
        let fm = FileManager.default
        guard let items = try? fm.contentsOfDirectory(atPath: path) else { return [] }

        return items
            .filter { !$0.hasPrefix(".") }
            .compactMap { name -> [String: Any]? in
                let fullPath = (path as NSString).appendingPathComponent(name)
                var isDir: ObjCBool = false
                guard fm.fileExists(atPath: fullPath, isDirectory: &isDir) else { return nil }
                let attrs = try? fm.attributesOfItem(atPath: fullPath)
                let size = attrs?[.size] as? Int ?? 0
                let modDate = (attrs?[.modificationDate] as? Date ?? Date()).ISO8601Format()

                let ext = (name as NSString).pathExtension.lowercased()
                return [
                    "name": name,
                    "path": fullPath,
                    "type": isDir.boolValue ? "directory" : "file",
                    "extension": ext.isEmpty ? NSNull() : ext,
                    "size": size,
                    "modified": modDate,
                ]
            }
            .sorted { (a, b) -> Bool in
                let aDir = a["type"] as? String == "directory"
                let bDir = b["type"] as? String == "directory"
                if aDir != bDir { return aDir }
                return (a["name"] as? String ?? "") < (b["name"] as? String ?? "")
            }
    }

    static func readFile(path: String) -> [String: Any] {
        let fm = FileManager.default
        guard fm.fileExists(atPath: path),
              let attrs = try? fm.attributesOfItem(atPath: path),
              let size = attrs[.size] as? Int,
              size <= 1_048_576,
              let content = try? String(contentsOfFile: path, encoding: .utf8) else {
            return ["error": "Cannot read file"]
        }
        let name = (path as NSString).lastPathComponent
        let ext = (name as NSString).pathExtension
        return [
            "path": path,
            "name": name,
            "extension": ext,
            "size": size,
            "modified": (attrs[.modificationDate] as? Date ?? Date()).ISO8601Format(),
            "content": content,
        ]
    }
}
