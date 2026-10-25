/* ---------- Raseed full version: one-time purchase (Google Play) ----------
   Selling starts when the product "raseed_full" is ACTIVE in Play Console.
   From the day the app first sees it, every user gets PRO_TRIAL_DAYS free; after that adding / editing
   needs the one-time purchase. Viewing, reports, PDF and backup always keep working.
   iPhone: same idea, but Apple requires the free period to be a free "30-day Trial" item the user starts
   (its purchase date is the trial start, kept by the App Store across reinstalls). */
const PRO_TRIAL_DAYS = 30;
const PRO_ON = false; // رصيد مجاني بالكامل — خليها true لو حبيت ترجّع الدفع
const Pro = {
  active: false, available: false, checked: false, price: '', pending: false, trialStart: '', trialAvailable: false,
  enabled() { return PRO_ON && !!(NATIVE && NATIVE.proBuy); },
  selling() { return this.enabled() && this.available; },
  start() {
    if (!this.selling()) return '';
    if (IOS) return this.trialStart || '';
    let t = '';
    try { t = localStorage.getItem('raseed_sell0') || ''; } catch (e) { }
    if (!t) t = S().sellStart || '';
    if (!t) t = today();
    try { localStorage.setItem('raseed_sell0', t); } catch (e) { }
    if (S().sellStart !== t) { S().sellStart = t; Store.save(); }
    return t;
  },
  daysLeft() {
    const st = this.start(); if (!st) return PRO_TRIAL_DAYS;
    const s = parseD(st); const end = new Date(s.getFullYear(), s.getMonth(), s.getDate() + PRO_TRIAL_DAYS);
    return Math.max(0, Math.ceil((end - parseD(today())) / 864e5));
  },
  needTrial() { return IOS && this.selling() && !this.active && !this.trialStart; },
  locked() { return this.selling() && !this.active && (this.needTrial() || this.daysLeft() <= 0); },
  refresh() { try { if (this.enabled()) NATIVE.proStatus(); } catch (e) { } },
  guard() { if (this.locked()) { paywall(!this.needTrial(), this.needTrial()); return false; } return true; }
};
window.raseedPro = st => {
  const was = Pro.active;
  Pro.checked = true; Pro.active = !!st.active; Pro.available = !!st.available; Pro.pending = !!st.pending;
  if (st.price) Pro.price = st.price;
  if (st.trialStart != null) Pro.trialStart = st.trialStart || '';
  Pro.trialAvailable = !!st.trialAvailable;
  if (st.event === 'trial') { toast('بدأت الفترة المجانية — ٣٠ يوم ✓', 'check'); closePaywall(true); }
  busy && busy(false);
  if (Pro.active && !was && st.event === 'bought') { toast('شكراً! النسخة الكاملة اتفعّلت 💙', 'check'); closePaywall(true); }
  if (st.event === 'restored') toast(Pro.active ? 'رجّعنا مشترياتك ✓' : 'مفيش شراء على الحساب ده', Pro.active ? 'check' : 'info-circle');
  if (st.event === 'pending') toast('الدفع قيد التأكيد — هيتفعّل أول ما يتأكد', 'clock');
  if (st.event === 'failed') toast('العملية ماكملتش', 'info-circle');
  if (Pro.active) closePaywall(true);
  Pro.start();
  if (['home', 'settings'].includes(App.view)) refresh();
};

