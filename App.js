// رصيد — iOS shell: the same app UI (web/bundle.js) inside a WebView,
// with a native bridge (window.RaseedNative) that mirrors the Android one.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Linking, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import BUNDLE from './web/bundle';

SplashScreen.preventAutoHideAsync().catch(() => {});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const DOCS = FileSystem.documentDirectory;
const STATE_FILE = DOCS + '.raseed_state.json';
const BACKUP_FILE = DOCS + 'raseed-auto-backup.json';
const BG = '#070B3E';

/* ---------- helpers ---------- */
const AR = '٠١٢٣٤٥٦٧٨٩';
const digits = (s, ar) => (ar ? String(s).replace(/[0-9]/g, d => AR[d]) : String(s));
const pad = n => String(n).padStart(2, '0');
const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
const whenText = (d, ar) => d < 0 ? `متأخر ${digits(-d, ar)} يوم` : d === 0 ? 'النهارده' : d === 1 ? 'بكرة' : d === 2 ? 'بعد بكرة' : `بعد ${digits(d, ar)} أيام`;
const safeName = n => String(n || 'file').replace(/[\\/:*?"<>|]+/g, '-');

async function readText(uri) {
  try { const i = await FileSystem.getInfoAsync(uri); if (!i.exists) return ''; return await FileSystem.readAsStringAsync(uri); } catch (e) { return ''; }
}

async function bioAvailable() {
  try { return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()); } catch (e) { return false; }
}

async function notifGranted() {
  try { const p = await Notifications.getPermissionsAsync(); return !!(p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL); } catch (e) { return false; }
}

/* ---------- reminders (local notifications) ---------- */
async function scheduleReminders(cfg) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!(await notifGranted())) return;
    const ar = cfg.digits !== 'en';
    const now = new Date();
    const at = (day, hour) => { const d = parseDay(day); d.setHours(hour || 0, 0, 0, 0); return d; };
    const jobs = [];
    if (cfg.inst !== false) {
      const before = Number(cfg.before ?? 1), hour = Number(cfg.hour ?? 10);
      (cfg.items || []).slice(0, 25).forEach(it => {
        const owe = it.dir !== 'owed';
        const what = (owe ? 'قسط ' : 'تحصيل من ') + it.name + ': ' + it.amt;
        const days = before > 0 ? [before, 0] : [0];
        days.forEach(b => {
          const d = parseDay(it.due); d.setDate(d.getDate() - b);
          const fire = at(isoDay(d), hour);
          if (fire > now) jobs.push({ date: fire, title: b === 0 ? '🔔 النهارده ميعاد قسط' : '🔔 تذكير بقسط', body: `${what} — ${whenText(b, ar)}`, open: 'debts' });
        });
        // one overdue nudge the day after the due date
        const late = parseDay(it.due); late.setDate(late.getDate() + 1);
        const lf = at(isoDay(late), hour);
        if (lf > now) jobs.push({ date: lf, title: '⚠️ قسط متأخر', body: `${what} — ${whenText(-1, ar)}`, open: 'debts' });
      });
    }
    jobs.sort((a, b) => a.date - b.date);
    const list = jobs.slice(0, 48);
    if (cfg.daily) {
      const hour = Number(cfg.dailyHour ?? 21);
      for (let k = 0; k < 14; k++) {
        const d = new Date(); d.setDate(d.getDate() + k);
        const day = isoDay(d);
        if (k === 0 && cfg.lastTx === day) continue;
        const fire = at(day, hour);
        if (fire > now) list.push({ date: fire, title: '✍️ سجّلت مصروفات النهارده؟', body: 'دقيقة واحدة تسجّل فيها اللي صرفته عشان تقاريرك تبقى مظبوطة.', open: 'add' });
      }
    }
    for (const j of list.slice(0, 60)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: j.title, body: j.body, sound: true, data: { openView: j.open } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: j.date },
      });
    }
  } catch (e) { /* best effort */ }
}

