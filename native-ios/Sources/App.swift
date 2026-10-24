// رصيد — iOS native shell.
// The whole app UI is web/index.html (one inlined file) shown in a WKWebView.
// window.RaseedNative (injected below) bridges to native features:
// storage mirror, daily backup in Files, snapshots, Face ID, local
// notifications for installments, PDF export, printing, sharing, haptics.

import UIKit
import WebKit
import LocalAuthentication
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        let w = UIWindow(frame: UIScreen.main.bounds)
        w.backgroundColor = MainVC.bg
        w.rootViewController = MainVC()
        w.makeKeyAndVisible()
        window = w
        return true
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let v = (response.notification.request.content.userInfo["openView"] as? String) ?? ""
        DispatchQueue.main.async {
            if let vc = MainVC.shared, vc.pageReady { vc.openView(v) } else { MainVC.pendingOpen = v }
        }
        completionHandler()
    }
}

struct Job { let date: Date; let title: String; let body: String; let open: String }

final class MainVC: UIViewController, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate {
    static let bg = UIColor(red: 7 / 255, green: 11 / 255, blue: 62 / 255, alpha: 1)
    static weak var shared: MainVC?
    static var pendingOpen = ""

    var web: WKWebView!
    var pageReady = false
    var lightBar = false
    var notifAuthorized = false
    var lastShared: URL?
    var helperWeb: WKWebView?
    var helperJob: ((WKWebView) -> Void)?

    let fm = FileManager.default
    lazy var docs: URL = fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
    lazy var support: URL = {
        let u = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Raseed", isDirectory: true)
        try? fm.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }()
    var stateFile: URL { support.appendingPathComponent("raseed_state.json") }
    var snapDir: URL {
        let u = support.appendingPathComponent("snapshots", isDirectory: true)
        try? fm.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }
    var backupFile: URL { docs.appendingPathComponent("raseed-auto-backup.json") }

