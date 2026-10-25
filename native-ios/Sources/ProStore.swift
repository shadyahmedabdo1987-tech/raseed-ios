// رصيد — subscription (StoreKit 2). Product: monthly auto-renewable with a 1-month free intro offer.
import UIKit
import StoreKit

final class ProStore {
    static let shared = ProStore()
    static let productID = "com.shadyahmed.raseed.pro.monthly"
    private var product: Product?
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
        if product == nil { product = try? await Product.products(for: [ProStore.productID]).first }
    }

    private func isActive() async -> Bool {
        for await r in Transaction.currentEntitlements {
            guard case .verified(let t) = r, t.productID == ProStore.productID, t.revocationDate == nil else { continue }
            if let e = t.expirationDate, e < Date() { continue }
            return true
        }
        return false
    }

    func report(_ event: String) async {
        await load()
        let active = await isActive()
        var intro = false
        if let p = product, let sub = p.subscription, sub.introductoryOffer != nil { intro = await sub.isEligibleForIntroOffer }
        let payload: [String: Any] = ["active": active, "price": product?.displayPrice ?? "", "intro": intro, "event": event]
        let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data("{}".utf8)
        let json = String(data: data, encoding: .utf8) ?? "{}"
        await MainActor.run { MainVC.shared?.js("window.raseedPro&&window.raseedPro(\(json))") }
    }

    func buy() async {
        await load()
        guard let p = product else { await report("failed"); return }
        do {
            let r = try await p.purchase()
            switch r {
            case .success(let v):
                if case .verified(let t) = v { await t.finish() }
                await report("bought")
            case .pending: await report("")
            case .userCancelled: await report("failed")
            @unknown default: await report("failed")
            }
        } catch { await report("failed") }
    }

    func restore() async {
        try? await AppStore.sync()
        await report("restored")
    }

    func manage() async {
        let scene: UIWindowScene? = await MainActor.run { UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first }
        if let s = scene { try? await AppStore.showManageSubscriptions(in: s) }
    }
}