/* ---------- the JS shim injected before the app loads ---------- */
const SHIM = `
(function(){
  var I = window.__RN_INIT || {};
  function post(m, a){ try { window.ReactNativeWebView.postMessage(JSON.stringify({ m: m, a: a || [] })); } catch (e) {} }
  var SNAP = 'raseed_snaps';
  function snaps(){ try { return JSON.parse(localStorage.getItem(SNAP) || '{}'); } catch (e) { return {}; } }
  function snapshot(json){
    try {
      var d = new Date(), p = function(n){ return (n < 10 ? '0' : '') + n; };
      var key = 'day-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.json';
      var s = snaps();
      if (s[key] && json.length < s[key].j.length / 2) s[key.replace('.json', '-before-' + Date.now() + '.json')] = s[key];
      s[key] = { t: Date.now(), j: json };
      var ks = Object.keys(s).sort(function(a, b){ return s[b].t - s[a].t; });
      ks.slice(14).forEach(function(k){ delete s[k]; });
      try { localStorage.setItem(SNAP, JSON.stringify(s)); }
      catch (e) { ks.slice(5).forEach(function(k){ delete s[k]; }); try { localStorage.setItem(SNAP, JSON.stringify(s)); } catch (e2) {} }
    } catch (e) {}
  }
  window.RaseedNative = {
    platform: 'ios',
    vibrate: function(ms){ post('vibrate', [ms]); },
    setBar: function(c, light){ post('setBar', [c, !!light]); },
    persist: function(json){ post('persist', [json]); snapshot(json); return true; },
    restore: function(){ return I.state || ''; },
    autoBackup: function(json, day){ post('autoBackup', [json, day]); return 'files'; },
    listSnapshots: function(){ var s = snaps(); return JSON.stringify(Object.keys(s).sort(function(a, b){ return s[b].t - s[a].t; }).map(function(k){ return { name: k, t: s[k].t, size: s[k].j.length }; })); },
    readSnapshot: function(n){ var s = snaps(); return s[n] ? s[n].j : ''; },
    saveFile: function(name, data, mime){ post('saveFile', [name, data, mime]); return true; },
    makePdf: function(html, name){ post('makePdf', [html, name]); },
    print: function(html, title){ post('print', [html, title]); },
    openLast: function(){ post('shareLast'); },
    shareLast: function(){ post('shareLast'); },
    takeOpen: function(){ var v = I.open || ''; I.open = ''; return v; },
    syncReminders: function(json){ post('syncReminders', [json]); },
    notifAllowed: function(){ return I.notif !== false; },
    requestNotif: function(){ post('requestNotif'); return I.notif === true; },
    openNotifSettings: function(){ post('openSettings'); },
    testNotif: function(kind){ post('testNotif', [kind]); },
    bioAvailable: function(){ return !!I.bio; },
    bioAuth: function(title, sub){ post('bioAuth', [title, sub]); }
  };
  window.__RN_SET = function(k, v){ I[k] = v; };
})();
true;`;

