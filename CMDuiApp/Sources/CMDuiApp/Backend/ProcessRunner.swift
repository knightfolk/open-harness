import Foundation

enum ProcessRunner {
    struct Result {
        let output: String
        let exitCode: Int32
        let duration: Int
        let cwd: String
    }

    static func run(command: String, cwd: String? = nil) -> Result {
        let workingDir = cwd ?? FileManager.default.currentDirectoryPath
        let start = Date()

        let process = Process()
        let pipe = Pipe()
        let errorPipe = Pipe()

        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-c", command]
        process.currentDirectoryURL = URL(fileURLWithPath: workingDir)
        process.standardOutput = pipe
        process.standardError = errorPipe

        do {
            try process.run()
            process.waitUntilExit()

            let outputData = pipe.fileHandleForReading.readDataToEndOfFile()
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            var output = String(data: outputData, encoding: .utf8) ?? ""
            let errorOutput = String(data: errorData, encoding: .utf8) ?? ""

            if !errorOutput.isEmpty && output.isEmpty {
                output = errorOutput
            } else if !errorOutput.isEmpty {
                output += "\n" + errorOutput
            }

            let duration = Int(Date().timeIntervalSince(start) * 1000)
            return Result(output: output, exitCode: process.terminationStatus, duration: duration, cwd: workingDir)
        } catch {
            return Result(output: error.localizedDescription, exitCode: 1, duration: 0, cwd: workingDir)
        }
    }
}
