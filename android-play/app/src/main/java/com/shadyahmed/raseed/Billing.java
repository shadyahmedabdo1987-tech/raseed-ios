package com.shadyahmed.raseed;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONObject;

import java.util.Collections;
import java.util.List;

/** One-time "full version" product on Google Play. The product being ACTIVE in Play Console is the switch that starts selling. */
public class Billing implements PurchasesUpdatedListener {
    public static final String PRODUCT = "raseed_full";
    public interface Listener { void onState(String json); }

    private final Activity act;
    private final Listener listener;
    private final SharedPreferences prefs;
    private BillingClient client;
    private ProductDetails details;
    private boolean ready = false, available = false, owned, pending = false, checked = false;
    private String event = "";
    private boolean restoreAsked = false;

    public Billing(Activity a, Listener l) {
        act = a; listener = l;
        prefs = a.getSharedPreferences("raseed_billing", Context.MODE_PRIVATE);
        owned = prefs.getBoolean("owned", false);
        available = prefs.getBoolean("available", false);
        client = BillingClient.newBuilder(a)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        connect();
    }

    private void connect() {
        try {
            client.startConnection(new BillingClientStateListener() {
                @Override public void onBillingSetupFinished(BillingResult r) {
                    ready = r.getResponseCode() == BillingClient.BillingResponseCode.OK;
                    if (ready) { queryProduct(); queryOwned(); } else { checked = true; emit(); }
                }
                @Override public void onBillingServiceDisconnected() { ready = false; }
            });
        } catch (Throwable t) { checked = true; emit(); }
    }

    private void queryProduct() {
        QueryProductDetailsParams p = QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(
                QueryProductDetailsParams.Product.newBuilder().setProductId(PRODUCT).setProductType(BillingClient.ProductType.INAPP).build())).build();
        client.queryProductDetailsAsync(p, (r, res) -> {
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                List<ProductDetails> list = res.getProductDetailsList();
                details = (list != null && !list.isEmpty()) ? list.get(0) : null;
                available = details != null;
                prefs.edit().putBoolean("available", available).apply();
            }
            checked = true;
            emit();
        });
    }

    private void queryOwned() {
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (r, purchases) -> {
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) handle(purchases, true);
        });
    }

    private void handle(List<Purchase> purchases, boolean fullList) {
        boolean has = false; boolean pend = false;
        if (purchases != null) for (Purchase p : purchases) {
            if (!p.getProducts().contains(PRODUCT)) continue;
            if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                has = true;
                if (!fullList) event = "bought";
                if (!p.isAcknowledged()) {
                    client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), ar -> { });
                }
            } else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) pend = true;
        }
        if (has || fullList) { owned = has; prefs.edit().putBoolean("owned", owned).apply(); }
        pending = pend && !owned;
        if (fullList && restoreAsked) { restoreAsked = false; event = "restored"; }
        if (pending && !fullList) event = "pending";
        emit();
    }

    @Override public void onPurchasesUpdated(BillingResult r, List<Purchase> purchases) {
        int c = r.getResponseCode();
        if (c == BillingClient.BillingResponseCode.OK) handle(purchases, false);
        else if (c == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) { restoreAsked = true; queryOwned(); }
        else { event = c == BillingClient.BillingResponseCode.USER_CANCELED ? "" : "failed"; emit(); }
    }

    public void buy() {
        if (!ready || details == null) { event = "failed"; connect(); emit(); return; }
        BillingFlowParams.ProductDetailsParams pd = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).build();
        client.launchBillingFlow(act, BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(pd)).build());
    }

    public void restore() { restore(false); }
    public void restore(boolean manual) {
        if (manual) restoreAsked = true;
        if (ready) { queryProduct(); queryOwned(); } else connect();
    }

    public String state() {
        try {
            JSONObject o = new JSONObject();
            o.put("supported", true);
            o.put("ready", ready);
            o.put("checked", checked);
            o.put("available", available);
            o.put("owned", owned);
            o.put("active", owned);
            o.put("event", event);
            o.put("pending", pending);
            String price = "";
            if (details != null && details.getOneTimePurchaseOfferDetails() != null) price = details.getOneTimePurchaseOfferDetails().getFormattedPrice();
            o.put("price", price);
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    private void emit() {
        if (listener != null) listener.onState(state());
        event = "";
    }
}
