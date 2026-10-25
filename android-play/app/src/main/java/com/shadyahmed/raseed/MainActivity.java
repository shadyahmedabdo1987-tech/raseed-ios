package com.shadyahmed.raseed;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.pdf.PdfDocument;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.hardware.biometrics.BiometricPrompt;
import android.hardware.biometrics.BiometricManager;
import android.os.Environment;
import android.provider.MediaStore;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.Charset;

public class MainActivity extends Activity {
    static boolean EN = false;
    private static final int REQ_PICK = 101;
    private static final int REQ_SAVE = 102;
    private static final Charset UTF8 = Charset.forName("UTF-8");

    private WebView web;
    private WebView printWeb;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingSaveData;
    private File pendingSaveFile;
    private String pendingKind = "file";
    private Uri lastSaved;
    private String lastSavedMime;
    private FrameLayout root;
    private boolean pdfBusy = false;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private String pendingOpen;
    private Billing billing;
    private View topPad, bottomPad;
    private int navColor = Color.parseColor("#141A2E");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try { if (Build.VERSION.SDK_INT >= 21) WebView.enableSlowWholeDocumentDraw(); } catch (Throwable ignored) { }
        super.onCreate(savedInstanceState);
        setBars("#070B3E", false);
        pendingOpen = getIntent() != null ? getIntent().getStringExtra("openView") : null;
        try { Reminders.channels(this); Reminders.schedule(this); } catch (Exception ignored) { }

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#070B3E"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        web.addJavascriptInterface(new Bridge(), "RaseedNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (u != null && "file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    startActivityForResult(Intent.createChooser(i, EN ? "Choose backup file" : "اختار ملف النسخة الاحتياطية"), REQ_PICK);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#070B3E"));
        android.widget.LinearLayout col = new android.widget.LinearLayout(this);
        col.setOrientation(android.widget.LinearLayout.VERTICAL);
        topPad = new View(this); topPad.setBackgroundColor(Color.parseColor("#070B3E"));
        bottomPad = new View(this); bottomPad.setBackgroundColor(navColor);
        col.addView(topPad, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0));
        col.addView(web, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        col.addView(bottomPad, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0));
        root.addView(col, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        // Android 15+ draws edge-to-edge: keep the page clear of the status / navigation bars and the keyboard
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int top = 0, bottom = 0, left = 0, right = 0;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets b = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = insets.getInsets(android.view.WindowInsets.Type.ime());
                top = b.top; bottom = Math.max(b.bottom, ime.bottom); left = b.left; right = b.right;
            } else {
                top = insets.getSystemWindowInsetTop(); bottom = insets.getSystemWindowInsetBottom();
                left = insets.getSystemWindowInsetLeft(); right = insets.getSystemWindowInsetRight();
            }
            topPad.getLayoutParams().height = top; bottomPad.getLayoutParams().height = bottom;
            col.setPadding(left, 0, right, 0);
            topPad.requestLayout(); bottomPad.requestLayout();
            return insets;
        });
        setContentView(root);
        web.loadUrl("file:///android_asset/www/index.html");
        try {
            billing = new Billing(this, json -> ui.post(() -> { if (web != null) web.evaluateJavascript("window.raseedPro&&window.raseedPro(" + json + ")", null); }));
        } catch (Throwable t) { billing = null; }
    }

    private void setBars(String color, boolean lightBackground) {
        try {
            Window w = getWindow();
            w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            int c = Color.parseColor(color);
            w.setStatusBarColor(c);
            if (topPad != null) topPad.setBackgroundColor(c);
            if (root != null) root.setBackgroundColor(c);
            if (bottomPad != null) bottomPad.setBackgroundColor(lightBackground ? Color.WHITE : Color.parseColor("#141A2E"));
            w.setNavigationBarColor(lightBackground ? Color.WHITE : Color.parseColor("#141A2E"));
            View d = w.getDecorView();
            int flags = d.getSystemUiVisibility();
            if (Build.VERSION.SDK_INT >= 23) {
                if (lightBackground) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                else flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            }
            if (Build.VERSION.SDK_INT >= 26) {
                if (lightBackground) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                else flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            d.setSystemUiVisibility(flags);
        } catch (Exception ignored) { }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String v = intent != null ? intent.getStringExtra("openView") : null;
        if (v != null && web != null) web.evaluateJavascript("window.raseedOpen&&window.raseedOpen('" + v.replaceAll("[^a-z]", "") + "')", null);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 7 && web != null) {
            boolean ok = grantResults.length > 0 && grantResults[0] == 0;
            web.evaluateJavascript("window.raseedNotifResult&&window.raseedNotifResult(" + ok + ")", null);
        }
    }

    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("(window.raseedBack&&window.raseedBack())?'1':'0'", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) {
                if (v == null || !v.contains("1")) finish();
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_PICK) {
            if (fileCallback != null) {
                Uri[] r = null;
                if (resultCode == RESULT_OK && data != null && data.getData() != null) r = new Uri[]{data.getData()};
                fileCallback.onReceiveValue(r);
                fileCallback = null;
            }
        } else if (requestCode == REQ_SAVE) {
            boolean ok = false;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && (pendingSaveData != null || pendingSaveFile != null)) {
                OutputStream os = null;
                InputStream in = null;
                try {
                    os = getContentResolver().openOutputStream(data.getData());
                    if (pendingSaveFile != null) {
                        in = new FileInputStream(pendingSaveFile);
                        byte[] buf = new byte[16384]; int n;
                        while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                    } else os.write(pendingSaveData.getBytes(UTF8));
                    os.flush();
                    ok = true;
                    lastSaved = data.getData();
                    lastSavedMime = pendingSaveFile != null ? "application/pdf" : "application/json";
                } catch (Exception ignored) {
                } finally {
                    try { if (os != null) os.close(); } catch (Exception ignored) { }
                    try { if (in != null) in.close(); } catch (Exception ignored) { }
                }
            }
            pendingSaveData = null;
            pendingSaveFile = null;
            final String js = "window.raseedSaved&&window.raseedSaved(" + (ok ? "true" : "false") + ",'" + pendingKind + "')";
            pendingKind = "file";
            if (web != null) web.evaluateJavascript(js, null);
        }
    }

    private CancellationSignal bioCancel;

    private void bioResult(boolean ok, int code) {
        if (web != null) web.evaluateJavascript("window.raseedBio&&window.raseedBio(" + ok + "," + code + ")", null);
    }

    private void startBio(String title, String subtitle) {
        if (Build.VERSION.SDK_INT < 28) { bioResult(false, -1); return; }
        try {
            if (bioCancel != null) bioCancel.cancel();
            bioCancel = new CancellationSignal();
            java.util.concurrent.Executor ex = getMainExecutor();
            BiometricPrompt bp = new BiometricPrompt.Builder(this)
                    .setTitle(title == null || title.length() == 0 ? (EN ? "Unlock Raseed" : "فتح رصيد") : title)
                    .setSubtitle(subtitle == null ? "" : subtitle)
                    .setNegativeButton(EN ? "Use PIN" : "استخدم الرقم السري", ex, new android.content.DialogInterface.OnClickListener() {
                        public void onClick(android.content.DialogInterface d, int w) { bioResult(false, 13); }
                    })
                    .build();
            bp.authenticate(bioCancel, ex, new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r) { bioResult(true, 0); }
                @Override public void onAuthenticationError(int code, CharSequence msg) { bioResult(false, code); }
            });
        } catch (Throwable t) { bioResult(false, -2); }
    }

    private File stateFile() { return new File(getFilesDir(), "raseed_state.json"); }

    private File snapDir() { File d = new File(getFilesDir(), "snapshots"); if (!d.exists()) d.mkdirs(); return d; }

    private String readFile(File f) {
        InputStream in = null;
        try {
            if (!f.exists()) return "";
            in = new FileInputStream(f);
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192]; int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            return new String(bo.toByteArray(), UTF8);
        } catch (Exception e) { return ""; }
        finally { try { if (in != null) in.close(); } catch (Exception ignored) { } }
    }

    /** One restore point per day; a much smaller save never overwrites a bigger one (kept as a separate point). Keeps the newest 14. */
    private void snapshot(String json) throws Exception {
        String day = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(new java.util.Date());
        File f = new File(snapDir(), "day-" + day + ".json");
        byte[] data = json.getBytes(UTF8);
        if (f.exists() && data.length < f.length() / 2) {
            File keep = new File(snapDir(), "day-" + day + "-before-" + System.currentTimeMillis() + ".json");
            if (!f.renameTo(keep)) return;
        }
        FileOutputStream fo = new FileOutputStream(f);
        try { fo.write(data); } finally { fo.close(); }
        File[] fs = snapDir().listFiles();
        if (fs != null && fs.length > 14) {
            java.util.Arrays.sort(fs, new java.util.Comparator<File>() {
                public int compare(File a, File c) { return Long.compare(a.lastModified(), c.lastModified()); }
            });
            for (int k = 0; k < fs.length - 14; k++) fs[k].delete();
        }
    }

    private class Bridge {
        @JavascriptInterface
        public void proStatus() { ui.post(() -> { if (billing != null) { billing.restore(); } }); }
        @JavascriptInterface
        public void proBuy() { ui.post(() -> { if (billing != null) billing.buy(); }); }
        @JavascriptInterface
        public void proRestore() { ui.post(() -> { if (billing != null) billing.restore(true); }); }
        @JavascriptInterface
        public void setLang(String l) { EN = "en".equals(l); }
        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null) return;
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(Math.max(1, ms), VibrationEffect.DEFAULT_AMPLITUDE));
                else v.vibrate(Math.max(1, ms));
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public void setBar(final String color, final boolean lightBackground) {
            ui.post(new Runnable() { public void run() { setBars(color, lightBackground); } });
        }

        @JavascriptInterface
        public boolean persist(String json) {
            FileOutputStream fo = null;
            try {
                File tmp = new File(getFilesDir(), "raseed_state.tmp");
                fo = new FileOutputStream(tmp);
                fo.write(json.getBytes(UTF8));
                fo.getFD().sync();
                fo.close(); fo = null;
                boolean ok = tmp.renameTo(stateFile());
                try { snapshot(json); } catch (Throwable ignored) { }
                return ok;
            } catch (Exception e) {
                return false;
            } finally {
                try { if (fo != null) fo.close(); } catch (Exception ignored) { }
            }
        }

        /** Daily backup into Download/Raseed — survives uninstalling the app. */
        @JavascriptInterface
        public String autoBackup(String json, String day) {
            if (Build.VERSION.SDK_INT < 29) return "";
            OutputStream os = null;
            try {
                SharedPreferences sp = getSharedPreferences("raseed_backup", Context.MODE_PRIVATE);
                ContentResolver cr = getContentResolver();
                String us = sp.getString("uri", null);
                Uri u = null;
                if (us != null) {
                    try { u = Uri.parse(us); os = cr.openOutputStream(u, "wt"); } catch (Exception e) { os = null; u = null; }
                }
                if (os == null) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, "raseed-auto-backup.json");
                    v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Raseed");
                    u = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (u == null) return "";
                    os = cr.openOutputStream(u, "wt");
                }
                os.write(json.getBytes(UTF8));
                os.flush();
                sp.edit().putString("uri", u.toString()).putString("day", day).apply();
                return "Download/Raseed/raseed-auto-backup.json";
            } catch (Throwable t) {
                return "";
            } finally {
                try { if (os != null) os.close(); } catch (Exception ignored) { }
            }
        }

        @JavascriptInterface
        public String listSnapshots() {
            StringBuilder b = new StringBuilder("[");
            File[] fs = snapDir().listFiles();
            if (fs != null) {
                java.util.Arrays.sort(fs, new java.util.Comparator<File>() {
                    public int compare(File a, File c) { return Long.compare(c.lastModified(), a.lastModified()); }
                });
                boolean first = true;
                for (File f : fs) {
                    if (!f.getName().endsWith(".json")) continue;
                    if (!first) b.append(',');
                    first = false;
                    b.append("{\"name\":\"").append(f.getName()).append("\",\"t\":").append(f.lastModified()).append(",\"size\":").append(f.length()).append('}');
                }
            }
            return b.append(']').toString();
        }

        @JavascriptInterface
        public String readSnapshot(String name) {
            if (name == null || name.contains("/") || name.contains("..")) return "";
            return readFile(new File(snapDir(), name));
        }

        @JavascriptInterface
        public String restore() {
            InputStream in = null;
            try {
                File f = stateFile();
                if (!f.exists()) return "";
                in = new FileInputStream(f);
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                return new String(bo.toByteArray(), UTF8);
            } catch (Exception e) {
                return "";
            } finally {
                try { if (in != null) in.close(); } catch (Exception ignored) { }
            }
        }

        @JavascriptInterface
        public boolean saveFile(final String name, final String data, final String mime) {
            ui.post(new Runnable() {
                public void run() {
                    try {
                        pendingSaveData = data;
                        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                        i.addCategory(Intent.CATEGORY_OPENABLE);
                        i.setType(mime == null || mime.length() == 0 ? "application/octet-stream" : mime);
                        i.putExtra(Intent.EXTRA_TITLE, name);
                        startActivityForResult(i, REQ_SAVE);
                    } catch (Exception e) {
                        pendingSaveData = null;
                        if (web != null) web.evaluateJavascript("window.raseedSaved&&window.raseedSaved(false)", null);
                    }
                }
            });
            return true;
        }

        @JavascriptInterface
        public boolean bioAvailable() {
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    BiometricManager bm = (BiometricManager) getSystemService(Context.BIOMETRIC_SERVICE);
                    return bm != null && bm.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS;
                }
                if (Build.VERSION.SDK_INT == 28) return getPackageManager().hasSystemFeature("android.hardware.fingerprint");
            } catch (Throwable ignored) { }
            return false;
        }

        @JavascriptInterface
        public void bioAuth(final String title, final String subtitle) {
            ui.post(new Runnable() { public void run() { startBio(title, subtitle); } });
        }

        @JavascriptInterface
        public String takeOpen() { String v = pendingOpen; pendingOpen = null; return v == null ? "" : v; }

        @JavascriptInterface
        public void syncReminders(String json) {
            try { Reminders.save(MainActivity.this, json); } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public boolean notifAllowed() {
            try {
                android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                return nm == null || nm.areNotificationsEnabled();
            } catch (Exception e) { return true; }
        }

        @JavascriptInterface
        public boolean requestNotif() {
            if (Build.VERSION.SDK_INT < 33) return notifAllowed();
            if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") == 0) return true;
            ui.post(new Runnable() { public void run() {
                try { requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 7); } catch (Exception ignored) { }
            } });
            return false;
        }

        @JavascriptInterface
        public void openNotifSettings() {
            ui.post(new Runnable() { public void run() {
                try {
                    Intent i = new Intent("android.settings.APP_NOTIFICATION_SETTINGS");
                    i.putExtra("android.provider.extra.APP_PACKAGE", getPackageName());
                    startActivity(i);
                } catch (Exception e) {
                    try { startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); } catch (Exception ignored) { }
                }
            } });
        }

        @JavascriptInterface
        public void testNotif(String kind) {
            try {
                if ("daily".equals(kind)) Reminders.fireDaily(MainActivity.this, true);
                else Reminders.fireInstallments(MainActivity.this, true);
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public void makePdf(final String html, final String fileName) {
            ui.post(new Runnable() { public void run() { buildPdf(html, fileName); } });
        }

        @JavascriptInterface
        public void openLast() {
            ui.post(new Runnable() { public void run() {
                if (lastSaved == null) return;
                try {
                    Intent i = new Intent(Intent.ACTION_VIEW);
                    i.setDataAndType(lastSaved, lastSavedMime == null ? "*/*" : lastSavedMime);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(Intent.createChooser(i, EN ? "Open report with" : "افتح التقرير بـ"));
                } catch (Exception e) { jsToast(EN ? "No app can open this file" : "مفيش برنامج يفتح الملف ده"); }
            } });
        }

        @JavascriptInterface
        public void shareLast() {
            ui.post(new Runnable() { public void run() {
                if (lastSaved == null) return;
                try {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType(lastSavedMime == null ? "*/*" : lastSavedMime);
                    i.putExtra(Intent.EXTRA_STREAM, lastSaved);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(i, EN ? "Share report" : "شارك التقرير"));
                } catch (Exception e) { jsToast(EN ? "Couldn't share the file" : "مقدرتش أشارك الملف"); }
            } });
        }

        @JavascriptInterface
        public void print(final String html, final String title) {
            ui.post(new Runnable() {
                public void run() { doPrint(html, title); }
            });
        }
    }

    private void jsToast(String msg) {
        if (web == null) return;
        String m = msg.replace("\\", "").replace("'", "");
        web.evaluateJavascript("window.toast&&toast('" + m + "','info-circle')", null);
    }

    private void pdfFailed(final String html, final String name) {
        pdfBusy = false;
        if (web != null) web.evaluateJavascript("window.raseedPdfFailed&&window.raseedPdfFailed()", null);
    }

    /** Renders report HTML into a real multi-page A4 PDF file, then lets the user pick where to save it. */
    private void buildPdf(final String html, final String fileName) {
        if (pdfBusy) return;
        pdfBusy = true;
        try {
            final float d = getResources().getDisplayMetrics().density;
            final int W = Math.round(794 * d), H = Math.round(1123 * d);
            final WebView pw = new WebView(this);
            pw.setBackgroundColor(Color.WHITE);
            pw.setVerticalScrollBarEnabled(false);
            WebSettings ps = pw.getSettings();
            ps.setJavaScriptEnabled(true);
            ps.setAllowFileAccess(true);
            ps.setTextZoom(100);
            ps.setUseWideViewPort(false);
            ps.setLoadWithOverviewMode(false);
            root.addView(pw, 0, new FrameLayout.LayoutParams(W, H));
            pw.setWebViewClient(new WebViewClient() {
                private boolean done = false;
                @Override
                public void onPageFinished(final WebView view, String url) {
                    if (done) return;
                    done = true;
                    ui.postDelayed(new Runnable() { public void run() {
                        view.evaluateJavascript("(window.paginate?window.paginate():1)", new ValueCallback<String>() {
                            @Override
                            public void onReceiveValue(String v) {
                                int pages = 1;
                                try { pages = Integer.parseInt(v.replaceAll("[^0-9]", "")); } catch (Exception ignored) { }
                                if (pages < 1) pages = 1;
                                if (pages > 60) pages = 60;
                                final int n = pages;
                                ui.postDelayed(new Runnable() { public void run() { renderPages(pw, W, H, n, fileName); } }, 450);
                            }
                        });
                    } }, 700);
                }
            });
            pw.loadDataWithBaseURL("file:///android_asset/www/", html, "text/html", "UTF-8", null);
        } catch (Throwable t) {
            pdfFailed(html, fileName);
        }
    }

    private void renderPages(WebView pw, int W, int H, int pages, String fileName) {
        PdfDocument doc = null;
        FileOutputStream fo = null;
        try {
            pw.measure(View.MeasureSpec.makeMeasureSpec(W, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(H, View.MeasureSpec.EXACTLY));
            pw.layout(0, 0, W, H);
            doc = new PdfDocument();
            Paint paint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
            Rect dst = new Rect(0, 0, 595, 842);
            for (int i = 0; i < pages; i++) {
                Bitmap bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
                Canvas c = new Canvas(bmp);
                c.drawColor(Color.WHITE);
                c.translate(0, -i * H);
                pw.draw(c);
                if (i == 0) {
                    float dd = W / 794f; int hits = 0;
                    for (int k = 1; k < 8; k++) {
                        int px = bmp.getPixel(Math.min(W - 1, Math.round(W * k / 8f)), Math.min(H - 1, Math.round(75 * dd)));
                        if ((px & 0xFFFFFF) != 0xFFFFFF) hits++;
                    }
                    if (hits < 3) { bmp.recycle(); throw new IllegalStateException("blank render"); }
                }
                PdfDocument.PageInfo info = new PdfDocument.PageInfo.Builder(595, 842, i + 1).create();
                PdfDocument.Page page = doc.startPage(info);
                page.getCanvas().drawBitmap(bmp, null, dst, paint);
                doc.finishPage(page);
                bmp.recycle();
            }
            File out = new File(getCacheDir(), "report.pdf");
            fo = new FileOutputStream(out);
            doc.writeTo(fo);
            fo.close(); fo = null;
            doc.close(); doc = null;
            root.removeView(pw);
            pw.destroy();
            pdfBusy = false;
            pendingSaveFile = out;
            pendingSaveData = null;
            pendingKind = "pdf";
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("application/pdf");
            i.putExtra(Intent.EXTRA_TITLE, fileName);
            startActivityForResult(i, REQ_SAVE);
            if (web != null) web.evaluateJavascript("window.raseedPdfReady&&window.raseedPdfReady(" + pages + ")", null);
        } catch (Throwable t) {
            try { if (fo != null) fo.close(); } catch (Exception ignored) { }
            try { if (doc != null) doc.close(); } catch (Exception ignored) { }
            try { root.removeView(pw); pw.destroy(); } catch (Exception ignored) { }
            pdfFailed(null, fileName);
        }
    }

    private void doPrint(String html, final String title) {
        try {
            final WebView pw = new WebView(this);
            printWeb = pw;
            WebSettings ps = pw.getSettings();
            ps.setAllowFileAccess(true);
            ps.setJavaScriptEnabled(false);
            ps.setTextZoom(100);
            pw.setWebViewClient(new WebViewClient() {
                private boolean done = false;
                @Override
                public void onPageFinished(final WebView view, String url) {
                    if (done) return;
                    done = true;
                    ui.postDelayed(new Runnable() {
                        public void run() {
                            try {
                                PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                                PrintDocumentAdapter ad = view.createPrintDocumentAdapter(title);
                                PrintAttributes attrs = new PrintAttributes.Builder()
                                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                        .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                                        .build();
                                pm.print(title, ad, attrs);
                            } catch (Exception ignored) { }
                        }
                    }, 700);
                }
            });
            pw.loadDataWithBaseURL("file:///android_asset/www/", html, "text/html", "UTF-8", null);
        } catch (Exception ignored) { }
    }

    @Override
    protected void onResume() {
        super.onResume();
        try { if (billing != null) billing.restore(); } catch (Throwable ignored) { }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.evaluateJavascript("window.raseedFlush&&window.raseedFlush()", null);
    }
}
