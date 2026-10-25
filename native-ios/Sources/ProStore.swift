// رصيد — one-time "full version" purchase (StoreKit 2) + Apple's free "30-day Trial" item.
// Selling starts when the products are cleared for sale in App Store Connect (they're only returned to the app then).
import UIKit
import StoreKit

final class ProStore {
    static let shared = ProStore()
    static let fullID = "com.shadyahmed.raseed.full"
    static let trialID = "com.shadyahmed.raseed.trial30"
    private var full: Product?
    private var trial: Product?
    private var updates: Task<Void, Never>?

    func start() {
        guard updates == nil else { return }
        updates = Task.detached {
            for await r in Transaction.updates {
                if case .verified(let t) = r { await t.finish() }
                await ProStore.shared.report("")
            }
        }
    }

    private func load() async {
        if full == nil || trial == nil {
            if let ps = try? await Product.products(for: [ProStore.fullID, ProStore.trialID]) {
                for p in ps { if p.id == ProStore.fullID { full = p } else if p.id == ProStore.trialID { trial = p } }
            }
        }
    }

    private func entitlements() async -> (Bool, Date?) {
        var owned = false; var trialDate: Date? = nil
        for await r in Transaction.currentEntitlements {
            guard case .verified(let t) = r, t.revocationDate == nil else { continue }
            if t.productID == ProStore.fullID { owned = true }
            if t.productID == ProStore.trialID { trialDate = t.originalPurchaseDate }
        }
        return (owned, trialDate)
    }

    func report(_ event: String) async {
        await load()
        let (owned, trialDate) = await entitlements()
        var trialStart = ""
        if let d = trialDate { let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"; trialStart = f.string(from: d) }
        let payload: [String: Any] = ["active": owned, "available": full != nil, "price": full?.displayPrice ?? "",
                                      "trialAvailable": trial != nil, "trialStart": trialStart, "event": event]
        let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data("{}".utf8)
        let json = String(data: data, encoding: .utf8) ?? "{}"
        await MainActor.run { MainVC.shared?.js("window.raseedPro&&window.raseedPro(\(json))") }
    }

    private func purchase(_ p: Product?, ok: String) async {
        guard let p = p else { await report("failed"); return }
        do {
            let r = try await p.purchase()
            switch r {
            case .success(let v):
                if case .verified(let t) = v { await t.finish() }
                await report(ok)
            case .pending: await report("pending")
            case .userCancelled: await report("")
            @unknown default: await report("failed")
            }
        } catch { await report("failed") }
    }

    func buy() async { await load(); await purchase(full, ok: "bought") }
    func startTrial() async { await load(); await purchase(trial, ok: "trial") }

    func restore() async {
        try? await AppStore.sync()
        await report("restored")
    }
}
