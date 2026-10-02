import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var serverProcess: Process?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let rect = NSRect(x: 100, y: 100, width: 1360, height: 880)
        let styleMask: NSWindow.StyleMask = [
            .titled,
            .closable,
            .miniaturizable,
            .resizable,
            .fullSizeContentView
        ]

        window = NSWindow(contentRect: rect, styleMask: styleMask, backing: .buffered, defer: false)
        window.center()
        window.title = "DeepHarness"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.isReleasedWhenClosed = false
        window.backgroundColor = NSColor(red: 0.035, green: 0.043, blue: 0.059, alpha: 1.0)
        window.minSize = NSSize(width: 950, height: 650)
        window.delegate = self

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        
        webView = WKWebView(frame: rect, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        window.contentView = webView

        setupAppMenu()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        // Show dark starting screen while engine starts
        showLoadingScreen()

        // Start internal backend process automatically
        startInternalServerAndLoad()
    }

    func showLoadingScreen() {
        let loadingHtml = """
        <html>
        <head>
            <style>
                body {
                    background: #090b0f;
                    color: #f8fafc;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    user-select: none;
                }
                .spinner {
                    width: 36px;
                    height: 36px;
                    border: 3px solid rgba(14, 165, 233, 0.15);
                    border-top-color: #0ea5e9;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin-bottom: 16px;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .title {
                    font-size: 15px;
                    font-weight: 600;
                    color: #e2e8f0;
                    margin-bottom: 4px;
                }
                .sub {
                    font-size: 12px;
                    color: #64748b;
                }
            </style>
        </head>
        <body>
            <div class="spinner"></div>
            <div class="title">Starting DeepHarness Studio...</div>
            <div class="sub">Initializing local AI engine & SQLite database</div>
        </body>
        </html>
        """
        webView.loadHTMLString(loadingHtml, baseURL: nil)
    }

    func findServerPath() -> (serverPath: String, workingDir: String)? {
        // 1. Check inside App Bundle Resources
        if let resPath = Bundle.main.resourcePath {
            let bundleServer = (resPath as NSString).appendingPathComponent("server.js")
            if FileManager.default.fileExists(atPath: bundleServer) {
                return (bundleServer, resPath)
            }
        }
        // 2. Check directory containing App Bundle
        let appDir = (Bundle.main.bundlePath as NSString).deletingLastPathComponent
        let parentServer = (appDir as NSString).appendingPathComponent("server.js")
        if FileManager.default.fileExists(atPath: parentServer) {
            return (parentServer, appDir)
        }
        return nil
    }

    func findNodePath() -> String {
        let candidatePaths = [
            (Bundle.main.bundlePath as NSString).appendingPathComponent("Contents/MacOS/node_bin"),
            "/usr/local/bin/node",
            "/opt/homebrew/bin/node",
            "/usr/bin/node"
        ]
        for path in candidatePaths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }

        // Query user shell for node
        let proc = Process()
        proc.launchPath = "/bin/zsh"
        proc.arguments = ["-l", "-c", "which node"]
        let pipe = Pipe()
        proc.standardOutput = pipe
        try? proc.run()
        proc.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        if let output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines), !output.isEmpty {
            return output
        }

        return "/usr/local/bin/node"
    }

    func startInternalServerAndLoad() {
        guard let (serverPath, workingDir) = findServerPath() else {
            print("Could not find server.js")
            return
        }

        let nodePath = findNodePath()

        // Check if server is already running on port 4173
        checkServerReady { [weak self] isRunning in
            if isRunning {
                self?.loadAppURL()
            } else {
                // Launch node server.js internally
                let proc = Process()
                proc.launchPath = nodePath
                proc.arguments = [serverPath]
                proc.currentDirectoryPath = workingDir

                var env = ProcessInfo.processInfo.environment
                let currentPath = env["PATH"] ?? ""
                env["PATH"] = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:" + currentPath
                proc.environment = env

                let dataDir = (workingDir as NSString).appendingPathComponent("data")
                if !FileManager.default.fileExists(atPath: dataDir) {
                    try? FileManager.default.createDirectory(atPath: dataDir, withIntermediateDirectories: true)
                }

                let logPath = (dataDir as NSString).appendingPathComponent("server.log")
                FileManager.default.createFile(atPath: logPath, contents: nil)
                if let logHandle = FileHandle(forWritingAtPath: logPath) {
                    proc.standardOutput = logHandle
                    proc.standardError = logHandle
                }

                do {
                    try proc.run()
                    self?.serverProcess = proc
                } catch {
                    print("Failed to run internal server process: \(error)")
                }

                // Poll until server responds, then load
                self?.pollAndLoadURL(attempt: 1)
            }
        }
    }

    func checkServerReady(completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: "http://127.0.0.1:4173/api/balance") else {
            completion(false)
            return
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = 0.4
        
        let task = URLSession.shared.dataTask(with: request) { _, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                completion(true)
            } else {
                completion(false)
            }
        }
        task.resume()
    }

    func pollAndLoadURL(attempt: Int) {
        checkServerReady { [weak self] ready in
            if ready {
                DispatchQueue.main.async {
                    self?.loadAppURL()
                }
            } else {
                if attempt < 50 { // Retry for up to 7.5 seconds
                    DispatchQueue.global().asyncAfter(deadline: .now() + 0.15) {
                        self?.pollAndLoadURL(attempt: attempt + 1)
                    }
                } else {
                    DispatchQueue.main.async {
                        self?.webView.loadHTMLString("""
                        <html>
                        <body style='background:#090b0f;color:#f8fafc;font-family:-apple-system;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;'>
                            <h3 style='color:#ef4444;margin-bottom:8px;'>Server Initialization Failed</h3>
                            <p style='color:#94a3b8;font-size:12px;'>Could not connect to internal server at port 4173.</p>
                            <button onclick='location.reload()' style='background:#0ea5e9;color:#000;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:600;margin-top:10px;'>Retry</button>
                        </body>
                        </html>
                        """, baseURL: nil)
                    }
                }
            }
        }
    }

    func loadAppURL() {
        if let url = URL(string: "http://127.0.0.1:4173") {
            let request = URLRequest(url: url)
            webView.load(request)
        }
    }

    func setupAppMenu() {
        let mainMenu = NSMenu()

        // App Menu
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        appMenu.addItem(withTitle: "About DeepHarness", action: nil, keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit DeepHarness", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // Edit Menu (Essential for Cut / Copy / Paste / Select All in WebKit)
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: Selector(("cut:")), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: Selector(("copy:")), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: Selector(("paste:")), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: Selector(("selectAll:")), keyEquivalent: "a")

        // View Menu (Reload)
        let viewMenuItem = NSMenuItem()
        mainMenu.addItem(viewMenuItem)
        let viewMenu = NSMenu(title: "View")
        viewMenuItem.submenu = viewMenu
        let reloadItem = NSMenuItem(title: "Reload", action: #selector(reloadApp), keyEquivalent: "r")
        viewMenu.addItem(reloadItem)

        // Window Menu
        let windowMenuItem = NSMenuItem()
        mainMenu.addItem(windowMenuItem)
        let windowMenu = NSMenu(title: "Window")
        windowMenuItem.submenu = windowMenu
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")

        NSApp.mainMenu = mainMenu
    }

    @objc func reloadApp() {
        webView.reload()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        serverProcess?.terminate()
    }
}

// Entry Point
let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