function paywall(force, trial) {
  let P = $('#pay');
  if (!P) { P = document.createElement('div'); P.id = 'pay'; document.body.appendChild(P); }
  const price = Pro.price || '٥٠ ج.م';
  P.innerHTML = `<button class="pay-x" onclick="closePaywall(true)">${I('x')}</button>
    <div class="pay-in">
      <img src="${LOGO_URL}" alt="">
      <h2>${trial ? 'جرّب النسخة الكاملة ٣٠ يوم مجاناً' : force ? 'خلصت الفترة المجانية' : 'افتح النسخة الكاملة'}</h2>
      <p class="muted">${trial ? `ابدأ الفترة المجانية عشان تكمّل تضيف وتعدّل. بعد ٣٠ يوم، الإضافة والتعديل هيحتاجوا شراء النسخة الكاملة بـ ${esc(price)} مرة واحدة — ومش هيتخصم منك أي حاجة لوحده.` : force ? 'افتح النسخة الكاملة عشان تكمّل تضيف وتعدّل — بياناتك كلها محفوظة وتقدر تشوفها وتطلّع تقاريرها.' : 'كل مميزات رصيد من غير حدود — بتدفع مرة واحدة بس.'}</p>
      <div class="pay-list">
        <div>${I('check')} مصروفات وإيداعات ومرتب بلا حدود</div>
        <div>${I('check')} المديونيات والأقساط مع التذكير</div>
        <div>${I('check')} البطاقات البنكية والميزانيات</div>
        <div>${I('check')} التقارير والتحليل وتصدير PDF</div>
      </div>
      <div class="pay-price"><b class="notr">${esc(price)}</b> <span>مرة واحدة</span><small>من غير اشتراك ومن غير تجديد</small></div>
      ${trial ? `<button class="btn" id="payTrial">${I('gift')} ابدأ ٣٠ يوم مجاناً</button>` : ''}
      <button class="btn ${trial ? 'ghost' : ''}" id="payBuy">${I('crown')} افتح النسخة الكاملة</button>
      <button class="btn ghost" id="payRestore">${I('refresh')} استرجاع الشراء</button>
      <p class="pay-legal">${IOS ? 'الدفع بيتم عن طريق App Store على حساب Apple ID بتاعك. لو غيّرت الموبايل، اضغط «استرجاع الشراء» بنفس الحساب.' : 'الدفع بيتم عن طريق Google Play على حسابك. لو غيّرت الموبايل، اضغط «استرجاع الشراء» بنفس الحساب.'}<br>
      <a href="https://alabdo-toys.com/raseed/privacy.html" target="_blank">سياسة الخصوصية</a></p>
    </div>`;
  P.classList.add('show');
  $('#payBuy', P).onclick = () => { busy(true, 'بنفتح صفحة الدفع…'); try { NATIVE.proBuy(); } catch (e) { busy(false); } };
  if (trial) $('#payTrial', P).onclick = () => { busy(true, 'بنجهّز الفترة المجانية…'); try { NATIVE.proTrial(); } catch (e) { busy(false); } };
  $('#payRestore', P).onclick = () => { busy(true, 'بندوّر على مشترياتك…'); try { NATIVE.proRestore(); } catch (e) { busy(false); } };
  updateBar && updateBar();
}
function closePaywall() { const P = $('#pay'); if (P && P.classList.contains('show')) { P.classList.remove('show'); updateBar && updateBar(); } }
function proRow(row) {
  if (!Pro.selling()) return '';
  if (Pro.active) return row('crown', '#F59E0B', 'النسخة الكاملة', 'مفعّلة ✓ — شكراً لدعمك', `toast('النسخة الكاملة مفعّلة ✓','check')`);
  if (Pro.needTrial()) return row('crown', '#F59E0B', 'النسخة الكاملة', 'جرّبها ٣٠ يوم مجاناً', `paywall(false, true)`, `<span class="badge b-amber">٣٠</span>`);
  const left = Pro.daysLeft();
  return row('crown', '#F59E0B', 'النسخة الكاملة', left > 0 ? (EN ? `Free period — ${left} days left` : `فترة مجانية — فاضل ${N(left)} يوم`) : 'خلصت الفترة المجانية — افتحها دلوقتي', `paywall(false)`, `<span class="badge b-amber">${left > 0 ? N(left) : '!'}</span>`);
}
function proBanner() {
  if (!Pro.selling() || Pro.active) return '';
  if (Pro.needTrial()) return `<button class="alert b-indigo" style="width:100%;text-align:start" onclick="paywall(false, true)">${I('gift')}<span style="flex:1">جرّب النسخة الكاملة ٣٠ يوم مجاناً — ابدأ دلوقتي</span>${I('chevron-left')}</button>`;
  const left = Pro.daysLeft();
  if (left > 7) return '';
  return `<button class="alert ${left ? 'b-amber' : 'b-red'}" style="width:100%;text-align:start" onclick="paywall(${left ? 'false' : 'true'})">${I('crown')}<span style="flex:1">${left ? (EN ? `${left} days left in your free period — unlock the full version for ${esc(Pro.price || 'EGP 50')}` : `فاضل ${N(left)} يوم على نهاية الفترة المجانية — افتح النسخة الكاملة بـ ${esc(Pro.price || '٥٠ ج.م')}`) : 'خلصت الفترة المجانية — افتح النسخة الكاملة عشان تكمّل تضيف وتعدّل'}</span>${I('chevron-left')}</button>`;
}
