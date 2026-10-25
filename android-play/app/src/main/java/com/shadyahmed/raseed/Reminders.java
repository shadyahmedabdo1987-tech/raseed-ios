package com.shadyahmed.raseed;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class Reminders extends BroadcastReceiver {
    static final String PREFS = "raseed_reminders";
    static final String KEY = "config";
    static final String CH_INST = "installments";
    static final String CH_DAILY = "daily";
    static final String ACT_INST = "com.shadyahmed.raseed.REMIND_INST";
    static final String ACT_DAILY = "com.shadyahmed.raseed.REMIND_DAILY";
    static final int FLAG_IMMUTABLE = 0x04000000;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        try {
            String a = intent == null ? null : intent.getAction();
            if (ACT_INST.equals(a)) fireInstallments(ctx, false);
            else if (ACT_DAILY.equals(a)) fireDaily(ctx, false);
        } catch (Exception ignored) { }
        try { schedule(ctx); } catch (Exception ignored) { }
    }

    /* ---------- config ---------- */
    static void save(Context ctx, String json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
        schedule(ctx);
    }

    static JSONObject cfg(Context ctx) {
        try {
            SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String s = p.getString(KEY, null);
            if (s == null) return null;
            return new JSONObject(s);
        } catch (Exception e) { return null; }
    }

    /* ---------- scheduling ---------- */
    static void schedule(Context ctx) {
        JSONObject c = cfg(ctx);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pInst = pending(ctx, ACT_INST, 11);
        PendingIntent pDaily = pending(ctx, ACT_DAILY, 12);
        am.cancel(pInst);
        am.cancel(pDaily);
        if (c == null) return;
        if (c.optBoolean("inst", true)) setAlarm(am, nextAt(c.optInt("hour", 10), c.optInt("min", 0)), pInst);
        if (c.optBoolean("daily", false)) setAlarm(am, nextAt(c.optInt("dailyHour", 21), c.optInt("dailyMin", 0)), pDaily);
    }

    static void setAlarm(AlarmManager am, long at, PendingIntent pi) {
        if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else am.set(AlarmManager.RTC_WAKEUP, at, pi);
    }

    static PendingIntent pending(Context ctx, String action, int code) {
        Intent i = new Intent(ctx, Reminders.class);
        i.setAction(action);
        return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | FLAG_IMMUTABLE);
    }

    static long nextAt(int hour, int min) {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, hour);
        c.set(Calendar.MINUTE, min);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() <= System.currentTimeMillis() + 5000) c.add(Calendar.DAY_OF_MONTH, 1);
        return c.getTimeInMillis();
    }

    /* ---------- firing ---------- */
    static String day(int offset) {
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_MONTH, offset);
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.getTime());
    }

    static long daysBetween(String a, String b) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            Date da = f.parse(a), db = f.parse(b);
            return Math.round((db.getTime() - da.getTime()) / 86400000.0);
        } catch (Exception e) { return 0; }
    }

    static String digits(String s, boolean ar) {
        if (!ar) return s;
        StringBuilder b = new StringBuilder();
        for (char ch : s.toCharArray()) b.append(ch >= '0' && ch <= '9' ? (char) ('٠' + (ch - '0')) : ch);
        return b.toString();
    }

    static boolean EN = false;
    static String L(String ar, String en) { return EN ? en : ar; }

    static String when(long d, boolean ar) {
        if (EN) {
            if (d < 0) return (-d) + (d == -1 ? " day overdue" : " days overdue");
            if (d == 0) return "today";
            if (d == 1) return "tomorrow";
            return "in " + d + " days";
        }
        if (d < 0) return "متأخر " + digits(String.valueOf(-d), ar) + " يوم";
        if (d == 0) return "النهارده";
        if (d == 1) return "بكرة";
        if (d == 2) return "بعد بكرة";
        return "بعد " + digits(String.valueOf(d), ar) + " أيام";
    }

    static int fireInstallments(Context ctx, boolean test) throws Exception {
        JSONObject c = cfg(ctx);
        if (c == null) return 0;
        EN = "en".equals(c.optString("lang", "ar"));
        boolean ar = !EN && !"en".equals(c.optString("digits", "ar"));
        int before = c.optInt("before", 1);
        String t = day(0);
        JSONArray arr = c.optJSONArray("items");
        List<String> lines = new ArrayList<String>();
        int late = 0;
        if (arr != null) {
            for (int k = 0; k < arr.length(); k++) {
                JSONObject o = arr.getJSONObject(k);
                long d = daysBetween(t, o.optString("due"));
                if (d > before) continue;
                if (d < 0) late++;
                boolean owe = !"owed".equals(o.optString("dir"));
                lines.add((owe ? L("قسط ", "Installment ") : L("تحصيل من ", "Collect from ")) + o.optString("name") + ": " + o.optString("amt") + " — " + when(d, ar));
            }
        }
        if (lines.isEmpty()) {
            if (test) post(ctx, CH_INST, 21, L("رصيد — الإشعارات شغالة ✅", "Raseed — notifications are on ✅"), L("هفكّرك هنا قبل ميعاد أي قسط.", "I'll remind you here before any installment is due."), null);
            return 0;
        }
        String title;
        if (lines.size() == 1) title = late > 0 ? L("⚠️ عندك قسط متأخر", "⚠️ You have an overdue installment") : L("🔔 تذكير بقسط", "🔔 Installment reminder");
        else if (EN) title = late > 0 ? "⚠️ " + lines.size() + " installments (some overdue)" : "🔔 " + lines.size() + " installments coming up";
        else title = late > 0 ? "⚠️ عندك " + digits(String.valueOf(lines.size()), ar) + " أقساط (منها متأخر)" : "🔔 عندك " + digits(String.valueOf(lines.size()), ar) + " أقساط قرّبت";
        post(ctx, CH_INST, 21, title, lines.get(0), lines);
        return lines.size();
    }

    static void fireDaily(Context ctx, boolean test) {
        JSONObject c = cfg(ctx);
        if (c == null) return;
        if (!test && day(0).equals(c.optString("lastTx"))) return;
        EN = "en".equals(c.optString("lang", "ar"));
        post(ctx, CH_DAILY, 22, L("✍️ سجّلت مصروفات النهارده؟", "✍️ Did you log today's expenses?"), L("دقيقة واحدة تسجّل فيها اللي صرفته عشان تقاريرك تبقى مظبوطة.", "Take one minute to log what you spent so your reports stay accurate."), null);
    }

    static void channels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel a = new NotificationChannel(CH_INST, "تذكير الأقساط", NotificationManager.IMPORTANCE_HIGH);
        a.setDescription("تنبيه قبل ميعاد كل قسط وعند التأخير");
        nm.createNotificationChannel(a);
        NotificationChannel b = new NotificationChannel(CH_DAILY, "تذكير يومي", NotificationManager.IMPORTANCE_DEFAULT);
        b.setDescription("تذكير بتسجيل مصروفات اليوم");
        nm.createNotificationChannel(b);
    }

    @SuppressWarnings("deprecation")
    static void post(Context ctx, String ch, int id, String title, String text, List<String> lines) {
        try {
            channels(ctx);
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            Intent open = new Intent(ctx, MainActivity.class);
            open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            open.putExtra("openView", CH_INST.equals(ch) ? "debts" : "add");
            PendingIntent pi = PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_UPDATE_CURRENT | FLAG_IMMUTABLE);
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, ch) : new Notification.Builder(ctx);
            b.setSmallIcon(R.drawable.ic_notif)
                    .setContentTitle(title)
                    .setContentText(text)
                    .setColor(0xFF4F46E5)
                    .setAutoCancel(true)
                    .setContentIntent(pi)
                    .setWhen(System.currentTimeMillis())
                    .setShowWhen(true);
            if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
            if (lines != null && lines.size() > 1) {
                Notification.InboxStyle st = new Notification.InboxStyle();
                for (String l : lines) st.addLine(l);
                st.setBigContentTitle(title);
                b.setStyle(st);
            } else {
                b.setStyle(new Notification.BigTextStyle().bigText(text));
            }
            nm.notify(id, b.build());
        } catch (Exception ignored) { }
    }

    /* ---------- boot ---------- */
    public static class Boot extends BroadcastReceiver {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            try { schedule(ctx); } catch (Exception ignored) { }
        }
    }
}
