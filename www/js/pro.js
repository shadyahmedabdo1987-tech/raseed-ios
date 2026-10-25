/* ---------- Raseed Pro: 30-day in-app free period, then monthly subscription (App Store / Google Play) ---------- */
const PRO_TRIAL_DAYS = 30;
const Pro = {
  active: false, checked: false, price: '', intro: true,
  enabled() { return !!(NATIVE && NATIVE.proBuy); },
  start() {
    let t = '';
    try { t = localStorage.getItem('raseed_trial0') || ''; } catch (e) { }
    if (!t) t = S().trialStart || '';
    if (!t) t = today();
    try { localStorage.setItem('raseed_trial0', t); } catch (e) { }
    if (S().trialStart !== t) { S().trialStart = t; Store.save(); }
    return t;
  },
  daysLeft() { const s = parseD(this.start()); const end = new Date(s.getFullYear(), s.getMonth(), s.getDate() + PRO_TRIAL_DAYS); return Math.max(0, Math.ceil((end - parseD(today())) / 864e5)); },
  locked() { return this.enabled() && this.checked && !this.active && this.daysLeft() <= 0; },
  refresh() { try { if (this.enabled()) NATIVE.proStatus(); } catch (e) { } },
  check() { if (this.locked()) paywall(true); else closePaywall(); }
};
window.raseedPro = st => {
  Pro.checked = true; Pro.active = !!st.active; if (st.price) Pro.price = st.price; if (st.intro != null) Pro.intro = !!st.intro;
  busy && busy(false);
  if (st.event === 'bought') toast('شكراً لاشتراكك في رصيد 💙', 'check');
  if (st.event === 'restored') toast(Pro.active ? 'رجّعنا اشتراكك ✓' : 'مفيش اشتراك على الحساب ده', Pro.active ? 'check' : 'info-circle');
  if (st.event === 'failed') toast('العملية ماكملتش', 'info-circle');
  Pro.check();
  if (App.view === 'settings') refresh();
};

function paywall(force) {
  let P = $('#pay');
  if (!P) { P = document.createElement('div'); P.id = 'pay'; document.body.appendChild(P); }
  const price = Pro.price || '٥٠ ج.م';
  P.innerHTML = `${force ? '' : `<button class="pay-x" onclick="closePaywall()">${I('x')}</button>`}
    <div class="pay-in">
      <img src="${LOGO_URL}" alt="">
      <h2>${force ? 'خلصت الفترة المجانية' : 'اشترك في رصيد'}</h2>
      <p class="muted">${force ? 'اشترك عشان تكمّل تستخدم رصيد — بياناتك كلها محفوظة زي ما هي.' : 'كل مميزات رصيد من غير حدود.'}</p>
      <div class="pay-list">
        <div>${I('check')} مصروفات وإيداعات ومرتب بلا حدود</div>
        <div>${I('check')} المديونيات والأقساط مع التذكير</div>
        <div>${I('check')} البطاقات البنكية والميزانيات</div>
        <div>${I('check')} التقارير والتحليل وتصدير PDF</div>
      </div>
      <div class="pay-price"><b class="notr">${esc(price)}</b> <span>/ الشهر</span>${Pro.intro ? `<small>أول شهر مجاني</small>` : ''}</div>
      <button class="btn" id="payBuy">${I('crown')} ${Pro.intro ? 'ابدأ الشهر المجاني' : 'اشترك دلوقتي'}</button>
      <button class="btn ghost" id="payRestore">${I('refresh')} استرجاع الاشتراك</button>
      ${force ? `<button class="pay-link" onclick="backupExport()">${I('download')} احفظ نسخة من بياناتك</button>` : ''}
      <p class="pay-legal">${Pro.intro ? 'بعد الشهر المجاني ' : ''}الاشتراك بيتجدد تلقائي كل شهر بنفس السعر، ويتخصم من حسابك عند التأكيد. تقدر تلغيه في أي وقت من إعدادات حسابك قبل نهاية الفترة بـ ٢٤ ساعة على الأقل.<br>
      <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank">شروط الاستخدام</a> · <a href="https://alabdo-toys.com/raseed/privacy.html" target="_blank">سياسة الخصوصية</a></p>
    </div>`;
  P.classList.add('show');
  $('#payBuy', P).onclick = () => { busy(true, 'بنفتح صفحة الدفع…'); try { NATIVE.proBuy(); } catch (e) { busy(false); } };
  $('#payRestore', P).onclick = () => { busy(true, 'بندوّر على اشتراكك…'); try { NATIVE.proRestore(); } catch (e) { busy(false); } };
  updateBar && updateBar();
}
function closePaywall() { const P = $('#pay'); if (P && P.classList.contains('show') && !Pro.locked()) { P.classList.remove('show'); updateBar && updateBar(); } }
function proRow(row) {
  if (!Pro.enabled()) return '';
  const left = Pro.daysLeft();
  if (Pro.active) return row('crown', '#F59E0B', 'اشتراك رصيد', 'مشترك ✓ — إدارة الاشتراك', `NATIVE.proManage && NATIVE.proManage()`);
  return row('crown', '#F59E0B', 'اشتراك رصيد', left > 0 ? (EN ? `Free period — ${left} days left` : `فترة مجانية — فاضل ${N(left)} يوم`) : 'خلصت الفترة المجانية', `paywall(false)`, `<span class="badge b-amber">${left > 0 ? N(left) : '!'}</span>`);
}