    override var preferredStatusBarStyle: UIStatusBarStyle { lightBar ? .darkContent : .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        MainVC.shared = self
        view.backgroundColor = MainVC.bg
        refreshNotifStatus()

        let ucc = WKUserContentController()
        ucc.add(self, name: "rn")
        ucc.addUserScript(WKUserScript(source: MainVC.shim, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let cfg = WKWebViewConfiguration()
        cfg.userContentController = ucc
        cfg.websiteDataStore = .default()
        cfg.dataDetectorTypes = []
        cfg.allowsInlineMediaPlayback = true

        web = WKWebView(frame: view.bounds, configuration: cfg)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.isOpaque = false
        web.backgroundColor = MainVC.bg
        web.scrollView.backgroundColor = MainVC.bg
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = false
        web.scrollView.showsVerticalScrollIndicator = false
        web.scrollView.showsHorizontalScrollIndicator = false
        web.allowsLinkPreview = false
        web.uiDelegate = self
        web.navigationDelegate = self
        view.addSubview(web)

        NotificationCenter.default.addObserver(self, selector: #selector(becameActive), name: UIApplication.didBecomeActiveNotification, object: nil)

        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web"),
           let html = try? String(contentsOf: url, encoding: .utf8) {
            web.loadHTMLString(html, baseURL: URL(string: "https://raseed.app/"))
        }
    }

    @objc func becameActive() { refreshNotifStatus() }

    func refreshNotifStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { s in
            let ok = s.authorizationStatus == .authorized || s.authorizationStatus == .provisional
            DispatchQueue.main.async { self.notifAuthorized = ok }
        }
    }

    func js(_ code: String) { web?.evaluateJavaScript(code, completionHandler: nil) }

    func jsString(_ s: String) -> String {
        let data = (try? JSONSerialization.data(withJSONObject: [s])) ?? Data("[\"\"]".utf8)
        let arr = String(data: data, encoding: .utf8) ?? "[\"\"]"
        return String(arr.dropFirst().dropLast())
    }

    func openView(_ v: String) {
        let clean = v.filter { $0.isLetter && $0.isASCII }
        if !clean.isEmpty { js("window.raseedOpen&&window.raseedOpen('\(clean)')") }
    }

    // MARK: navigation
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if webView === web { pageReady = true }
        if webView === helperWeb, let job = helperJob {
            helperJob = nil
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) { job(webView) }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.allow); return }
        let s = url.absoluteString
        if s.hasPrefix("https://raseed.app") || s.hasPrefix("about:") || s.hasPrefix("data:") || s.hasPrefix("blob:") || navigationAction.targetFrame?.isMainFrame == false {
            decisionHandler(.allow)
        } else {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    // MARK: synchronous calls  (window.prompt('RN:method', jsonArgs))
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        guard prompt.hasPrefix("RN:") else {
            let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
            a.addTextField { $0.text = defaultText }
            a.addAction(UIAlertAction(title: "إلغاء", style: .cancel) { _ in completionHandler(nil) })
            a.addAction(UIAlertAction(title: "تمام", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
            present(a, animated: true)
            return
        }
        let method = String(prompt.dropFirst(3))
        var args: [Any] = []
        if let t = defaultText, let d = t.data(using: .utf8), let arr = try? JSONSerialization.jsonObject(with: d) as? [Any] { args = arr }
        completionHandler(syncCall(method, args))
    }

    func syncCall(_ m: String, _ a: [Any]) -> String {
        func str(_ i: Int) -> String { a.count > i ? (a[i] as? String ?? "\(a[i])") : "" }
        switch m {
        case "persist":
            let json = str(0)
            do {
                try json.write(to: stateFile, atomically: true, encoding: .utf8)
                snapshot(json)
                return "1"
            } catch { return "0" }
        case "restore":
            return (try? String(contentsOf: stateFile, encoding: .utf8)) ?? ""
        case "autoBackup":
            do { try str(0).write(to: backupFile, atomically: true, encoding: .utf8); return "files" } catch { return "" }
        case "listSnapshots":
            let items = (try? fm.contentsOfDirectory(at: snapDir, includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey])) ?? []
            var out: [[String: Any]] = []
            for u in items where u.pathExtension == "json" {
                let v = try? u.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey])
                let t = (v?.contentModificationDate ?? Date()).timeIntervalSince1970 * 1000
                out.append(["name": u.lastPathComponent, "t": Int(t), "size": v?.fileSize ?? 0])
            }
            out.sort { ($0["t"] as? Int ?? 0) > ($1["t"] as? Int ?? 0) }
            let d = (try? JSONSerialization.data(withJSONObject: out)) ?? Data("[]".utf8)
            return String(data: d, encoding: .utf8) ?? "[]"
        case "readSnapshot":
            let n = str(0)
            if n.contains("/") || n.contains("..") { return "" }
            return (try? String(contentsOf: snapDir.appendingPathComponent(n), encoding: .utf8)) ?? ""
        case "takeOpen":
            let v = MainVC.pendingOpen; MainVC.pendingOpen = ""; return v
        case "notifAllowed":
            return notifAuthorized ? "1" : "0"
        case "bioAvailable":
            return LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) ? "1" : "0"
        default:
            return ""
        }
    }

    /// One restore point per day; a much smaller save never overwrites a bigger one. Keeps the newest 14.
    func snapshot(_ json: String) {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
        let day = f.string(from: Date())
        let file = snapDir.appendingPathComponent("day-\(day).json")
        let size = (try? fm.attributesOfItem(atPath: file.path)[.size] as? Int) ?? 0
        if size > 0 && json.utf8.count < size / 2 {
            let keep = snapDir.appendingPathComponent("day-\(day)-before-\(Int(Date().timeIntervalSince1970)).json")
            try? fm.moveItem(at: file, to: keep)
        }
        try? json.write(to: file, atomically: true, encoding: .utf8)
        let items = ((try? fm.contentsOfDirectory(at: snapDir, includingPropertiesForKeys: [.contentModificationDateKey])) ?? [])
            .sorted { a, b in
                let da = (try? a.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                let db = (try? b.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                return da > db
            }
        if items.count > 14 { for u in items[14...] { try? fm.removeItem(at: u) } }
    }

    // MARK: asynchronous calls  (webkit.messageHandlers.rn.postMessage({m, a}))
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let m = body["m"] as? String else { return }
        let a = body["a"] as? [Any] ?? []
        func str(_ i: Int) -> String { a.count > i ? (a[i] as? String ?? "\(a[i])") : "" }
        switch m {
        case "vibrate":
            let ms = (a.first as? NSNumber)?.intValue ?? 10
            UIImpactFeedbackGenerator(style: ms > 30 ? .medium : .light).impactOccurred()
        case "setBar":
            lightBar = (a.count > 1 ? (a[1] as? Bool ?? false) : false)
            setNeedsStatusBarAppearanceUpdate()
        case "saveFile":
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(safeName(str(0), "raseed-backup.json"))
            do {
                try str(1).write(to: url, atomically: true, encoding: .utf8)
                js("window.toast&&toast('اختار «حفظ في الملفات» أو ابعتها لنفسك','download')")
                share(url)
            } catch { js("window.raseedSaved&&window.raseedSaved(false)") }
        case "makePdf":
            makePdf(html: str(0), name: safeName(str(1), "Raseed-Report.pdf"))
        case "print":
            printHTML(str(0), title: str(1))
        case "shareLast":
            if let u = lastShared { share(u) }
        case "syncReminders":
            scheduleReminders(str(0))
        case "requestNotif":
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { ok, _ in
                DispatchQueue.main.async {
                    self.notifAuthorized = ok
                    self.js("window.raseedNotifResult&&window.raseedNotifResult(\(ok))")
                }
            }
        case "openSettings":
            if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) }
        case "testNotif":
            let daily = str(0) == "daily"
            let c = UNMutableNotificationContent()
            c.title = daily ? "✍️ سجّلت مصروفات النهارده؟" : "رصيد — الإشعارات شغالة ✅"
            c.body = daily ? "دقيقة واحدة تسجّل فيها اللي صرفته." : "هفكّرك هنا قبل ميعاد أي قسط."
            c.sound = .default
            c.userInfo = ["openView": daily ? "add" : "debts"]
            let r = UNNotificationRequest(identifier: "test-\(Date().timeIntervalSince1970)", content: c, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false))
            UNUserNotificationCenter.current().add(r)
        case "bioAuth":
            let ctx = LAContext()
            ctx.localizedCancelTitle = "استخدم الرقم السري"
            ctx.localizedFallbackTitle = ""
            ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: str(0).isEmpty ? "فتح رصيد" : str(0)) { ok, _ in
                DispatchQueue.main.async { self.js("window.raseedBio&&window.raseedBio(\(ok),\(ok ? 0 : 13))") }
            }
        default: break
        }
    }

    func safeName(_ n: String, _ fallback: String) -> String {
        let bad = CharacterSet(charactersIn: "/\\:*?\"<>|")
        let s = n.components(separatedBy: bad).joined(separator: "-").trimmingCharacters(in: .whitespaces)
        return s.isEmpty ? fallback : s
    }

    func share(_ url: URL) {
        lastShared = url
        let vc = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        vc.popoverPresentationController?.sourceView = view
        vc.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 40, width: 1, height: 1)
        present(vc, animated: true)
    }

    // MARK: PDF & print — render the report in an off-screen web view
    func withHelperWeb(_ html: String, _ job: @escaping (WKWebView) -> Void) {
        helperWeb?.removeFromSuperview()
        let w = WKWebView(frame: CGRect(x: 0, y: 0, width: 794, height: 1123), configuration: WKWebViewConfiguration())
        w.alpha = 0.01
        w.isUserInteractionEnabled = false
        w.navigationDelegate = self
        view.insertSubview(w, at: 0)
        helperWeb = w
        helperJob = job
        w.loadHTMLString(html, baseURL: URL(string: "https://raseed.app/"))
    }

    func makePdf(html: String, name: String) {
        withHelperWeb(html) { w in
            let renderer = UIPrintPageRenderer()
            renderer.addPrintFormatter(w.viewPrintFormatter(), startingAtPageAt: 0)
            let page = CGRect(x: 0, y: 0, width: 595.2, height: 841.8)
            renderer.setValue(NSValue(cgRect: page), forKey: "paperRect")
            renderer.setValue(NSValue(cgRect: page.insetBy(dx: 26, dy: 30)), forKey: "printableRect")
            let data = NSMutableData()
            UIGraphicsBeginPDFContextToData(data, page, nil)
            let pages = max(1, renderer.numberOfPages)
            renderer.prepare(forDrawingPages: NSRange(location: 0, length: pages))
            let bounds = UIGraphicsGetPDFContextBounds()
            for i in 0..<pages { UIGraphicsBeginPDFPage(); renderer.drawPage(at: i, in: bounds) }
            UIGraphicsEndPDFContext()
            w.removeFromSuperview(); self.helperWeb = nil
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
            do {
                try data.write(to: url, options: .atomic)
                self.js("window.raseedPdfReady&&window.raseedPdfReady(\(pages))")
                self.share(url)
            } catch {
                self.js("window.raseedPdfFailed&&window.raseedPdfFailed()")
            }
        }
    }

    func printHTML(_ html: String, title: String) {
        withHelperWeb(html) { w in
            let info = UIPrintInfo(dictionary: nil)
            info.outputType = .general
            info.jobName = title.isEmpty ? "Raseed" : title
            let pc = UIPrintInteractionController.shared
            pc.printInfo = info
            pc.printFormatter = w.viewPrintFormatter()
            pc.present(animated: true) { _, _, _ in
                w.removeFromSuperview(); self.helperWeb = nil
            }
        }
    }

    // MARK: installment / daily reminders (local notifications)
    func scheduleReminders(_ json: String) {
        let center = UNUserNotificationCenter.current()
        guard let d = json.data(using: .utf8), let cfg = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] else { return }
        center.getNotificationSettings { s in
            guard s.authorizationStatus == .authorized || s.authorizationStatus == .provisional else { return }
            center.removeAllPendingNotificationRequests()
            let ar = (cfg["digits"] as? String) != "en"
            let cal = Calendar.current
            let df = DateFormatter(); df.locale = Locale(identifier: "en_US_POSIX"); df.dateFormat = "yyyy-MM-dd"
            let now = Date()
            func digits(_ n: Int) -> String {
                let s = String(n); if !ar { return s }
                let map: [Character: Character] = ["0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤", "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩"]
                return String(s.map { map[$0] ?? $0 })
            }
            func when(_ n: Int) -> String {
                if n < 0 { return "متأخر \(digits(-n)) يوم" }
                if n == 0 { return "النهارده" }
                if n == 1 { return "بكرة" }
                if n == 2 { return "بعد بكرة" }
                return "بعد \(digits(n)) أيام"
            }
            func at(_ day: Date, _ hour: Int) -> Date? { cal.date(bySettingHour: hour, minute: 0, second: 0, of: day) }
            var jobs: [Job] = []
            if (cfg["inst"] as? Bool) ?? true {
                let before = (cfg["before"] as? NSNumber)?.intValue ?? 1
                let hour = (cfg["hour"] as? NSNumber)?.intValue ?? 10
                for it in ((cfg["items"] as? [[String: Any]]) ?? []).prefix(25) {
                    guard let dueS = it["due"] as? String, let due = df.date(from: dueS) else { continue }
                    let owe = (it["dir"] as? String) != "owed"
                    let what = (owe ? "قسط " : "تحصيل من ") + ((it["name"] as? String) ?? "") + ": " + ((it["amt"] as? String) ?? "")
                    for b in (before > 0 ? [before, 0] : [0]) {
                        if let day = cal.date(byAdding: .day, value: -b, to: due), let fire = at(day, hour), fire > now {
                            jobs.append(Job(date: fire, title: b == 0 ? "🔔 النهارده ميعاد قسط" : "🔔 تذكير بقسط", body: "\(what) — \(when(b))", open: "debts"))
                        }
                    }
                    if let late = cal.date(byAdding: .day, value: 1, to: due), let fire = at(late, hour), fire > now {
                        jobs.append(Job(date: fire, title: "⚠️ قسط متأخر", body: "\(what) — \(when(-1))", open: "debts"))
                    }
                }
            }
            jobs.sort { $0.date < $1.date }
            var list = Array(jobs.prefix(48))
            if (cfg["daily"] as? Bool) ?? false {
                let hour = (cfg["dailyHour"] as? NSNumber)?.intValue ?? 21
                let lastTx = cfg["lastTx"] as? String ?? ""
                for k in 0..<14 {
                    guard let day = cal.date(byAdding: .day, value: k, to: now) else { continue }
                    if k == 0 && df.string(from: day) == lastTx { continue }
                    if let fire = at(day, hour), fire > now {
                        list.append(Job(date: fire, title: "✍️ سجّلت مصروفات النهارده؟", body: "دقيقة واحدة تسجّل فيها اللي صرفته عشان تقاريرك تبقى مظبوطة.", open: "add"))
                    }
                }
            }
            for (i, j) in list.prefix(60).enumerated() {
                let c = UNMutableNotificationContent()
                c.title = j.title; c.body = j.body; c.sound = .default
                c.userInfo = ["openView": j.open]
                let comps = cal.dateComponents([.year, .month, .day, .hour, .minute], from: j.date)
                let req = UNNotificationRequest(identifier: "raseed-\(i)", content: c, trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: false))
                center.add(req)
            }
        }
    }

    // MARK: injected bridge
    static let shim = """
    (function(){
      function call(m, a){ try { return window.prompt('RN:' + m, JSON.stringify(a || [])); } catch (e) { return null; } }
      function post(m, a){ try { window.webkit.messageHandlers.rn.postMessage({ m: m, a: a || [] }); } catch (e) {} }
      window.RaseedNative = {
        platform: 'ios',
        vibrate: function(ms){ post('vibrate', [ms || 10]); },
        setBar: function(c, light){ post('setBar', [c, !!light]); },
        persist: function(json){ return call('persist', [json]) === '1'; },
        restore: function(){ return call('restore') || ''; },
        autoBackup: function(json, day){ return call('autoBackup', [json, day]) || ''; },
        listSnapshots: function(){ return call('listSnapshots') || '[]'; },
        readSnapshot: function(n){ return call('readSnapshot', [n]) || ''; },
        saveFile: function(name, data, mime){ post('saveFile', [name, data, mime]); return true; },
        makePdf: function(html, name){ post('makePdf', [html, name]); },
        print: function(html, title){ post('print', [html, title]); },
        openLast: function(){ post('shareLast'); },
        shareLast: function(){ post('shareLast'); },
        takeOpen: function(){ return call('takeOpen') || ''; },
        syncReminders: function(json){ post('syncReminders', [json]); },
        notifAllowed: function(){ return call('notifAllowed') !== '0'; },
        requestNotif: function(){ post('requestNotif'); return call('notifAllowed') === '1'; },
        openNotifSettings: function(){ post('openSettings'); },
        testNotif: function(kind){ post('testNotif', [kind]); },
        bioAvailable: function(){ return call('bioAvailable') === '1'; },
        bioAuth: function(title, sub){ post('bioAuth', [title, sub]); }
      };
    })();
    """
}