export default function App() {
  const web = useRef(null);
  const lastShared = useRef(null);
  const [init, setInit] = useState(null);
  const [bar, setBar] = useState('light');

  const js = useCallback(code => { try { web.current && web.current.injectJavaScript(code + ';true;'); } catch (e) {} }, []);

  // read saved data + device capabilities before the page starts
  useEffect(() => {
    (async () => {
      const [state, bio, notif, last] = await Promise.all([
        readText(STATE_FILE),
        bioAvailable(),
        notifGranted(),
        Notifications.getLastNotificationResponseAsync().catch(() => null),
      ]);
      const open = last?.notification?.request?.content?.data?.openView || '';
      setInit({ state, bio, notif, open });
    })();
  }, []);

  // notification tapped while the app is running
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(r => {
      const v = String(r?.notification?.request?.content?.data?.openView || '').replace(/[^a-z]/g, '');
      if (v) js(`window.raseedOpen&&window.raseedOpen('${v}')`);
    });
    return () => sub.remove();
  }, [js]);

  const share = async (uri, mimeType, UTI, title) => {
    lastShared.current = { uri, mimeType, UTI, title };
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType, UTI, dialogTitle: title });
  };

  const onMessage = async e => {
    let msg; try { msg = JSON.parse(e.nativeEvent.data); } catch (er) { return; }
    const a = msg.a || [];
    try {
      switch (msg.m) {
        case 'vibrate':
          Haptics.impactAsync(a[0] > 30 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          break;
        case 'setBar':
          setBar(a[1] ? 'dark' : 'light');
          break;
        case 'persist':
          await FileSystem.writeAsStringAsync(STATE_FILE, String(a[0] || ''));
          break;
        case 'autoBackup':
          await FileSystem.writeAsStringAsync(BACKUP_FILE, String(a[0] || ''));
          break;
        case 'saveFile': {
          const uri = FileSystem.cacheDirectory + safeName(a[0]);
          await FileSystem.writeAsStringAsync(uri, String(a[1] || ''));
          js(`window.toast&&toast('اختار «حفظ في الملفات» أو ابعتها لنفسك','download')`);
          await share(uri, a[2] || 'application/json', 'public.json', 'نسخة رصيد الاحتياطية');
          break;
        }
        case 'makePdf': {
          const name = safeName(a[1] || 'Raseed-Report.pdf');
          const { uri, numberOfPages } = await Print.printToFileAsync({
            html: String(a[0] || ''), width: 595, height: 842,
            margins: { left: 28, right: 28, top: 32, bottom: 32 },
          });
          const dest = FileSystem.cacheDirectory + name;
          await FileSystem.deleteAsync(dest, { idempotent: true });
          await FileSystem.moveAsync({ from: uri, to: dest });
          js(`window.raseedPdfReady&&window.raseedPdfReady(${Number(numberOfPages) || 1})`);
          await share(dest, 'application/pdf', 'com.adobe.pdf', 'تقرير رصيد');
          break;
        }
        case 'print':
          await Print.printAsync({ html: String(a[0] || '') });
          break;
        case 'shareLast':
          if (lastShared.current) { const s = lastShared.current; await share(s.uri, s.mimeType, s.UTI, s.title); }
          break;
        case 'syncReminders':
          await scheduleReminders(JSON.parse(a[0] || '{}'));
          break;
        case 'requestNotif': {
          const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
          const ok = !!r.granted;
          js(`window.__RN_SET&&__RN_SET('notif',${ok});window.raseedNotifResult&&window.raseedNotifResult(${ok})`);
          break;
        }
        case 'openSettings':
          Linking.openSettings().catch(() => {});
          break;
        case 'testNotif': {
          const daily = a[0] === 'daily';
          await Notifications.scheduleNotificationAsync({
            content: daily
              ? { title: '✍️ سجّلت مصروفات النهارده؟', body: 'دقيقة واحدة تسجّل فيها اللي صرفته.', data: { openView: 'add' } }
              : { title: 'رصيد — الإشعارات شغالة ✅', body: 'هفكّرك هنا قبل ميعاد أي قسط.', data: { openView: 'debts' } },
            trigger: null,
          });
          break;
        }
        case 'bioAuth': {
          const r = await LocalAuthentication.authenticateAsync({
            promptMessage: a[0] || 'فتح رصيد',
            cancelLabel: 'استخدم الرقم السري',
            disableDeviceFallback: true,
          });
          js(`window.raseedBio&&window.raseedBio(${!!r.success},${r.success ? 0 : 13})`);
          break;
        }
        default: break;
      }
    } catch (err) {
      if (msg.m === 'makePdf') js(`window.raseedPdfFailed&&window.raseedPdfFailed()`);
      if (msg.m === 'bioAuth') js(`window.raseedBio&&window.raseedBio(false,-2)`);
    }
  };

  if (!init) return <View style={{ flex: 1, backgroundColor: BG }} />;

  const before = `window.__RN_INIT=${JSON.stringify(init)};` + SHIM;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style={bar} />
      <WebView
        ref={web}
        source={{ html: BUNDLE, baseUrl: 'https://raseed.app/' }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={before}
        onMessage={onMessage}
        onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1, backgroundColor: BG }}
        containerStyle={{ backgroundColor: BG }}
        bounces={false}
        overScrollMode="never"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        allowsBackForwardNavigationGestures={false}
        allowsLinkPreview={false}
        dataDetectorTypes="none"
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView={false}
        textInteractionEnabled
        setSupportMultipleWindows={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onShouldStartLoadWithRequest={req => {
          const u = req.url || '';
          if (u.startsWith('https://raseed.app') || u.startsWith('about:') || u.startsWith('data:') || u.startsWith('blob:')) return true;
          Linking.openURL(u).catch(() => {});
          return false;
        }}
      />
    </View>
  );
}
