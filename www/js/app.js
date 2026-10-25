'use strict';
/* ====== رصيد — views ====== */
const App = { range: { p: 'month', from: '', to: '' }, view: 'home', params: {}, stack: [], sheet: null, txFilter: { month: null, type: 'all', q: '' }, debtTab: 'owe', rPeriod: 'month', slideTimer: null };
const D = () => Store.data;
const S = () => Store.data.settings;

/* ---------- navigation ---------- */
const NAV = [['home', 'home', 'الرئيسية'], ['tx', 'list-details', 'الحركات'], ['debts', 'receipt-2', 'المديونيات'], ['reports', 'chart-pie', 'التقارير']];
function buildNav() {
  $$('#nav [data-go]').forEach(b => {
    const n = NAV.find(x => x[0] === b.dataset.go);
    b.innerHTML = I(n[1]) + n[2];
    b.onclick = () => { closeFab(); go(n[0], {}, { root: true }); };
  });
  $('#fab').innerHTML = I('plus');
  $('#fab').onclick = toggleFab;
  $('#fabMenu .opts').innerHTML = [
    ['exp', 'arrow-up-right', 'مصروف', '#F43F5E'], ['inc', 'arrow-down-left', 'إيداع', '#10B981'],
    ['sal', 'briefcase', 'المرتب', '#4F46E5'], ['debt', 'receipt-2', 'مديونية', '#F59E0B'], ['card', 'credit-card', 'بطاقة بنكية', '#0EA5E9'], ['cardpay', 'credit-card-pay', 'سداد فيزا', '#8B5CF6']
  ].map(([k, ic, t, c]) => `<button class="opt" data-k="${k}"><span class="ic" style="background:${c}1f;color:${c}">${I(ic)}</span>${t}</button>`).join('');
  $$('#fabMenu .opt').forEach(b => b.onclick = e => { e.stopPropagation(); closeFab(); quick(b.dataset.k); });
  $('#fabMenu').onclick = closeFab;
}
function toggleFab() { const m = $('#fabMenu'), open = !m.classList.contains('show'); m.classList.toggle('show', open); $('#fab').classList.toggle('open', open); }
function closeFab() { $('#fabMenu').classList.remove('show'); $('#fab').classList.remove('open'); }
function quick(k) {
  if (k === 'exp') txForm({ type: 'expense' });
  else if (k === 'inc') txForm({ type: 'income', catId: 'deposit' });
  else if (k === 'sal') txForm({ type: 'income', catId: 'salary', amount: S().salary || '', note: 'مرتب ' + MONTHS[new Date().getMonth()] });
  else if (k === 'debt') debtForm();
  else if (k === 'card') cardForm();
  else if (k === 'cardpay') cardPayForm();
  else if (k === 'pay') { const u = Debt.upcoming(60)[0]; if (u) payForm(u.d, null, u.i.id); else { const f = D().debts.find(d => Debt.flex(d) && d.direction === 'owe' && !Debt.done(d)); if (f) flexEntry(f.id, 'pay'); else { toast('مفيش أقساط مستحقة', 'info-circle'); go('debts'); } } }
}
const TAB_ORDER = { home: 0, tx: 1, debts: 2, debt: 2.5, cards: 2.6, card: 2.7, reports: 3, settings: 4, cats: 5 };
function go(view, params = {}, opt = {}) {
  const from = App.view;
  App.dir = opt.back ? 'bwd' : (TAB_ORDER[view] ?? 9) >= (TAB_ORDER[from] ?? 0) ? 'fwd' : 'bwd';
  if (view === from && !opt.back) App.dir = 'same';
  if (opt.root) App.stack = [];
  else if (!opt.back && App.view !== view) App.stack.push({ view: App.view, params: App.params });
  App.view = view; App.params = params;
  $$('#nav [data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === view || (view === 'debt' && b.dataset.go === 'debts')));
  moveNavPill();
  render(App.dir);
  $('#view').scrollTop = 0;
}
function back() {
  if (ddCloseAll(null, true)) return true;
  if (App.sheet) { closeSheet(); return true; }
  if ($('#fabMenu').classList.contains('show')) { closeFab(); return true; }
  if (App.stack.length) { const p = App.stack.pop(); go(p.view, p.params, { back: true }); return true; }
  if (App.view !== 'home') { go('home', {}, { root: true, back: true }); return true; }
  return false;
}
window.raseedBack = () => back();
function moveNavPill() {
  const nav = $('#nav'), on = $('#nav [data-go].on'); let pill = $('#navPill');
  if (!pill) { pill = document.createElement('i'); pill.id = 'navPill'; nav.prepend(pill); }
  if (!on) { pill.style.opacity = 0; return; }
  const r = on.getBoundingClientRect(), nr = nav.getBoundingClientRect();
  pill.style.opacity = 1; pill.style.transform = `translateX(${r.left - nr.left + r.width / 2 - 28}px)`;
  on.classList.remove('bump'); void on.offsetWidth; on.classList.add('bump');
}
window.addEventListener('resize', () => moveNavPill());
function render(dir) {
  clearInterval(App.slideTimer); $('#view').onscroll = null;
  const v = $('#view');
  const fn = { home: vHome, tx: vTx, debts: vDebts, debt: vDebt, reports: vReports, settings: vSettings, cats: vCats, cards: vCards, card: vCard }[App.view] || vHome;
  if (dir === true) dir = 'bwd';
  v.innerHTML = `<div class="page ${dir === 'bwd' ? 'back' : dir === 'same' || !dir ? 'soft' : ''}">${fn()}</div>`;
  $$('.page > .sec, .page > .quick, .page > .chips, .page > .search, .page > .dots', v).forEach((el, k) => { el.classList.add('rise'); el.style.animationDelay = Math.min(k, 10) * 0.05 + 0.04 + 's'; });
  (AFTER[App.view] || (() => { }))();
  countUp(v); animateBars(v); bindStagger(v); updateBar();
}
function bindStagger(root) { $$('.item,.debt,.inst', root).forEach((el, k) => el.style.animationDelay = Math.min(k, 12) * 0.045 + 's'); }
const AFTER = {};
const refresh = () => { const y = $('#view').scrollTop; render('same'); $('#view').scrollTop = y; };

/* ---------- dropdown component ---------- */
const DDR = {};
function ddIcon(o) {
  if (o.swatch) return `<span class="dd-ic sw" style="background:${o.swatch}">${I(o.icon || 'credit-card')}</span>`;
  if (o.icon) { const c = o.color || '#4F46E5'; return `<span class="dd-ic" style="background:${c}1f;color:${c}">${I(o.icon)}</span>`; }
  return '';
}
const ddInner = o => `${ddIcon(o)}<span class="dd-t"><b>${esc(o.label)}</b>${o.sub ? `<small>${o.sub}</small>` : ''}</span>`;
function dd(id, opts, val, onChange, x = {}) {
  DDR[id] = { opts, onChange };
  const cur = opts.find(o => String(o.v) === String(val)) || (x.placeholder ? { v: '', label: x.placeholder, icon: x.phIcon || 'chevron-down', color: '#94A3B8' } : opts[0]);
  return `<div class="dd ${x.cls || ''}" data-dd="${id}">${x.label ? `<label class="dd-lbl">${x.label}</label>` : ''}<button type="button" class="dd-btn"><span class="dd-cur">${ddInner(cur)}</span>${I('chevron-down', 'dd-chev')}</button>
    <div class="dd-panel"><div class="dd-list">${opts.map((o, k) => `<button type="button" class="dd-opt ${String(o.v) === String(cur.v) ? 'on' : ''} ${o.cls || ''}" data-k="${k}">${ddInner(o)}${I('check', 'dd-ok')}</button>`).join('')}</div></div></div>`;
}
function ddMount(el, ...a) { if (el) el.innerHTML = dd(...a); }
function ddCloseAll(except, all) { let n = 0; $$('.dd.open').forEach(x => { if (x !== except && (all || !x.classList.contains('sugg-dd'))) { x.classList.remove('open'); n++; } }); return n; }
document.addEventListener('click', e => {
  const btn = e.target.closest('.dd-btn');
  if (btn) {
    const d = btn.closest('.dd'), open = !d.classList.contains('open');
    ddCloseAll(d); d.classList.toggle('open', open);
    if (NATIVE && NATIVE.vibrate) try { NATIVE.vibrate(6); } catch (er) { }
    if (open) setTimeout(() => { const pn = $('.dd-panel', d); pn && pn.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 320);
    return;
  }
  const opt = e.target.closest('.dd-opt');
  if (opt && opt.closest('[data-dd]')) {
    const d = opt.closest('[data-dd]'), r = DDR[d.dataset.dd]; if (!r) return;
    const o = r.opts[+opt.dataset.k];
    $('.dd-cur', d).innerHTML = ddInner(o);
    $$('.dd-opt', d).forEach(x => x.classList.toggle('on', x === opt));
    d.classList.remove('open');
    r.onChange && r.onChange(o.v, o);
    return;
  }
  if (!e.target.closest('.dd')) ddCloseAll();
});
function enhanceSelects(root) {
  $$('select', root).forEach(sel => {
    if (sel._dd) return; sel._dd = 1;
    const id = 'sel' + uid();
    const opts = [...sel.options].map(o => ({ v: o.value, label: o.textContent, icon: sel.dataset.ic || null, color: sel.dataset.color }));
    const w = document.createElement('div');
    w.innerHTML = dd(id, opts, sel.value, v => { sel.value = v; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); });
    sel.style.display = 'none'; sel.after(w.firstElementChild);
  });
}

/* ---------- shared bits ---------- */
function topbar(title, { backBtn = false, right = '' } = {}) {
  return `<div class="topbar">${backBtn ? `<button class="icon-btn" onclick="back()">${I('chevron-right')}</button>` : ''}<h2 style="flex:1">${title}</h2>${right}</div>`;
}
function txItem(t) {
  const c = cat(t.catId), inc = t.type === 'income';
  return `<button class="item" onclick="txForm({id:'${t.id}'})">
    <span class="ic" style="background:${c.color}1f;color:${c.color}">${I(c.icon)}</span>
    <span class="mid"><b>${esc(t.note || c.name)}</b><small>${esc(t.note ? c.name : '')}${t.note ? ' · ' : ''}${dayLabel(t.date)}${srcBadge(t)}</small></span>
    <span class="amt ${inc ? 'green' : ''}">${inc ? '+' : '−'}${N(t.amount)}</span></button>`;
}
const cardGrad = c => { const th = Card.theme(c); return `linear-gradient(135deg,${th[0]},${th[1]} 60%,${th[2]})`; };
function srcBadge(t) {
  const id = t.cardPay || (t.src && t.src !== 'cash' ? t.src : null); if (!id) return '';
  const c = Card.get(id); if (!c) return '';
  const th = Card.theme(c);
  return ` <span class="src-b" style="background:${th[1]}1f;color:${th[1]}">${I('credit-card')}${esc(c.name)}</span>`;
}
function emptyBox(icon, title, sub = '') { return `<div class="empty">${I(icon)}<div style="font-weight:600;color:var(--text2)">${title}</div><small>${sub}</small></div>`; }
function greet() { const h = new Date().getHours(); return h < 12 ? 'صباح الخير' : h < 17 ? 'نهارك سعيد' : 'مساء الخير'; }

/* ================= HOME ================= */
function vHome() {
  const t = today(), mk = monthKey(t), m = Calc.sums(Calc.month(mk)), bal = Calc.balance();
  const owe = D().debts.filter(d => d.direction === 'owe' && !Debt.done(d));
  const oweRem = owe.reduce((s, d) => s + Debt.remaining(d), 0), oweTot = owe.reduce((s, d) => s + Debt.total(d), 0);
  const nextAll = owe.map(d => ({ d, i: Debt.next(d) })).filter(x => x.i).sort((a, b) => a.i.due < b.i.due ? -1 : 1)[0];
  const rw = Calc.runway(), spentP = m.inc ? Math.min(100, pct(m.exp, m.inc)) : (m.exp ? 100 : 0);
  const cur = S().currency;
  const slides = `
  <div class="slide s1"><span class="chip">${monthName(mk)}</span>
    <div class="lbl">${I('wallet')} رصيدك الحالي</div>
    <div class="big num" data-count="${bal}" data-cur="${esc(cur)}">0</div>
    <div class="row"><div class="pill">${I('arrow-down-left')} داخل الشهر ده<b class="num">${N(m.inc)}</b></div><div class="pill">${I('arrow-up-right')} خارج الشهر ده<b class="num">${N(m.exp)}</b></div></div></div>
  <div class="slide s2"><span class="chip">${m.net >= 0 ? 'موفّر' : 'عجز'}</span>
    <div class="lbl">${I('wallet-in')} صافي الشهر</div>
    <div class="big num" data-count="${m.net}" data-cur="${esc(cur)}">0</div>
    <div style="font-size:13px;opacity:.85;position:relative;z-index:1">صرفت ${N(spentP)}٪ من دخل الشهر</div>
    <div class="mini-prog"><i data-w="${spentP}"></i></div></div>
  <div class="slide s3"><span class="chip">${owe.length ? N(owe.length) + ' مديونية' : 'مفيش ديون'}</span>
    <div class="lbl">${I('receipt-2')} المتبقي من المديونيات</div>
    <div class="big num" data-count="${oweRem}" data-cur="${esc(cur)}">0</div>
    <div style="font-size:13px;opacity:.9;position:relative;z-index:1">${nextAll ? `القسط الجاي: ${N(nextAll.i.amount)} ${esc(cur)} · ${dayLabel(nextAll.i.due)}` : 'كل الأقساط خالصة 🎉'}</div>
    <div class="mini-prog"><i data-w="${oweTot ? pct(oweTot - oweRem, oweTot) : 100}"></i></div></div>
  <div class="slide s4"><span class="chip">بمعدل ${N(r3(rw.avg))}/يوم</span>
    <div class="lbl">${I('hourglass')} فلوسك هتكفّي</div>
    <div class="big num">${rw.days === null ? '—' : N(rw.days)} <small>يوم</small></div>
    <div style="font-size:13px;opacity:.9;position:relative;z-index:1">${rw.date ? `لحد ${dayLabel(rw.date)} لو فضلت بنفس المعدل` : rw.days === 0 ? 'رصيدك خلص — راجع مصروفاتك' : 'سجّل مصروفاتك عشان أحسبلك'}</div></div>`;

  /* alerts */
  let alerts = '';
  Debt.upcoming(3).slice(0, 3).forEach(u => {
    alerts += `<button class="alert ${u.late ? 'b-red' : 'b-amber'}" style="width:100%;text-align:start" onclick="payForm(D().debts.find(x=>x.id==='${u.d.id}'),null,'${u.i.id}')">${I(u.late ? 'alert-triangle' : 'bell')}<span style="flex:1">${u.late ? 'متأخر' : 'مستحق'}: قسط ${esc(u.d.name)} — ${N(u.i.amount - Debt.instPaid(u.i))} ${esc(cur)} (${dayLabel(u.i.due)})</span>${I('chevron-left')}</button>`;
  });
  const dom = new Date().getDate();
  if (S().salary > 0 && dom >= S().salaryDay && !Calc.month(mk).some(x => x.catId === 'salary'))
    alerts += `<button class="alert b-indigo" style="width:100%;text-align:start" onclick="quick('sal')">${I('briefcase')}<span style="flex:1">ميعاد المرتب جه — سجّله بضغطة</span>${I('chevron-left')}</button>`;

  const budgets = Calc.budgets().slice(0, 4);
  const top = Calc.byCat(Calc.month(mk)).slice(0, 5), topMax = top[0] ? top[0].v : 1;
  const recent = [...D().tx].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 6);
  const week = Array.from({ length: 7 }, (_, k) => addDays(t, -6 + k));
  const wv = week.map(d => D().tx.filter(x => x.date === d && x.type === 'expense').reduce((s, x) => s + x.amount, 0));

  return `<div class="hero"><div class="hero-bg"></div>
    <div class="hero-top"><div class="hello"><small>${greet()} 👋</small><b>${esc(S().name || 'أهلاً بيك')}</b></div>
      <button class="icon-btn" onclick="go('settings')">${I('settings')}</button></div>
    <div class="slider" id="slider">${slides}</div></div>
  <div class="dots" id="dots">${'<i></i>'.repeat(4)}</div>
  <div class="quick">
    <button class="qa" onclick="quick('exp')"><span style="color:#F43F5E">${I('arrow-up-right')}</span>مصروف</button>
    <button class="qa" onclick="quick('inc')"><span style="color:#10B981">${I('arrow-down-left')}</span>إيداع</button>
    <button class="qa" onclick="quick('sal')"><span style="color:#4F46E5">${I('briefcase')}</span>المرتب</button>
    ${Card.all().some(c => c.type === 'credit') ? `<button class="qa" onclick="cardPayForm()"><span style="color:#8B5CF6">${I('credit-card-pay')}</span>سداد فيزا</button>` : `<button class="qa" onclick="quick('pay')"><span style="color:#F59E0B">${I('calendar-dollar')}</span>دفع قسط</button>`}
  </div>
  ${alerts ? `<div class="sec">${alerts}</div>` : ''}
  ${!D().tx.length && !D().debts.length ? `<div class="sec"><button class="card restore-card" onclick="backupImport()"><span class="ic" style="background:var(--indigo-bg);color:var(--brand1)">${I('cloud-download')}</span><span style="flex:1;text-align:start"><b>عندك نسخة احتياطية؟</b><small>رجّع بياناتك من ملف — هتلاقيه في ${BACKUP_WHERE}</small></span>${I('chevron-left', 'faint')}</button></div>` : ''}
  ${homeCards()}
  <div class="sec"><div class="sec-h"><h3>مصروف آخر ٧ أيام</h3><span class="badge b-indigo">${N(r3(wv.reduce((a, b) => a + b, 0)))} ${esc(cur)}</span></div>
    <div class="card" style="padding:12px 10px 6px">${Chart.bars(wv, week.map(d => ['حد','اتنين','تلات','أربع','خميس','جمعة','سبت'][parseD(d).getDay()]), { h: 130, highlight: 6 })}</div></div>
  ${budgets.length ? `<div class="sec"><div class="sec-h"><h3>البنود والميزانية</h3><button onclick="go('cats')">تعديل</button></div><div class="card">${budgets.map(budgetRow).join('')}</div></div>` : ''}
  <div class="sec"><div class="sec-h"><h3>أكتر حاجات بتصرف فيها</h3><button onclick="go('reports')">التقارير</button></div>
    <div class="card">${top.length ? top.map(x => `<div class="bar-row"><div class="top"><span><span class="ic" style="width:30px;height:30px;border-radius:10px;background:${x.cat.color}1f;color:${x.cat.color}">${I(x.cat.icon)}</span>${esc(x.cat.name)}</span><b class="num">${N(x.v)}</b></div><div class="track"><i data-w="${pct(x.v, topMax)}" style="background:${x.cat.color}"></i></div></div>`).join('') : emptyBox('chart-bar', 'لسه مفيش مصروفات الشهر ده')}</div></div>
  <div class="sec"><div class="sec-h"><h3>آخر الحركات</h3><button onclick="go('tx')">الكل</button></div>
    <div class="list">${recent.length ? recent.map(txItem).join('') : emptyBox('receipt', 'ابدأ سجّل أول حركة', 'اضغط على زرار + اللي تحت')}</div></div>`;
}
function budgetRow(b) {
  const col = b.p >= 100 ? 'var(--red)' : b.p >= 80 ? 'var(--amber)' : b.c.color;
  const note = b.left <= 0 ? `<span class="red">خلص — زاد ${N(-b.left)}</span>` : b.willFinishEarly ? `<span class="amber">هيخلص خلال ${N(b.runsOut)} يوم</span>` : `<span class="faint">فاضل ${N(b.left)}</span>`;
  return `<div class="bar-row"><div class="top"><span><span class="ic" style="width:30px;height:30px;border-radius:10px;background:${b.c.color}1f;color:${b.c.color}">${I(b.c.icon)}</span>${esc(b.c.name)}</span><small>${note}</small></div>
  <div class="track"><i data-w="${Math.min(100, b.p)}" style="background:${col}"></i></div>
  <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text3);margin-top:4px"><span class="num">${N(b.spent)} من ${N(b.c.budget)}</span><span>${N(b.p)}٪</span></div></div>`;
}
AFTER.home = () => {
  const sl = $('#slider'), dots = $$('#dots i'); if (!sl) return;
  const hb = $('.hero-bg'), vw = $('#view');
  vw.onscroll = () => { if (App.view !== 'home' || !hb) return; const y = vw.scrollTop; hb.style.transform = `translateY(${y * 0.35}px)`; sl.style.opacity = Math.max(0, 1 - y / 320); };
  let idx = 0, paused = false;
  const setDot = () => { const w = sl.firstElementChild.offsetWidth + 14; idx = Math.round(Math.abs(sl.scrollLeft) / w); dots.forEach((d, k) => d.classList.toggle('on', k === idx)); $$('.slide', sl).forEach((s, k) => s.style.transform = k === idx ? 'scale(1)' : 'scale(.94)'); };
  sl.addEventListener('scroll', () => requestAnimationFrame(setDot), { passive: true });
  sl.addEventListener('touchstart', () => paused = true, { passive: true });
  sl.addEventListener('touchend', () => setTimeout(() => paused = false, 4000), { passive: true });
  setDot();
  App.slideTimer = setInterval(() => {
    if (paused || App.sheet) return;
    const n = sl.children.length, w = sl.firstElementChild.offsetWidth + 14;
    idx = (idx + 1) % n; sl.scrollTo({ left: DIRX * idx * w, behavior: 'smooth' });
    if (sl.scrollLeft === 0 && idx > 0 && getComputedStyle(sl).direction === 'rtl') sl.scrollTo({ left: -idx * w, behavior: 'smooth' });
  }, 4500);
};

function homeCards() {
  const cards = Card.all();
  if (!cards.length) return `<div class="sec"><button class="card promo-card" onclick="cardForm()"><span class="mini-card"></span><span style="flex:1;text-align:start"><b>ضيف بطاقاتك البنكية</b><small>ديبت أو كريدت — واعرف صرفت إيه من كل كارت</small></span>${I('chevron-left', 'faint')}</button></div>`;
  const debt = cards.filter(c => c.type === 'credit').reduce((x, c) => x + Math.max(0, Card.used(c)), 0);
  const sel = Card.get(App.homeCard) && !Card.get(App.homeCard).archived ? Card.get(App.homeCard) : cards[0];
  return `<div class="sec"><div class="sec-h"><h3>بطاقاتي</h3><button onclick="go('cards')">${debt ? `مديونية ${N(r3(debt))} · ` : ''}الكل</button></div>
    <button class="bcard-wrap" onclick="go('card',{id:'${sel.id}'})">${cardFace(sel)}</button>
    ${dd('homeCard', cards.map(c => ({ v: c.id, label: c.name, sub: c.type === 'credit' ? `كريدت · متاح ${N(r3(Card.available(c)))}` : `ديبت · صرفت ${N(r3(Card.spent(c, monthKey(today()) + '-01', today())))} الشهر ده`, swatch: cardGrad(c) })).concat([{ v: '__new', label: 'ضيف بطاقة جديدة', icon: 'plus', color: '#4F46E5', cls: 'dd-add' }]), sel.id, v => { if (v === '__new') return cardForm(); App.homeCard = v; refresh(); }, { label: 'اختار البطاقة' })}</div>`;
}

/* ================= TRANSACTIONS ================= */
function vTx() {
  const f = App.txFilter, months = [...new Set(D().tx.map(t => monthKey(t.date)).concat(monthKey(today())))].sort().reverse();
  const pr = periodRange();
  f.src = f.src || 'all';
  let list = D().tx.filter(t => (App.range.p === 'all' || (t.date >= pr.from && t.date <= pr.to)) && (f.type === 'all' || t.type === f.type) && (f.src === 'all' || (f.src === 'cash' ? Card.src(t) === 'cash' : t.src === f.src || t.cardPay === f.src)));
  if (f.q) { const q = f.q.trim(); list = list.filter(t => (t.note || '').includes(q) || cat(t.catId).name.includes(q) || String(t.amount).includes(q)); }
  list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const s = Calc.sums(list), groups = {};
  list.forEach(t => (groups[t.date] = groups[t.date] || []).push(t));
  return `${topbar('الحركات', { right: `<button class="icon-btn" onclick="txForm({type:'expense'})">${I('plus')}</button>` })}
  <div class="search">${I('search')}<input id="txq" placeholder="دوّر على حركة أو بند…" value="${esc(f.q)}"></div>
  <div class="filters">
    ${rangePicker('txRange', refresh, { cls: 'full' })}
    ${dd('fType', [{ v: 'all', label: 'الكل', icon: 'arrows-exchange', color: '#4F46E5' }, { v: 'expense', label: 'مصروفات', icon: 'arrow-up-right', color: '#F43F5E' }, { v: 'income', label: 'إيداعات', icon: 'arrow-down-left', color: '#10B981' }], f.type, v => { App.txFilter.type = v; refresh(); }, { cls: 'sm', label: 'النوع' })}
    ${D().cards.length ? dd('fSrc', [{ v: 'all', label: 'كل طرق الدفع', icon: 'wallet', color: '#4F46E5' }, { v: 'cash', label: 'كاش', icon: 'cash', color: '#10B981' }, ...Card.all().map(c => ({ v: c.id, label: c.name, sub: c.type === 'credit' ? 'كريدت' : 'ديبت', swatch: cardGrad(c) }))], f.src, v => { App.txFilter.src = v; refresh(); }, { cls: 'sm full', label: 'طريقة الدفع' }) : ''}
  </div>
  <div class="sec" style="padding-top:4px"><div class="grid2">
    <div class="stat"><div class="t">${I('arrow-down-left')} إيداعات</div><div class="v green num">${N(s.inc)}</div><div class="d faint">${esc(pr.label)}</div></div>
    <div class="stat"><div class="t">${I('arrow-up-right')} مصروفات</div><div class="v red num">${N(s.exp)}</div><div class="d faint">${N(list.length)} حركة</div></div></div></div>
  <div class="sec">${list.length ? Object.entries(groups).map(([d, arr]) => {
    const net = arr.reduce((x, t) => x + (t.type === 'income' ? t.amount : -t.amount), 0);
    return `<div class="day-h"><span>${dayLabel(d)}</span><span class="num ${net >= 0 ? 'green' : ''}">${net >= 0 ? '+' : '−'}${N(Math.abs(net))}</span></div><div class="list">${arr.map(txItem).join('')}</div>`;
  }).join('') : emptyBox('receipt-off', 'مفيش حركات هنا', 'غيّر الفلتر أو ضيف حركة جديدة')}</div>`;
}
AFTER.tx = () => {
  const q = $('#txq'); if (!q) return;
  q.oninput = () => { App.txFilter.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { const pos = q.selectionStart; refresh(); const n = $('#txq'); n.focus(); n.setSelectionRange(pos, pos); }, 350); };
};

/* ================= SHEETS ================= */
function openSheet(html, onMount) {
  closeSheet(true);
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  const sh = document.createElement('div'); sh.className = 'sheet'; sh.innerHTML = `<div class="grab"></div>${html}`;
  document.body.append(bg, sh); bg.onclick = () => closeSheet();
  App.sheet = { bg, sh };
  requestAnimationFrame(() => { bg.classList.add('show'); sh.classList.add('show'); });
  let y0 = null; const grab = $('.grab', sh);
  grab.addEventListener('touchstart', e => y0 = e.touches[0].clientY, { passive: true });
  grab.addEventListener('touchmove', e => { if (y0 !== null) { const dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transition = 'none'; sh.style.transform = `translateY(${dy}px)`; } }, { passive: true });
  grab.addEventListener('touchend', e => { sh.style.transition = ''; const dy = e.changedTouches[0].clientY - y0; y0 = null; if (dy > 90) closeSheet(); else sh.style.transform = ''; });
  onMount && onMount(sh);
  enhanceSelects(sh);
  animateBars(sh); bindStagger(sh);
  return sh;
}
function closeSheet(instant) {
  const s = App.sheet; if (!s) return; App.sheet = null;
  if (instant) { s.bg.remove(); s.sh.remove(); return; }
  s.bg.classList.remove('show'); s.sh.classList.remove('show');
  setTimeout(() => { s.bg.remove(); s.sh.remove(); }, 420);
}

/* ---- transaction form ---- */
function txForm(o = {}) {
  const ex = o.id ? D().tx.find(t => t.id === o.id) : null;
  const st = { type: ex ? ex.type : o.type || 'expense', catId: ex ? ex.catId : o.catId || null, src: ex ? Card.src(ex) : o.src || App.lastSrc || 'cash' };
  if (st.src !== 'cash' && !Card.get(st.src)) st.src = 'cash';
  const isPay = ex && ex.cardPay;
  const html = `<h3>${ex ? 'تعديل الحركة' : 'حركة جديدة'}${ex ? `<button class="icon-btn" style="color:var(--red)" id="del">${I('trash')}</button>` : ''}</h3>
    <div class="seg ${st.type === 'expense' ? 'exp' : 'inc'}" id="tseg"><button data-t="expense">مصروف</button><button data-t="income">إيداع / دخل</button></div>
    <div class="amount-box"><input id="amt" inputmode="decimal" placeholder="0" value="${ex ? ex.amount : o.amount || ''}"><small>المبلغ بـ${esc(S().currency)}</small></div>
    <div class="field"><label>البند</label><div id="catdd"></div></div>
    <div class="field"><label>الوصف / اسم الحاجة</label><div class="note-wrap"><input id="note" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="مثلاً: عيش، بنزين، فاتورة النور" value="${esc(ex ? ex.note : o.note || '')}"><button class="note-x" id="noteX" aria-label="مسح">${I('x')}</button></div><div class="dd sugg-dd" id="suggdd"><div class="dd-panel"><div class="dd-list" id="sugg"></div></div></div></div>
    ${isPay ? '' : `<div class="field"><label id="srcL">طريقة الدفع</label><div id="srcs"></div></div>`}
    <div class="field"><label>التاريخ</label><input id="date" type="date" value="${ex ? ex.date : today()}"></div>
    <button class="btn" id="save">${I('check')} ${ex ? 'حفظ التعديل' : 'حفظ'}</button>`;
  openSheet(html, sh => {
    const drawCats = (keep) => {
      const list = catsOf(st.type).filter(c => (c.id !== 'debtpay' || st.catId === 'debtpay') && (c.id !== 'cardpay' || st.catId === 'cardpay'));
      if (!list.find(c => c.id === st.catId)) st.catId = list[0].id;
      const catOpts = list.map(c => ({ v: c.id, label: c.name, icon: c.icon, color: c.color, sub: c.budget ? 'ميزانية ' + N(c.budget) : '' }));
      if (st.type === 'expense' && !ex && Card.all().some(x => x.type === 'credit')) catOpts.unshift({ v: '__cardpay', label: 'سداد فيزا / كريدت من الكاش', sub: 'تسدد للكارت أي مبلغ يريحك', icon: 'credit-card-pay', color: '#0EA5E9', cls: 'dd-pay' });
      ddMount($('#catdd', sh), 'cat', catOpts, st.catId, v => { if (v === '__cardpay') { closeSheet(true); return cardPayForm(); } st.catId = v; App._drawSugg && App._drawSugg(); });
      App._drawSugg && App._drawSugg();
      $$('#tseg button', sh).forEach(b => b.classList.toggle('on', b.dataset.t === st.type));
      $('#tseg', sh).className = 'seg ' + (st.type === 'expense' ? 'exp' : 'inc');
    };
    const noteIn = $('#note', sh), amtIn = $('#amt', sh);
    const drawSugg = () => {
      const q = noteIn.value.trim(), list = noteSuggestions(st.type, st.catId, q, ex && ex.note);
      $('#noteX', sh).style.display = q ? '' : 'none';
      const box = $('#sugg', sh);
      box.innerHTML = list.length ? `<div class="sugg-h">${I(q ? 'search' : 'history')} ${q ? 'اقتراحات مطابقة' : 'بتسجّلهم كتير'}</div>` + list.map((x, k) => { const c = cat(x.catId); return `<button type="button" class="dd-opt sg" data-k="${k}"><span class="dd-ic" style="background:${c.color}1f;color:${c.color}">${I(c.icon)}</span><span class="dd-t"><b>${esc(x.name)}</b><small>${esc(c.name)} · ${N(x.count)} مرة</small></span><span class="sg-amt num">${N(x.last)}</span></button>`; }).join('') : '';
      $('#suggdd', sh).classList.toggle('open', !!list.length && document.activeElement === noteIn);
      $$('.sg', box).forEach(b => b.onpointerdown = ev => ev.preventDefault());
      $$('.sg', box).forEach(b => b.onclick = () => {
        const x = list[+b.dataset.k]; noteIn.value = x.name;
        if (!parseNum(amtIn.value)) amtIn.value = x.last;
        if (x.catId && catsOf(st.type).find(c => c.id === x.catId)) { st.catId = x.catId; drawCats(true); }
        drawSugg(); $('#suggdd', sh).classList.remove('open'); noteIn.blur(); if (NATIVE && NATIVE.vibrate) try { NATIVE.vibrate(8); } catch (e) { }
      });
    };
    noteIn.addEventListener('input', drawSugg);
    noteIn.addEventListener('focus', () => { ddCloseAll(); drawSugg(); });
    noteIn.addEventListener('blur', () => setTimeout(() => $('#suggdd', sh) && $('#suggdd', sh).classList.remove('open'), 150));
    $('#noteX', sh).onclick = () => { noteIn.value = ''; drawSugg(); noteIn.focus(); };
    App._drawSugg = drawSugg;
    const drawSrc = () => {
      const box = $('#srcs', sh); if (!box) return;
      $('#srcL', sh).textContent = st.type === 'expense' ? 'دفعت منين؟' : 'الفلوس اتحطت فين؟';
      const opts = [{ id: 'cash', name: 'كاش', sub: st.type === 'expense' ? 'من المرتب / الفلوس اللي معايا' : 'كاش / في إيدي', th: ['#065F46', '#10B981', '#34D399'], ic: 'cash' }]
        .concat(Card.all().map(c => ({ id: c.id, name: c.name, sub: c.type === 'credit' ? `كريدت · متاح ${N(r3(Card.available(c)))}` : `ديبت${c.last4 ? ' · ' + N(c.last4, true) : ''}`, th: Card.theme(c), ic: 'credit-card' })));
      ddMount(box, 'src', opts.map(o => ({ v: o.id, label: o.name, sub: o.sub, swatch: `linear-gradient(135deg,${o.th[0]},${o.th[1]} 60%,${o.th[2]})`, icon: o.ic })).concat([{ v: '__new', label: 'ضيف بطاقة جديدة', sub: 'ديبت أو كريدت', icon: 'plus', color: '#4F46E5', cls: 'dd-add' }]), st.src, v => {
        if (v === '__new') { closeSheet(); cardForm(); return; }
        st.src = v;
      });
    };
    $$('#tseg button', sh).forEach(b => b.onclick = () => { st.type = b.dataset.t; st.catId = null; drawCats(); drawSrc(); });
    drawCats(); drawSrc();
    if (!ex) setTimeout(() => $('#amt', sh).focus(), 450);
    $('#save', sh).onclick = () => {
      const amount = parseNum($('#amt', sh).value);
      if (amount <= 0) { $('#amt', sh).parentElement.classList.add('pin-dots', 'err'); setTimeout(() => $('#amt', sh).parentElement.classList.remove('pin-dots', 'err'), 400); return toast('اكتب المبلغ الأول', 'alert-triangle'); }
      const rec = { type: st.type, amount, catId: st.catId, note: $('#note', sh).value.trim(), date: $('#date', sh).value || today() };
      if (!isPay) { rec.src = st.src; App.lastSrc = st.src; }
      const sc = st.src !== 'cash' && Card.get(st.src);
      if (!isPay && sc && sc.type === 'credit' && st.type === 'expense') { const av = Card.available(sc) + (ex && ex.src === sc.id ? ex.amount : 0); if (amount > av) toast(`تنبيه: المبلغ أكبر من المتاح في ${sc.name}`, 'alert-triangle'); }
      if (ex) Object.assign(ex, rec); else D().tx.push(Object.assign({ id: uid(), createdAt: Date.now() }, rec));
      Store.save(); closeSheet(); refresh();
      const cc = !isPay && st.src !== 'cash' && Card.get(st.src);
      toast(ex ? 'اتعدلت' : cc && cc.type === 'credit' ? `اتسجل على ${cc.name} — المتاح ${N(r3(Card.available(cc)))}` : cc ? `اتسجل على ${cc.name}` : st.type === 'income' ? 'الإيداع اتسجل' : 'المصروف اتسجل');
    };
    if (ex) $('#del', sh).onclick = () => confirmBox('تمسح الحركة دي؟', () => {
      if (ex.debtId) { const d = D().debts.find(x => x.id === ex.debtId); if (d) { d.installments.forEach(i => i.payments = (i.payments || []).filter(p => p.txId !== ex.id)); if (d.entries) d.entries = d.entries.filter(e => e.txId !== ex.id); } }
      D().tx = D().tx.filter(t => t !== ex); Store.save(); refresh(); toast('اتمسحت', 'trash');
    });
  });
}
function noteSuggestions(type, catId, q, cur) {
  const m = {};
  D().tx.filter(t => t.type === type && t.note && t.note.trim()).sort((a, b) => a.createdAt - b.createdAt).forEach(t => {
    const k = t.note.trim().replace(/\s+/g, ' ');
    const x = m[k] = m[k] || { name: k, count: 0, last: 0, catId: t.catId, recent: 0 };
    x.count++; x.last = t.amount; x.catId = t.catId; x.recent = Math.max(x.recent, t.createdAt || 0);
  });
  let list = Object.values(m).filter(x => x.name !== cur);
  if (q) { const n = q.toLowerCase(); list = list.filter(x => x.name.toLowerCase().includes(n) && x.name !== q); }
  const score = x => x.count * 10 + (x.catId === catId ? 25 : 0) + (x.recent > Date.now() - 7 * 864e5 ? 8 : 0) + (q && x.name.startsWith(q) ? 30 : 0);
  return list.sort((a, b) => score(b) - score(a)).slice(0, 10);
}
function confirmBox(msg, yes, yesLabel = 'أيوه، امسح', sub = 'مش هتقدر ترجّعها تاني.') {
  openSheet(`<h3>${msg}</h3><p class="muted" style="margin-top:-6px">${sub}</p><div class="btns"><button class="btn danger" id="y">${yesLabel}</button><button class="btn ghost" id="n">لأ</button></div>`, sh => {
    $('#y', sh).onclick = () => { closeSheet(); yes(); }; $('#n', sh).onclick = () => closeSheet();
  });
}

/* ================= DEBTS ================= */
function vDebts() {
  const all = D().debts, tab = App.debtTab;
  const active = d => !Debt.done(d);
  const list = all.filter(d => tab === 'done' ? Debt.done(d) : d.direction === tab && active(d));
  const oweRem = all.filter(d => d.direction === 'owe').reduce((s, d) => s + Debt.remaining(d), 0);
  const owedRem = all.filter(d => d.direction === 'owed').reduce((s, d) => s + Debt.remaining(d), 0);
  const late = all.reduce((s, d) => s + Debt.overdue(d).length, 0);
  return `${topbar('المديونيات', { right: `<button class="icon-btn" onclick="debtForm()">${I('plus')}</button>` })}
  <div class="sec" style="padding-top:0"><div class="grid2">
    <div class="stat"><div class="t">${I('arrow-up-right')} عليّا</div><div class="v red num" data-count="${oweRem}">0</div><div class="d faint">متبقي سداده</div></div>
    <div class="stat"><div class="t">${I('arrow-down-left')} ليّا</div><div class="v green num" data-count="${owedRem}">0</div><div class="d faint">متبقي تحصيله</div></div></div>
    ${late ? `<div class="alert b-red" style="margin-top:12px">${I('alert-triangle')} عندك ${N(late)} قسط متأخر</div>` : ''}
    ${(() => { const cd = Card.all().filter(c => c.type === 'credit').reduce((x, c) => x + Math.max(0, Card.used(c)), 0); return cd ? `<button class="alert b-indigo" style="width:100%;text-align:start;margin-top:12px" onclick="go('cards')">${I('credit-card')}<span style="flex:1">مديونية الكروت الائتمانية: <b class="num">${N(r3(cd))} ${esc(S().currency)}</b></span>${I('chevron-left')}</button>` : ''; })()}</div>
  <div class="sec"><div class="seg"><button class="${tab === 'owe' ? 'on' : ''}" onclick="App.debtTab='owe';refresh()">عليّا</button><button class="${tab === 'owed' ? 'on' : ''}" onclick="App.debtTab='owed';refresh()">ليّا</button><button class="${tab === 'done' ? 'on' : ''}" onclick="App.debtTab='done';refresh()">خلصت</button></div>
  ${list.length ? list.map(debtCard).join('') : emptyBox('receipt-2', tab === 'done' ? 'لسه مفيش مديونيات خلصت' : 'مفيش مديونيات هنا', tab !== 'done' ? 'سجّل المديونية وقسّطها على المواعيد اللي تحددها' : '')}
  ${tab !== 'done' ? `<button class="btn ghost" onclick="debtForm({direction:'${tab}'})">${I('plus')} مديونية جديدة</button>` : ''}</div>`;
}
function debtCard(d) {
  const tot = Debt.total(d), paid = Debt.paid(d), p = pct(paid, tot), nx = Debt.next(d), late = Debt.overdue(d).length;
  const col = d.direction === 'owe' ? '#F43F5E' : '#10B981';
  const doneN = d.installments.filter(Debt.instDone).length, fx = Debt.flex(d), nPay = (d.entries || []).filter(e => e.kind === 'pay').length;
  return `<button class="debt" onclick="go('debt',{id:'${d.id}'})"><div class="top">${Chart.ring(p, Debt.done(d) ? '#10B981' : col)}
    <div style="flex:1;min-width:0"><b style="font-size:16px;display:block">${esc(d.name)}</b><small class="faint">${esc(d.note || (d.direction === 'owe' ? 'مديونية عليّا' : 'فلوس ليّا عند حد'))}</small>
    <div style="margin-top:4px">${late ? `<span class="badge b-red">${N(late)} متأخر</span>` : Debt.done(d) ? '<span class="badge b-green">خالصة</span>' : fx ? `<span class="badge b-amber">مفتوحة · ${N(nPay)} دفعة</span>` : `<span class="badge b-indigo">${N(doneN)}/${N(d.installments.length)} قسط</span>`}</div></div>
    ${I('chevron-left', 'faint')}</div>
    <div class="meta"><div>الإجمالي<b class="num">${N(tot)}</b></div><div>المدفوع<b class="num green">${N(paid)}</b></div><div>الباقي<b class="num" style="color:${col}">${N(tot - paid)}</b></div><div>${nx ? 'القسط الجاي' : fx && nPay ? 'آخر دفعة' : ''}<b>${nx ? dayLabel(nx.due) : fx && nPay ? dayLabel(lastPay(d).date) : ''}</b></div></div></button>`;
}
function lastPay(d) { return (d.entries || []).filter(e => e.kind === 'pay').sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.at - a.at)[0]; }
function vDebt() {
  const d = D().debts.find(x => x.id === App.params.id); if (!d) return vDebts();
  if (Debt.flex(d)) return vFlexDebt(d);
  const tot = Debt.total(d), paid = Debt.paid(d), t = today();
  const insts = [...d.installments].sort((a, b) => a.due < b.due ? -1 : 1);
  return `${topbar(esc(d.name), { backBtn: true, right: `<button class="icon-btn" onclick="debtForm({id:'${d.id}'})">${I('edit')}</button>` })}
  <div class="sec" style="padding-top:0"><div class="card" style="display:flex;align-items:center;gap:16px">
    ${Chart.ring(pct(paid, tot), d.direction === 'owe' ? '#F43F5E' : '#10B981')}
    <div style="flex:1"><div class="faint" style="font-size:13px">${d.direction === 'owe' ? 'الباقي عليّا' : 'الباقي ليّا'}</div><div style="font-size:26px;font-weight:700" class="num" data-count="${tot - paid}" data-cur="${esc(S().currency)}">0</div>
    <small class="muted">مدفوع ${N(paid)} من ${N(tot)}</small></div></div>
    ${d.note ? `<div class="card muted" style="font-size:13.5px">${I('notes')} ${esc(d.note)}</div>` : ''}</div>
  <div class="sec"><div class="sec-h"><h3>جدول الأقساط</h3><button onclick="addInst('${d.id}')">${I('plus')} قسط</button></div>
  ${insts.map((i, k) => {
    const pd = Debt.instPaid(i), done = Debt.instDone(i), late = !done && i.due < t;
    return `<div class="inst ${done ? 'paid' : late ? 'late' : ''}"><span class="n">${done ? I('check') : N(k + 1)}</span>
      <button class="mid" style="text-align:start" onclick="instEdit('${d.id}','${i.id}')"><b class="num">${N(i.amount)} ${esc(S().currency)}</b><small>${shortDate(i.due)}${pd > 0 && !done ? ` · مدفوع ${N(pd)}` : ''}${late ? ' · متأخر ' + N(diffDays(i.due, t)) + ' يوم' : ''}${done && i.payments.length ? ' · اتدفع ' + dayLabel(i.payments[i.payments.length - 1].date) : ''}</small></button>
      ${done ? `<span class="badge b-green">تم</span>` : `<button class="btn sm" onclick="payForm(D().debts.find(x=>x.id==='${d.id}'),null,'${i.id}')">${d.direction === 'owe' ? 'ادفع' : 'حصّل'}</button>`}</div>`;
  }).join('')}
  <button class="btn danger" style="margin-top:14px" onclick="confirmBox('تمسح المديونية دي كلها؟',()=>{D().debts=D().debts.filter(x=>x.id!=='${d.id}');Store.save();back();toast('اتمسحت','trash')})">${I('trash')} مسح المديونية</button></div>`;
}
function debtForm(o = {}) {
  const ex = o.id ? D().debts.find(d => d.id === o.id) : null;
  const st = { dir: ex ? ex.direction : o.direction || 'owe', freq: 'm', mode: o.mode || 'flex' };
  const html = `<h3>${ex ? 'تعديل المديونية' : 'مديونية جديدة'}</h3>
  <div class="seg" id="dseg"><button data-d="owe">عليّا (أنا هسدد)</button><button data-d="owed">ليّا (هحصّل)</button></div>
  <div class="field"><label>اسم الجهة أو الشخص</label><input id="dn" placeholder="مثلاً: قرض البنك، جمعية، محمد" value="${esc(ex ? ex.name : '')}"></div>
  ${ex ? '' : `<div class="field"><label>طريقة السداد</label><div class="seg" id="mseg" style="margin-bottom:6px"><button data-m="flex">مبلغ مفتوح — أدفع براحتي</button><button data-m="sched">أقساط بمواعيد</button></div><small class="faint" id="mhint"></small></div>
  <div class="amount-box"><input id="dt" inputmode="decimal" placeholder="0"><small>إجمالي المديونية</small></div>
  <div id="schedF"><div class="row2"><div class="field"><label>عدد الأقساط</label><input id="dc" inputmode="numeric" value="12"></div><div class="field"><label>قيمة القسط</label><input id="da" inputmode="decimal" placeholder="تلقائي"></div></div>
  <div class="row2"><div class="field"><label>كل قد إيه؟</label><select id="df" data-ic="calendar" data-color="#4F46E5"><option value="m">كل شهر</option><option value="2w">كل أسبوعين</option><option value="w">كل أسبوع</option><option value="3m">كل ٣ شهور</option><option value="6m">كل ٦ شهور</option></select></div>
  <div class="field"><label>ميعاد أول قسط</label><input id="dd" type="date" value="${addMonths(today(), 1)}"></div></div>
  <div class="card" id="prev" style="font-size:13px;margin-bottom:12px"></div></div>
  <div id="flexF" class="field"><label>تاريخ المديونية</label><input id="fd" type="date" value="${today()}"></div>
  <button class="set" id="addbal" style="border-radius:14px;background:var(--surface);margin-bottom:12px"><span class="mid"><b>ضيف/اخصم المبلغ من رصيدي</b><small id="addbalS"></small></span><span class="switch" id="sw"></span></button>`}
  <div class="field"><label>ملاحظات</label><input id="dno" placeholder="اختياري" value="${esc(ex ? ex.note || '' : '')}"></div>
  <button class="btn" id="dsave">${I('check')} ${ex ? 'حفظ' : 'حفظ المديونية'}</button>`;
  openSheet(html, sh => {
    let addBal = false;
    const seg = () => { $$('#dseg button', sh).forEach(b => b.classList.toggle('on', b.dataset.d === st.dir)); const s = $('#addbalS', sh); if (s) s.textContent = st.dir === 'owe' ? 'هيتسجل إيداع بالمبلغ (استلمت الفلوس)' : 'هيتسجل مصروف بالمبلغ (اديت الفلوس)'; };
    $$('#dseg button', sh).forEach(b => b.onclick = () => { st.dir = b.dataset.d; seg(); });
    seg();
    if (!ex) {
      const prev = () => {
        const tot = parseNum($('#dt', sh).value), c = parseNum($('#dc', sh).value) || 1, a = parseNum($('#da', sh).value);
        if (!tot) { $('#prev', sh).innerHTML = '<span class="faint">اكتب المبلغ وهوريك الجدول هنا</span>'; return; }
        const sc = Debt.schedule(tot, c, $('#dd', sh).value || today(), $('#df', sh).value, a);
        $('#prev', sh).innerHTML = `<b>${N(sc.length)} قسط</b> — أول قسط ${N(sc[0].amount)} يوم ${shortDate(sc[0].due)}، وآخر قسط ${N(sc[sc.length - 1].amount)} يوم ${shortDate(sc[sc.length - 1].due)}<br><span class="faint">تقدر تعدّل تاريخ ومبلغ أي قسط بعد الإنشاء</span>`;
      };
      ['dt', 'dc', 'da', 'dd', 'df'].forEach(id => $('#' + id, sh).addEventListener('input', prev)); prev();
      $('#addbal', sh).onclick = () => { addBal = !addBal; $('#sw', sh).classList.toggle('on', addBal); };
      const mode = () => {
        $$('#mseg button', sh).forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
        $('#schedF', sh).style.display = st.mode === 'sched' ? '' : 'none';
        $('#flexF', sh).style.display = st.mode === 'flex' ? '' : 'none';
        $('#mhint', sh).textContent = st.mode === 'flex' ? 'تحط المبلغ الإجمالي، وتسدد أي مبلغ في أي وقت، وأنا أحسبلك الباقي.' : 'التطبيق يقسّم المبلغ على أقساط بمواعيد ويفكّرك بكل قسط.';
      };
      $$('#mseg button', sh).forEach(b => b.onclick = () => { st.mode = b.dataset.m; mode(); });
      mode();
      setTimeout(() => $('#dn', sh).focus(), 450);
    }
    $('#dsave', sh).onclick = () => {
      const name = $('#dn', sh).value.trim(); if (!name) return toast('اكتب اسم الجهة', 'alert-triangle');
      if (ex) { ex.name = name; ex.direction = st.dir; ex.note = $('#dno', sh).value.trim(); Store.save(); closeSheet(); refresh(); return toast('اتحفظ'); }
      const tot = parseNum($('#dt', sh).value); if (tot <= 0) return toast('اكتب إجمالي المديونية', 'alert-triangle');
      const d = st.mode === 'flex'
        ? { id: uid(), name, direction: st.dir, mode: 'flex', note: $('#dno', sh).value.trim(), createdAt: Date.now(), start: $('#fd', sh).value || today(), installments: [],
            entries: [{ id: uid(), kind: 'add', amount: tot, date: $('#fd', sh).value || today(), note: 'المبلغ الأساسي', at: Date.now() }] }
        : { id: uid(), name, direction: st.dir, note: $('#dno', sh).value.trim(), createdAt: Date.now(), start: today(),
        installments: Debt.schedule(tot, parseNum($('#dc', sh).value) || 1, $('#dd', sh).value || today(), $('#df', sh).value, parseNum($('#da', sh).value)) };
      D().debts.push(d);
      if (addBal) D().tx.push({ id: uid(), createdAt: Date.now(), type: st.dir === 'owe' ? 'income' : 'expense', amount: tot, catId: st.dir === 'owe' ? 'loan' : 'other', note: (st.dir === 'owe' ? 'استلام ' : 'سلفة لـ ') + name, date: today() });
      Store.save(); closeSheet(); App.debtTab = st.dir; go('debt', { id: d.id }); toast(st.mode === 'flex' ? 'المديونية اتسجلت' : 'جدول الأقساط اتعمل');
    };
  });
}
function payForm(d, _x, instId) {
  if (!d) return;
  const i = instId ? d.installments.find(x => x.id === instId) : Debt.next(d); if (!i) return;
  const rem = r3((i.amount - Debt.instPaid(i))), owe = d.direction === 'owe';
  openSheet(`<h3>${owe ? 'دفع قسط' : 'تحصيل قسط'} — ${esc(d.name)}</h3>
    <div class="amount-box"><input id="pa" inputmode="decimal" value="${rem}"><small>مستحق ${shortDate(i.due)} · المتبقي من القسط ${N(rem)}</small></div>
    <div class="field"><label>تاريخ ${owe ? 'الدفع' : 'التحصيل'}</label><input id="pd" type="date" value="${today()}"></div>
    <button class="set" id="rec" style="border-radius:14px;background:var(--surface);margin-bottom:12px"><span class="mid"><b>سجّلها ${owe ? 'كمصروف' : 'كإيداع'}</b><small>عشان رصيدك يتظبط تلقائي</small></span><span class="switch on" id="sw"></span></button>
    <button class="btn" id="ps">${I('check')} تأكيد</button>`, sh => {
    let rec = true; $('#rec', sh).onclick = () => { rec = !rec; $('#sw', sh).classList.toggle('on', rec); };
    $('#ps', sh).onclick = () => {
      const a = parseNum($('#pa', sh).value); if (a <= 0) return toast('اكتب المبلغ', 'alert-triangle');
      const date = $('#pd', sh).value || today(), p = { id: uid(), amount: a, date, txId: null };
      if (rec) { const t = { id: uid(), createdAt: Date.now(), type: owe ? 'expense' : 'income', amount: a, catId: owe ? 'debtpay' : 'collect', note: (owe ? 'قسط ' : 'تحصيل ') + d.name, date, debtId: d.id }; D().tx.push(t); p.txId = t.id; }
      i.payments = i.payments || []; i.payments.push(p);
      // overpay spills to next installments
      let extra = Debt.instPaid(i) - i.amount;
      if (extra > 0.009) {
        i.payments[i.payments.length - 1].amount -= extra;
        d.installments.filter(x => x !== i && !Debt.instDone(x)).sort((a, b) => a.due < b.due ? -1 : 1).forEach(x => {
          if (extra <= 0.009) return; const need = x.amount - Debt.instPaid(x), take = Math.min(need, extra);
          x.payments = x.payments || []; x.payments.push({ id: uid(), amount: take, date, txId: p.txId }); extra -= take;
        });
      }
      Store.save(); closeSheet(); refresh(); toast(Debt.done(d) ? 'مبروك! المديونية خلصت 🎉' : 'القسط اتسجل');
    };
  });
}
/* ================= BANK CARDS ================= */
function cardFace(c, big) {
  const th = Card.theme(c), credit = c.type === 'credit';
  const used = Card.used(c), p = credit && c.limit ? Math.min(100, pct(used, c.limit)) : 0;
  return `<div class="bcard ${big ? 'big' : ''}" style="background:linear-gradient(135deg,${th[0]} 0%,${th[1]} 55%,${th[2]} 130%)">
    <div class="bc-top"><span class="bc-bank">${esc(c.bank || 'بطاقة بنكية')}</span><span class="bc-type">${credit ? 'كريدت' : 'ديبت'}</span></div>
    <div class="bc-chip"><svg viewBox="0 0 40 30"><rect x="1" y="1" width="38" height="28" rx="6" fill="#E9C46A"/><path d="M1 10h12M1 20h12M27 10h12M27 20h12M13 1v28M27 1v28" stroke="#B08A2E" stroke-width="1.4" fill="none"/></svg>${I('wifi', 'bc-nfc')}</div>
    <div class="bc-num num">•••• •••• •••• ${c.last4 ? esc(c.last4) : '••••'}</div>
    <div class="bc-bot"><div><small>${credit ? 'المتاح' : 'صرفت الشهر ده'}</small><b class="num">${N(r3(credit ? Card.available(c) : Card.spent(c, monthKey(today()) + '-01', today())))} <small>${esc(S().currency)}</small></b></div>
    <div style="text-align:end"><small>${esc(c.name)}</small>${credit ? `<b class="num" style="font-size:13px">مستخدم ${N(p)}٪</b>` : ''}</div></div>
    ${credit ? `<div class="bc-bar"><i data-w="${p}"></i></div>` : ''}</div>`;
}
function vCards() {
  const cards = Card.all(), credit = cards.filter(c => c.type === 'credit');
  const debt = credit.reduce((s, c) => s + Math.max(0, Card.used(c)), 0), lim = credit.reduce((s, c) => s + (c.limit || 0), 0);
  const mk = monthKey(today()), from = mk + '-01';
  const month = cards.reduce((s, c) => s + Card.spent(c, from, today()), 0);
  return `${topbar('البطاقات البنكية', { backBtn: App.stack.length > 0, right: `<button class="icon-btn" onclick="cardForm()">${I('plus')}</button>` })}
  <div class="sec" style="padding-top:0"><div class="grid2">
    <div class="stat"><div class="t">${I('credit-card')} مديونية الكريدت</div><div class="v red num" data-count="${debt}">0</div><div class="d faint">${lim ? `من حد ${N(lim)}` : 'مفيش كروت كريدت'}</div></div>
    <div class="stat"><div class="t">${I('calendar')} صرف الكروت</div><div class="v num" data-count="${month}">0</div><div class="d faint">الشهر ده</div></div></div></div>
  <div class="sec">${cards.length ? cards.map(c => `<button class="bcard-wrap" onclick="go('card',{id:'${c.id}'})">${cardFace(c)}</button>`).join('') : `<div class="card" style="text-align:center;padding:26px 18px"><div class="bcard demo" style="background:linear-gradient(135deg,#1E1B4B,#4338CA 55%,#06B6D4 130%);margin:0 auto 18px;max-width:300px"><div class="bc-top"><span class="bc-bank">بنكك</span><span class="bc-type">كريدت</span></div><div class="bc-num num" style="margin-top:44px">•••• •••• •••• ••••</div></div><b style="font-size:16px">ضيف بطاقاتك البنكية</b><p class="muted" style="font-size:13.5px;margin:6px 0 14px">ديبت أو كريدت — وكل مصروف تختار دفعته منين، والتطبيق يحسبلك مديونية الكريدت والمتاح لوحده.</p></div>`}
  ${credit.length ? `<button class="btn" style="margin-bottom:10px" onclick="cardPayForm()">${I('credit-card-pay')} سداد فيزا من الكاش</button>` : ''}
  <button class="btn ${cards.length ? 'ghost' : ''}" onclick="cardForm()">${I('plus')} بطاقة جديدة</button></div>`;
}
function vCard() {
  const c = Card.get(App.params.id); if (!c) return vCards();
  const credit = c.type === 'credit', used = Card.used(c), cur = esc(S().currency);
  const mk = monthKey(today()), from = mk + '-01';
  const list = Card.txs(c).concat(Card.pays(c)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const monthSpent = Card.spent(c, from, today());
  const pr = periodRange(), inR = t => App.range.p === 'all' || (t.date >= pr.from && t.date <= pr.to);
  const rList = list.filter(inR), rSpent = Card.txs(c).filter(t => t.type === 'expense' && inR(t)).reduce((x, t) => x + t.amount, 0);
  const byCat = Calc.byCat(Card.txs(c).filter(inR)).slice(0, 4), max = byCat[0] ? byCat[0].v : 1;
  const due = credit ? Card.nextDue(c) : null;
  return `${topbar(esc(c.name), { backBtn: true, right: `<button class="icon-btn" onclick="cardForm({id:'${c.id}'})">${I('edit')}</button>` })}
  <div class="sec" style="padding-top:0">${cardFace(c, true)}</div>
  <div class="sec"><div class="grid2">
    ${credit ? `<div class="stat"><div class="t">${I('receipt-2')} المديونية</div><div class="v red num" data-count="${Math.max(0, used)}">0</div><div class="d faint">من حد ${N(c.limit || 0)}</div></div>
    <div class="stat"><div class="t">${I('wallet')} المتاح</div><div class="v green num" data-count="${Card.available(c)}">0</div><div class="d faint">${due && used > 0 ? 'السداد ' + dayLabel(due) : 'تقدر تصرفه'}</div></div>` : ''}
    <div class="stat"><div class="t">${I('calendar')} الشهر ده</div><div class="v num" data-count="${monthSpent}">0</div><div class="d faint">${N(Card.txs(c).filter(t => t.date >= from).length)} عملية</div></div>
    <div class="stat"><div class="t">${I('list-details')} كل العمليات</div><div class="v num">${N(Card.txs(c).length)}</div><div class="d faint">من أول ما اتضافت</div></div></div>
    <div class="btns" style="margin-top:12px">${credit ? `<button class="btn" onclick="cardPayForm('${c.id}')">${I('credit-card-pay')} سداد للكارت</button>` : ''}<button class="btn ${credit ? 'ghost' : ''}" ${credit ? 'style="width:auto;padding:14px 16px"' : ''} onclick="txForm({type:'expense',src:'${c.id}'})">${I('plus')} ${credit ? '' : 'مصروف بالكارت ده'}</button></div></div>
  <div class="sec">${rangePicker('cRange', refresh)}<div class="card" style="margin-top:12px;display:flex;justify-content:space-between;align-items:center"><span class="muted">صرفت بالكارت في الفترة دي</span><b class="num" style="font-size:18px">${N(rSpent)} <small>${esc(S().currency)}</small></b></div></div>
  ${byCat.length ? `<div class="sec"><div class="sec-h"><h3>بتصرف فيه على إيه</h3></div><div class="card">${byCat.map(x => `<div class="bar-row"><div class="top"><span><span class="ic" style="width:30px;height:30px;border-radius:10px;background:${x.cat.color}1f;color:${x.cat.color}">${I(x.cat.icon)}</span>${esc(x.cat.name)}</span><b class="num">${N(x.v)}</b></div><div class="track"><i data-w="${pct(x.v, max)}" style="background:${x.cat.color}"></i></div></div>`).join('')}</div></div>` : ''}
  <div class="sec"><div class="sec-h"><h3>عمليات الكارت</h3><button onclick="App.txFilter.src='${c.id}';go('tx')">في الحركات</button></div>
  <div class="list">${rList.length ? rList.slice(0, 60).map(txItem).join('') : emptyBox('credit-card', 'مفيش عمليات في الفترة دي', 'غيّر الفترة أو سجّل مصروف بالكارت ده')}</div></div>`;
}
function cardForm(o = {}) {
  const ex = o.id ? Card.get(o.id) : null;
  const st = { type: ex ? ex.type : o.type || 'credit', theme: ex ? ex.theme || 0 : D().cards.length % CARD_THEMES.length };
  const avail0 = ex && ex.type === 'credit' ? Card.available(ex) : '';
  openSheet(`<h3>${ex ? 'تعديل البطاقة' : 'بطاقة جديدة'}${ex ? `<button class="icon-btn" style="color:var(--red)" id="cdel">${I('trash')}</button>` : ''}</h3>
    <div id="cprev" style="margin-bottom:14px"></div>
    <div class="seg" id="ctype"><button data-t="credit">كريدت (ائتمان)</button><button data-t="debit">ديبت (خصم مباشر)</button></div>
    <div class="row2"><div class="field"><label>اسم البطاقة</label><input id="cn" placeholder="مثلاً: فيزا المرتب" value="${esc(ex ? ex.name : '')}"></div>
    <div class="field"><label>البنك</label><input id="cb" placeholder="مثلاً: البنك الأهلي" value="${esc(ex ? ex.bank || '' : '')}"></div></div>
    <div class="field"><label>آخر ٤ أرقام (اختياري)</label><input id="c4" inputmode="numeric" maxlength="4" placeholder="1234" value="${esc(ex ? ex.last4 || '' : '')}" style="direction:ltr;text-align:right"><small class="faint" style="display:block;margin-top:4px">${I('shield-check')} متكتبش رقم الكارت كامل — آخر ٤ أرقام بس عشان تميّزه</small></div>
    <div id="credF">
      <div class="row2"><div class="field"><label>الحد الائتماني</label><input id="cl" inputmode="decimal" placeholder="0" value="${ex && ex.limit ? ex.limit : ''}"></div>
      <div class="field"><label>المتاح دلوقتي</label><input id="ca" inputmode="decimal" placeholder="نفس الحد" value="${avail0 !== '' ? r3(avail0) : ''}"></div></div>
      <div class="card" id="cdebt" style="font-size:13.5px;margin-bottom:12px"></div>
      <div class="field"><label>يوم السداد في الشهر (اختياري — عشان أفكّرك)</label><input id="cd" inputmode="numeric" placeholder="مثلاً 25" value="${ex && ex.dueDay ? ex.dueDay : ''}"></div>
    </div>
    <div class="field"><label>لون البطاقة</label><div class="themes" id="cth">${CARD_THEMES.map((t, k) => `<button data-k="${k}" style="background:linear-gradient(135deg,${t[0]},${t[1]} 60%,${t[2]})"></button>`).join('')}</div></div>
    <button class="btn" id="cs">${I('check')} ${ex ? 'حفظ' : 'إضافة البطاقة'}</button>`, sh => {
    const preview = () => {
      const tmp = { id: 'tmp', type: st.type, theme: st.theme, name: $('#cn', sh).value || 'اسم البطاقة', bank: $('#cb', sh).value, last4: $('#c4', sh).value.replace(/\D/g, '').slice(-4), limit: parseNum($('#cl', sh).value), openingUsed: 0 };
      const lim = tmp.limit, av = $('#ca', sh).value.trim() === '' ? lim : parseNum($('#ca', sh).value);
      tmp.openingUsed = Math.max(0, lim - av);
            $('#cprev', sh).innerHTML = cardFace(tmp, false).replace(/data-w="[^"]*"/, `data-w="${lim ? Math.min(100, pct(tmp.openingUsed, lim)) : 0}" style="width:${lim ? Math.min(100, pct(tmp.openingUsed, lim)) : 0}%"`);
      $('#credF', sh).style.display = st.type === 'credit' ? '' : 'none';
      $$('#ctype button', sh).forEach(b => b.classList.toggle('on', b.dataset.t === st.type));
      $$('#cth button', sh).forEach(b => b.classList.toggle('on', +b.dataset.k === st.theme));
      $('#cdebt', sh).innerHTML = lim ? `مديونية الكارت دلوقتي: <b class="red num">${N(Math.max(0, lim - av))} ${esc(S().currency)}</b><br><span class="faint">بعد كده كل مصروف على الكارت بيتخصم من المتاح لوحده، ولما تسدد بيرجع.</span>` : '<span class="faint">اكتب الحد الائتماني والمتاح، وأنا أحسبلك المديونية</span>';
    };
    $$('#ctype button', sh).forEach(b => b.onclick = () => { st.type = b.dataset.t; preview(); });
    $$('#cth button', sh).forEach(b => b.onclick = () => { st.theme = +b.dataset.k; preview(); });
    ['cn', 'cb', 'c4', 'cl', 'ca'].forEach(id => $('#' + id, sh).addEventListener('input', preview));
    preview(); if (!ex) setTimeout(() => $('#cn', sh).focus(), 450);
    $('#cs', sh).onclick = () => {
      const name = $('#cn', sh).value.trim(); if (!name) return toast('اكتب اسم البطاقة', 'alert-triangle');
      const rec = { name, bank: $('#cb', sh).value.trim(), last4: $('#c4', sh).value.replace(/\D/g, '').slice(-4), type: st.type, theme: st.theme };
      if (st.type === 'credit') {
        const lim = parseNum($('#cl', sh).value); if (lim <= 0) return toast('اكتب الحد الائتماني', 'alert-triangle');
        const av = $('#ca', sh).value.trim() === '' ? lim : parseNum($('#ca', sh).value);
        rec.limit = lim; rec.dueDay = Math.min(31, Math.max(0, Math.round(parseNum($('#cd', sh).value)))) || 0;
        const targetUsed = lim - av;
        if (ex) { const moved = Card.used(Object.assign({}, ex, { type: 'credit', openingUsed: 0 })); rec.openingUsed = r3((targetUsed - moved)); }
        else rec.openingUsed = r3(targetUsed);
      } else { rec.limit = 0; rec.openingUsed = 0; rec.dueDay = 0; }
      if (ex) Object.assign(ex, rec); else D().cards.push(Object.assign({ id: uid(), createdAt: Date.now() }, rec));
      Store.save(); closeSheet();
      if (ex) refresh(); else { go('cards', {}, App.view === 'cards' ? { root: true } : {}); }
      toast(ex ? 'البطاقة اتعدلت' : 'البطاقة اتضافت', 'credit-card');
    };
    if (ex) $('#cdel', sh).onclick = () => confirmBox('تمسح البطاقة دي؟', () => {
      D().tx.forEach(t => { if (t.src === ex.id) t.src = 'cash'; });
      D().tx = D().tx.filter(t => t.cardPay !== ex.id);
      D().cards = D().cards.filter(c => c !== ex); Store.save(); go('cards', {}, { root: true }); toast('البطاقة اتمسحت', 'trash');
    }, 'أيوه، امسحها', 'عمليات الكارت هتتحسب كاش، ومدفوعات السداد بتاعته هتتمسح.');
  });
}
function cardPayForm(cid) {
  const credits = Card.all().filter(x => x.type === 'credit');
  if (!credits.length) { toast('ضيف كارت كريدت الأول', 'credit-card'); return cardForm({ type: 'credit' }); }
  let c = Card.get(cid) && Card.get(cid).type === 'credit' ? Card.get(cid) : credits.slice().sort((a, b) => Card.used(b) - Card.used(a))[0];
  const cur = esc(S().currency);
  openSheet(`<h3>${I('credit-card-pay')} سداد فيزا من الكاش</h3>
    ${credits.length > 1 ? `<div class="field">${dd('cpCard', credits.map(x => ({ v: x.id, label: x.name, sub: `مديونية ${N(r3(Math.max(0, Card.used(x))))} · متاح ${N(r3(Card.available(x)))}`, swatch: cardGrad(x) })), c.id, v => { c = Card.get(v); App._cpUpd && App._cpUpd(true); }, { label: 'أنهي كارت؟' })}</div>` : `<div id="cpOne"></div>`}
    <div class="amount-box"><input id="pa" inputmode="decimal" placeholder="اكتب المبلغ"><small id="cpDebt"></small></div>
    <div class="field" id="cpPreW"></div>
    <div class="cp-flow" id="cpFlow"></div>
    <div class="field"><label>تاريخ السداد</label><input id="pd" type="date" value="${today()}"></div>
    <div class="field"><label>ملاحظة (اختياري)</label><input id="pn" placeholder="مثلاً: سداد من مرتب أكتوبر"></div>
    <button class="btn" id="ps">${I('check')} تأكيد السداد</button>`, sh => {
    const amt = $('#pa', sh);
    const upd = (cardChanged) => {
      const used = Math.max(0, Card.used(c)), a = parseNum(amt.value), cash = Calc.balance();
      if ($('#cpOne', sh)) $('#cpOne', sh).innerHTML = `<div class="cp-card"><span class="dd-ic sw" style="background:${cardGrad(c)}">${I('credit-card')}</span><span class="dd-t"><b>${esc(c.name)}</b><small>مديونية ${N(r3(used))} · متاح ${N(r3(Card.available(c)))}</small></span></div>`;
      $('#cpDebt', sh).textContent = `مديونية الكارت ${N(r3(used))} ${S().currency} — اكتب أي مبلغ يريحك`;
      if (cardChanged !== false) {
        const pre = [...new Set([r3(used), Math.round(used * 0.05), 500, 1000, 2000, 5000].filter(v => v > 0 && v <= used))];
        $('#cpPreW', sh).innerHTML = pre.length ? dd('cpPre', pre.map((v, k) => ({ v, label: N(v) + ' ' + cur, sub: k === 0 ? 'المديونية كلها' : k === 1 ? 'الحد الأدنى تقريباً (٥٪)' : 'مبلغ ثابت', icon: k === 0 ? 'circle-check' : k === 1 ? 'percentage' : 'cash', color: k === 0 ? '#10B981' : '#4F46E5' })), '', v => { amt.value = v; upd(false); }, { placeholder: 'أو اختار مبلغ جاهز', phIcon: 'bolt' }) : '';
      }
      const after = used - a;
      $('#cpFlow', sh).innerHTML = a > 0 ? `<div class="cpf"><span class="cpf-ic" style="background:var(--green-bg);color:var(--green)">${I('cash')}</span><span><small>الكاش</small><b class="num">${N(r3(cash))} ← ${N(r3(cash - a))}</b></span></div>
        <span class="cpf-arrow">${I('arrow-left')}</span>
        <div class="cpf"><span class="cpf-ic" style="background:${cardGrad(c)};color:#fff">${I('credit-card')}</span><span><small>مديونية الكارت</small><b class="num">${N(r3(used))} ← ${N(Math.max(0, Math.round(after)))}</b></span></div>
        ${after < -0.009 ? `<div class="cpf-note amber">${I('info-circle')} المبلغ أكبر من المديونية بـ${N(r3(-after))} — هيتحسب رصيد زيادة على الكارت</div>` : after <= 0.009 ? `<div class="cpf-note green">${I('circle-check')} الكارت هيتسدد بالكامل</div>` : ''}
        ${a > cash ? `<div class="cpf-note red">${I('alert-triangle')} المبلغ أكبر من رصيدك الكاش</div>` : ''}` : `<div class="cpf-note">${I('info-circle')} المبلغ هيتخصم من رصيدك الكاش ويقلّل مديونية الكارت.</div>`;
    };
    amt.addEventListener('input', () => upd(false));
    App._cpUpd = upd; upd(true); setTimeout(() => amt.focus(), 450);
    $('#ps', sh).onclick = () => {
      const a = parseNum(amt.value); if (a <= 0) { amt.focus(); return toast('اكتب المبلغ اللي هتسدده', 'alert-triangle'); }
      const note = $('#pn', sh).value.trim();
      D().tx.push({ id: uid(), createdAt: Date.now(), type: 'expense', amount: a, catId: 'cardpay', note: note || 'سداد ' + c.name, date: $('#pd', sh).value || today(), src: 'cash', cardPay: c.id });
      Store.save(); closeSheet(); refresh();
      const u = Card.used(c); toast(u <= 0 ? `${c.name} اتسدد بالكامل 🎉` : `اتسدد ${N(a)} — فاضل على الكارت ${N(r3(u))}`, 'credit-card-pay');
    };
  });
}

/* ---- flexible (open) debt ---- */
function vFlexDebt(d) {
  const tot = Debt.total(d), paid = Debt.paid(d), rem = Math.max(0, tot - paid), owe = d.direction === 'owe', cur = esc(S().currency);
  const col = owe ? '#F43F5E' : '#10B981';
  const orig = (d.entries || []).filter(e => e.kind === 'add').sort((a, b) => a.at - b.at)[0];
  const ents = [...(d.entries || [])].sort((a, b) => a === orig ? -1 : b === orig ? 1 : a.date < b.date ? -1 : a.date > b.date ? 1 : a.at - b.at);
  let run = 0; const rows = ents.map(e => { run += e.kind === 'add' ? e.amount : -e.amount; return { e, after: run }; }).reverse();
  const pays = ents.filter(e => e.kind === 'pay'), lp = lastPay(d);
  const first = ents.length ? ents[0].date : today(), months = Math.max(1, diffDays(first, today()) / 30.4);
  const perMonth = paid / months, eta = perMonth > 0 && rem > 0 ? Math.ceil(rem / perMonth) : null;
  const thisMonth = pays.filter(e => monthKey(e.date) === monthKey(today())).reduce((s, e) => s + e.amount, 0);
  return `${topbar(esc(d.name), { backBtn: true, right: `<button class="icon-btn" onclick="debtForm({id:'${d.id}'})">${I('edit')}</button>` })}
  <div class="sec" style="padding-top:0"><div class="card" style="display:flex;align-items:center;gap:16px">
    ${Chart.ring(pct(paid, tot), Debt.done(d) ? '#10B981' : col)}
    <div style="flex:1"><div class="faint" style="font-size:13px">${owe ? 'الباقي عليّا' : 'الباقي ليّا'}</div><div style="font-size:26px;font-weight:700;color:${Debt.done(d) ? 'var(--green)' : 'inherit'}" class="num" data-count="${rem}" data-cur="${cur}">0</div>
    <small class="muted">${owe ? 'سددت' : 'حصّلت'} ${N(paid)} من ${N(tot)}</small></div></div>
    <div class="grid2" style="margin-top:12px">
      <div class="stat"><div class="t">${I('calendar')} الشهر ده</div><div class="v num">${N(thisMonth)}</div><div class="d faint">${owe ? 'اتدفع' : 'اتحصّل'} في ${MONTHS[new Date().getMonth()]}</div></div>
      <div class="stat"><div class="t">${I('hourglass')} هتخلص إمتى؟</div><div class="v num">${Debt.done(d) ? '✓' : eta ? N(eta) + ' <small style="font-size:13px">شهر</small>' : '—'}</div><div class="d faint">${Debt.done(d) ? 'خالصة' : eta ? 'بمتوسط ' + N(r3(perMonth)) + ' في الشهر' : 'لسه مفيش دفعات'}</div></div>
    </div>
    ${d.note ? `<div class="card muted" style="font-size:13.5px;margin-top:12px">${I('notes')} ${esc(d.note)}</div>` : ''}
    <div class="btns" style="margin-top:12px"><button class="btn" onclick="flexEntry('${d.id}','pay')">${I(owe ? 'cash' : 'arrow-down-left')} ${owe ? 'سدّد مبلغ' : 'حصّل مبلغ'}</button><button class="btn ghost" style="width:auto;padding:14px 16px" onclick="flexEntry('${d.id}','add')">${I('plus')} زوّد</button></div></div>
  <div class="sec"><div class="sec-h"><h3>سجل الحركات</h3><span class="badge b-indigo">${N(pays.length)} دفعة${lp ? ' · آخرها ' + dayLabel(lp.date) : ''}</span></div>
  ${rows.length ? rows.map(({ e, after }) => {
    const pay = e.kind === 'pay';
    return `<button class="inst ${pay ? 'paid' : ''}" style="width:100%;text-align:start" onclick="flexEntry('${d.id}','${e.kind}','${e.id}')"><span class="n">${I(pay ? 'check' : 'plus')}</span>
      <span class="mid"><b class="num" style="color:${pay ? 'var(--green)' : col}">${pay ? '−' : '+'}${N(e.amount)} ${cur}</b><small>${shortDate(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</small></span>
      <span style="text-align:end;font-size:12px" class="faint">فاضل<br><b class="num" style="color:var(--text);font-size:13.5px">${N(Math.max(0, after))}</b></span></button>`;
  }).join('') : emptyBox('receipt', 'لسه مفيش حركات')}
  <button class="btn danger" style="margin-top:14px" onclick="confirmBox('تمسح المديونية دي كلها؟',()=>{D().debts=D().debts.filter(x=>x.id!=='${d.id}');Store.save();back();toast('اتمسحت','trash')})">${I('trash')} مسح المديونية</button></div>`;
}
function flexEntry(did, kind, eid) {
  const d = D().debts.find(x => x.id === did); if (!d) return;
  const ex = eid ? d.entries.find(e => e.id === eid) : null, owe = d.direction === 'owe', pay = kind === 'pay';
  const rem = Math.max(0, Debt.total(d) - Debt.paid(d));
  const title = ex ? (pay ? 'تعديل الدفعة' : 'تعديل المبلغ') : pay ? (owe ? 'سداد مبلغ' : 'تحصيل مبلغ') : 'زيادة على المديونية';
  const recLbl = pay ? (owe ? 'سجّلها كمصروف' : 'سجّلها كإيداع') : (owe ? 'سجّلها كإيداع (استلمت الفلوس)' : 'سجّلها كمصروف (اديت الفلوس)');
  const recOn = ex ? !!ex.txId : pay;
  openSheet(`<h3>${title} — ${esc(d.name)}${ex ? `<button class="icon-btn" style="color:var(--red)" id="edel">${I('trash')}</button>` : ''}</h3>
    <div class="amount-box"><input id="ea" inputmode="decimal" placeholder="0" value="${ex ? ex.amount : ''}"><small>${pay ? `الباقي دلوقتي ${N(rem)} ${esc(S().currency)}` : 'المبلغ اللي هيتزود على الإجمالي'}</small></div>
    ${pay && !ex && rem > 0 ? `<div class="field">${dd('fxPre', [...new Set([500, 1000, 2000, 5000].filter(v => v < rem).concat([r3(rem)]))].map(v => ({ v, label: N(v) + ' ' + esc(S().currency), sub: v === r3(rem) ? 'الباقي كله' : 'مبلغ ثابت', icon: v === r3(rem) ? 'circle-check' : 'cash', color: v === r3(rem) ? '#10B981' : '#4F46E5' })), '', v => { $('#ea').value = v; }, { placeholder: 'اختيار سريع للمبلغ', phIcon: 'bolt' })}</div>` : ''}
    <div class="field"><label>التاريخ</label><input id="edt" type="date" value="${ex ? ex.date : today()}"></div>
    <div class="field"><label>ملاحظة</label><input id="en" placeholder="اختياري" value="${esc(ex ? ex.note || '' : '')}"></div>
    ${ex ? '' : `<button class="set" id="rec" style="border-radius:14px;background:var(--surface);margin-bottom:12px"><span class="mid"><b>${recLbl}</b><small>عشان رصيدك يتظبط تلقائي</small></span><span class="switch ${recOn ? 'on' : ''}" id="sw"></span></button>`}
    <button class="btn" id="es">${I('check')} ${ex ? 'حفظ' : 'تأكيد'}</button>`, sh => {
    let rec = recOn;
    if (!ex) { $('#rec', sh).onclick = () => { rec = !rec; $('#sw', sh).classList.toggle('on', rec); }; setTimeout(() => $('#ea', sh).focus(), 450); }
    $('#es', sh).onclick = () => {
      const a = parseNum($('#ea', sh).value); if (a <= 0) return toast('اكتب المبلغ', 'alert-triangle');
      const date = $('#edt', sh).value || today(), note = $('#en', sh).value.trim();
      if (ex) {
        ex.amount = a; ex.date = date; ex.note = note;
        const t = ex.txId && D().tx.find(x => x.id === ex.txId); if (t) { t.amount = a; t.date = date; }
      } else {
        const e = { id: uid(), kind, amount: a, date, note, at: Date.now(), txId: null };
        if (rec) {
          const income = pay ? !owe : owe;
          const t = { id: uid(), createdAt: Date.now(), type: income ? 'income' : 'expense', amount: a, catId: pay ? (owe ? 'debtpay' : 'collect') : (owe ? 'loan' : 'other'), note: (pay ? (owe ? 'سداد ' : 'تحصيل من ') : (owe ? 'زيادة مديونية ' : 'سلفة لـ ')) + d.name, date, debtId: d.id };
          D().tx.push(t); e.txId = t.id;
        }
        d.entries.push(e);
      }
      if (Debt.total(d) <= 0) return toast('لازم يفضل مبلغ أساسي', 'alert-triangle');
      Store.save(); closeSheet(); refresh();
      const r = Math.max(0, Debt.total(d) - Debt.paid(d));
      toast(Debt.done(d) ? 'مبروك! المديونية خلصت 🎉' : pay ? `اتسجل — فاضل ${N(r)}` : `اتزود — الإجمالي بقى ${N(Debt.total(d))}`);
    };
    if (ex) $('#edel', sh).onclick = () => {
      if (ex.kind === 'add' && d.entries.filter(e => e.kind === 'add').length < 2) return toast('ده المبلغ الأساسي — عدّله بدل ما تمسحه', 'info-circle');
      if (ex.txId) D().tx = D().tx.filter(t => t.id !== ex.txId);
      d.entries = d.entries.filter(e => e !== ex); Store.save(); closeSheet(); refresh(); toast('اتمسحت', 'trash');
    };
  });
}
function instEdit(did, iid) {
  const d = D().debts.find(x => x.id === did), i = d.installments.find(x => x.id === iid);
  openSheet(`<h3>تعديل القسط</h3>
    <div class="row2"><div class="field"><label>المبلغ</label><input id="ia" inputmode="decimal" value="${i.amount}"></div><div class="field"><label>تاريخ الاستحقاق</label><input id="idt" type="date" value="${i.due}"></div></div>
    <button class="set" id="shift" style="border-radius:14px;background:var(--surface);margin-bottom:12px"><span class="mid"><b>زحزح الأقساط اللي بعده بنفس الفرق</b><small>لو أجّلت القسط ده، الباقي يتأجل معاه</small></span><span class="switch" id="sw"></span></button>
    ${(i.payments || []).length ? `<div class="card" style="margin-bottom:12px"><b style="font-size:14px">المدفوعات</b>${i.payments.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)"><span class="num">${N(p.amount)} · ${shortDate(p.date)}</span><button class="badge b-red" onclick="undoPay('${did}','${iid}','${p.id}')">إلغاء</button></div>`).join('')}</div>` : ''}
    <div class="btns"><button class="btn" id="is">${I('check')} حفظ</button><button class="btn danger" id="idel" style="width:auto;padding:14px 18px">${I('trash')}</button></div>`, sh => {
    let shift = false; $('#shift', sh).onclick = () => { shift = !shift; $('#sw', sh).classList.toggle('on', shift); };
    $('#is', sh).onclick = () => {
      const a = parseNum($('#ia', sh).value), nd = $('#idt', sh).value; if (a <= 0 || !nd) return toast('راجع البيانات', 'alert-triangle');
      const delta = diffDays(i.due, nd);
      if (shift && delta) d.installments.filter(x => x.due > i.due && x !== i).forEach(x => x.due = addDays(x.due, delta));
      i.amount = a; i.due = nd; Store.save(); closeSheet(); refresh(); toast('القسط اتعدل');
    };
    $('#idel', sh).onclick = () => { if (d.installments.length < 2) return toast('لازم يفضل قسط واحد على الأقل', 'info-circle'); d.installments = d.installments.filter(x => x !== i); Store.save(); closeSheet(); refresh(); toast('القسط اتمسح', 'trash'); };
  });
}
function undoPay(did, iid, pid) {
  const d = D().debts.find(x => x.id === did), i = d.installments.find(x => x.id === iid), p = i.payments.find(x => x.id === pid);
  if (p.txId) { d.installments.forEach(x => x.payments = (x.payments || []).filter(y => y.txId !== p.txId)); D().tx = D().tx.filter(t => t.id !== p.txId); }
  else i.payments = i.payments.filter(x => x !== p);
  Store.save(); closeSheet(); refresh(); toast('الدفعة اتلغت', 'arrow-back-up');
}
function addInst(did) {
  const d = D().debts.find(x => x.id === did), last = [...d.installments].sort((a, b) => a.due < b.due ? 1 : -1)[0];
  d.installments.push({ id: uid(), due: last ? addMonths(last.due, 1) : today(), amount: last ? last.amount : 0, payments: [] });
  Store.save(); refresh(); instEdit(did, d.installments[d.installments.length - 1].id);
}

/* ================= REPORTS ================= */
const PERIODS = [['today', 'النهارده', 'sun'], ['week', 'آخر ٧ أيام', 'calendar-week'], ['month', 'الشهر ده', 'calendar'], ['last', 'الشهر اللي فات', 'calendar-minus'], ['3m', 'آخر ٣ شهور', 'calendar-stats'], ['year', 'السنة دي', 'calendar-event'], ['all', 'كل الفترات', 'infinity']];
const RANGE_CB = {};
function rangeOptions() {
  const cur = monthKey(today()), last = monthKey(addMonths(cur + '-01', -1));
  const months = [...new Set(D().tx.map(t => monthKey(t.date)))].filter(m => m !== cur && m !== last).sort().reverse().slice(0, 12);
  return [{ v: 'custom', label: 'فترة مخصصة (من – إلى)', sub: App.range.p === 'custom' ? periodRange('custom').label : 'اختار التاريخين بنفسك', icon: 'calendar-search', color: '#E11D48', cls: 'dd-custom' }]
    .concat(PERIODS.map(([k, l, ic]) => ({ v: k, label: l, icon: ic, color: '#4F46E5', sub: k === 'all' ? 'من أول حركة' : (() => { const r = periodRange(k); return r.from === r.to ? shortDate(r.from) : `${shortDate(r.from)} ← ${shortDate(r.to)}`; })() })))
    .concat(months.map(m => ({ v: 'm:' + m, label: monthName(m), icon: 'calendar-month', color: '#64748B', sub: N(D().tx.filter(t => monthKey(t.date) === m).length) + ' حركة' })));
}
function rangePicker(id, cb, x = {}) {
  RANGE_CB[id] = cb;
  const r = App.range, pr = periodRange();
  return `<div class="range ${x.cls || ''}">${dd(id, rangeOptions(), r.p, v => {
      App.range.p = v;
      if (v === 'custom') { const c = periodRange(App.range.from ? 'custom' : 'month'); App.range.from = App.range.from || c.from; App.range.to = App.range.to || c.to; }
      cb();
    }, { cls: 'sm full', label: x.label || 'الفترة' })}
    ${r.p === 'custom' ? `<div class="range-dates"><div class="rd"><label>${I('calendar')} من</label><input type="date" data-rid="${id}" data-k="from" value="${pr.from}" max="${pr.to}"></div><span class="rd-arrow">${I('arrow-left')}</span><div class="rd"><label>${I('calendar')} إلى</label><input type="date" data-rid="${id}" data-k="to" value="${pr.to}" min="${pr.from}"></div></div>
    <div class="rd-quick">${[['أول الشهر', monthKey(today()) + '-01'], ['من ٣٠ يوم', addDays(today(), -29)], ['أول السنة', today().slice(0, 4) + '-01-01']].map(([l, f]) => `<button type="button" data-rid="${id}" data-from="${f}">${l}</button>`).join('')}</div>` : ''}</div>`;
}
document.addEventListener('change', e => {
  const i = e.target.closest('input[data-rid]'); if (!i || !i.value) return;
  App.range[i.dataset.k] = i.value; App.range.p = 'custom'; (RANGE_CB[i.dataset.rid] || (() => { }))();
});
document.addEventListener('click', e => {
  const b = e.target.closest('button[data-rid][data-from]'); if (!b) return;
  App.range.p = 'custom'; App.range.from = b.dataset.from; App.range.to = today(); (RANGE_CB[b.dataset.rid] || (() => { }))();
});
function periodRange(p) {
  p = p || App.range.p;
  const t = today(), mk = monthKey(t);
  if (p === 'custom') {
    let f = App.range.from || mk + '-01', e = App.range.to || t; if (f > e) [f, e] = [e, f];
    return { from: f, to: e, label: `${shortDate(f)} ← ${shortDate(e)}`, custom: true };
  }
  if (p && p.startsWith('m:')) { const m = p.slice(2); return { from: m + '-01', to: m === mk ? t : `${m}-${pad(daysInMonth(m))}`, label: monthName(m) }; }
  if (p === 'week') return { from: addDays(t, -6), to: t, label: 'آخر ٧ أيام' };
  if (p === 'today') return { from: t, to: t, label: 'النهارده' };
  if (p === 'month') return { from: mk + '-01', to: t, label: monthName(mk) };
  if (p === 'last') { const lm = addMonths(mk + '-01', -1); return { from: lm, to: addDays(mk + '-01', -1), label: monthName(monthKey(lm)) }; }
  if (p === '3m') return { from: addMonths(mk + '-01', -2), to: t, label: 'آخر ٣ شهور' };
  if (p === 'year') return { from: t.slice(0, 4) + '-01-01', to: t, label: 'سنة ' + N(t.slice(0, 4), true) };
  const first = D().tx.reduce((m, x) => x.date < m ? x.date : m, t);
  return { from: first, to: t, label: 'كل الفترات' };
}
function reportData(p) {
  const r = periodRange(p), list = Calc.inRange(r.from, r.to), s = Calc.sums(list);
  const days = Math.max(1, diffDays(r.from, r.to) + 1);
  const len = diffDays(r.from, r.to) + 1, pf = addDays(r.from, -len), pt = addDays(r.from, -1);
  const prev = Calc.sums(Calc.inRange(pf, pt));
  const byCat = Calc.byCat(list), byInc = Calc.byCat(list, 'income');
  const prevCat = Object.fromEntries(Calc.byCat(Calc.inRange(pf, pt)).map(x => [x.cat.id, x.v]));
  const items = Calc.topItems(list), wd = Calc.weekday(list);
  const save = s.inc ? Math.round(s.net / s.inc * 100) : 0;
  const ins = [];
  // strengths & weaknesses
  if (s.inc > 0 && save >= 20) ins.push(['good', 'trophy', 'معدل ادخار ممتاز', `وفّرت ${N(save)}٪ من دخلك في الفترة دي — استمر كده.`]);
  else if (s.inc > 0 && save > 0) ins.push(['ok', 'wallet-in', 'بتوفّر بس تقدر أحسن', `وفّرت ${N(save)}٪ بس — الهدف المريح ٢٠٪ أو أكتر.`]);
  if (s.net < 0) ins.push(['bad', 'alert-triangle', 'صرفت أكتر من دخلك', `المصروف زاد عن الدخل بـ${N(-s.net)} ${S().currency} في الفترة دي.`]);
  if (prev.exp > 0 && p !== 'all') {
    const ch = Math.round((s.exp - prev.exp) / prev.exp * 100);
    if (ch <= -5) ins.push(['good', 'trending-down', 'مصروفك قلّ', `صرفت أقل بـ${N(-ch)}٪ من الفترة اللي قبلها.`]);
    else if (ch >= 15) {
      let worst = null; byCat.forEach(x => { const d = x.v - (prevCat[x.cat.id] || 0); if (!worst || d > worst.d) worst = { d, c: x.cat }; });
      ins.push(['bad', 'trending-up', 'مصروفك زاد', `زاد ${N(ch)}٪ عن الفترة اللي قبلها${worst && worst.d > 0 ? `، وأكتر بند زاد هو «${worst.c.name}» (+${N(r3(worst.d))})` : ''}.`]);
    }
  }
  if (byCat[0] && s.exp > 0) {
    const sh = pct(byCat[0].v, s.exp);
    ins.push([sh >= 40 ? 'bad' : 'info', 'chart-pie', `أكتر بند بتصرف فيه: ${byCat[0].cat.name}`, `واخد ${N(sh)}٪ من مصروفك (${N(byCat[0].v)} ${S().currency})${sh >= 40 ? ' — نسبة عالية، حاول تحط له ميزانية.' : '.'}`]);
  }
  if (items[0]) ins.push(['info', 'shopping-bag', `أكتر حاجة بتشتريها: ${items[0].name}`, `اشتريتها ${N(items[0].count)} مرة بإجمالي ${N(items[0].total)} ${S().currency}.`]);
  const late = D().debts.reduce((x, d) => x + Debt.overdue(d).length, 0);
  if (D().debts.length) ins.push(late ? ['bad', 'clock-exclamation', 'أقساط متأخرة', `عندك ${N(late)} قسط فات ميعاده — حاول تسددها بسرعة.`] : ['good', 'shield-check', 'ملتزم في الأقساط', 'مفيش ولا قسط متأخر — ممتاز.']);
  const bud = Calc.budgets(), over = bud.filter(b => b.p >= 100), okb = bud.filter(b => b.p < 100);
  if (over.length) ins.push(['bad', 'flame', 'بنود عدّت الميزانية', over.map(b => b.c.name).join('، ') + '.']);
  else if (okb.length) ins.push(['good', 'target', 'ملتزم بالميزانية', `كل البنود (${N(okb.length)}) لسه في حدود الميزانية.`]);
  const maxWd = wd.indexOf(Math.max(...wd));
  if (s.exp > 0) ins.push(['info', 'calendar-week', `أكتر يوم بتصرف فيه: ${DAYS[maxWd]}`, `متوسط صرفك اليومي ${N(r3(s.exp / days))} ${S().currency}.`]);
  // salary lasting
  const sal = list.filter(x => x.catId === 'salary').sort((a, b) => a.date < b.date ? -1 : 1);
  if (sal.length) {
    const sd = sal[sal.length - 1]; let acc = 0, endDay = null;
    D().tx.filter(x => x.type === 'expense' && x.date >= sd.date).sort((a, b) => a.date < b.date ? -1 : 1).forEach(x => { acc += x.amount; if (endDay === null && acc >= sd.amount) endDay = x.date; });
    ins.push(endDay ? ['bad', 'hourglass', 'المرتب خلص بدري', `آخر مرتب (${dayLabel(sd.date)}) اتصرف كله في ${N(diffDays(sd.date, endDay) + 1)} يوم.`] :
      ['info', 'hourglass', 'المرتب لسه مكفّي', `اتصرف ${N(pct(acc, sd.amount))}٪ من آخر مرتب في ${N(diffDays(sd.date, today()) + 1)} يوم.`]);
  }
  // daily or monthly series
  let series, labels, hi = -1;
  if (days <= 31) {
    series = []; labels = [];
    for (let k = 0; k < days; k++) { const d = addDays(r.from, k); series.push(list.filter(x => x.date === d && x.type === 'expense').reduce((a, x) => a + x.amount, 0)); labels.push(k % 5 === 0 ? N(parseD(d).getDate()) : ''); }
  } else {
    const ms = []; let m = monthKey(r.from); while (m <= monthKey(r.to)) { ms.push(m); m = monthKey(addMonths(m + '-01', 1)); }
    series = ms.map(mk => list.filter(x => monthKey(x.date) === mk && x.type === 'expense').reduce((a, x) => a + x.amount, 0));
    labels = ms.map(mk => MONTHS[+mk.slice(5) - 1].slice(0, 3));
  }
  hi = series.indexOf(Math.max(...series, 0));
  const six = []; for (let k = 5; k >= 0; k--) six.push(monthKey(addMonths(monthKey(today()) + '-01', -k)));
  const sixS = six.map(mk => Calc.sums(Calc.month(mk)));
  const bySrc = {}; list.filter(t => t.type === 'expense' && t.catId !== 'cardpay').forEach(t => { const k = Card.src(t); bySrc[k] = (bySrc[k] || 0) + t.amount; });
  const srcList = Object.entries(bySrc).map(([k, v]) => { const c = k === 'cash' ? null : Card.get(k); return { k, v, name: c ? c.name : 'كاش', type: c ? c.type : 'cash', color: c ? Card.theme(c)[1] : '#10B981', n: list.filter(t => t.type === 'expense' && Card.src(t) === k && t.catId !== 'cardpay').length }; }).sort((a, b) => b.v - a.v);
  const cardPaid = list.filter(t => t.catId === 'cardpay').reduce((x, t) => x + t.amount, 0);
  return { r, list, s, prev, byCat, byInc, items, wd, save, ins, series, labels, hi, days, six, sixS, bud, srcList, cardPaid };
}
const INS_COL = { good: ['#10B981', 'var(--green-bg)'], bad: ['#EF4444', 'var(--red-bg)'], info: ['#4F46E5', 'var(--indigo-bg)'], ok: ['#F59E0B', 'var(--amber-bg)'] };
function vReports() {
  const R = reportData(App.range.p), cur = S().currency;
  const donut = R.byCat.slice(0, 6), rest = R.byCat.slice(6).reduce((s, x) => s + x.v, 0);
  if (rest) donut.push({ cat: { name: 'باقي البنود', color: '#CBD5E1' }, v: rest });
  const strengths = R.ins.filter(x => x[0] === 'good'), weak = R.ins.filter(x => x[0] === 'bad' || x[0] === 'ok'), info = R.ins.filter(x => x[0] === 'info');
  const insBlock = arr => arr.map(([k, ic, t, p]) => `<div class="insight"><span class="ic" style="background:${INS_COL[k][1]};color:${INS_COL[k][0]}">${I(ic)}</span><div><b>${esc(t)}</b><p>${esc(p)}</p></div></div>`).join('');
  return `${topbar('التقارير', { right: `<button class="icon-btn" style="background:var(--grad);color:#fff" onclick="exportPDF()">${I('file-type-pdf')}</button>` })}
  <div class="filters">${rangePicker('rRange', refresh, { cls: 'full', label: 'فترة التقرير' })}</div>
  <div class="sec" style="padding-top:4px"><div class="grid2">
    <div class="stat"><div class="t">${I('arrow-down-left')} الإيداعات</div><div class="v green num" data-count="${R.s.inc}">0</div><div class="d faint">${R.prev.inc ? cmp(R.s.inc, R.prev.inc, true) : ''}</div></div>
    <div class="stat"><div class="t">${I('arrow-up-right')} المصروفات</div><div class="v red num" data-count="${R.s.exp}">0</div><div class="d faint">${R.prev.exp ? cmp(R.s.exp, R.prev.exp, false) : ''}</div></div>
    <div class="stat"><div class="t">${I('scale')} الصافي</div><div class="v num ${R.s.net >= 0 ? 'green' : 'red'}" data-count="${R.s.net}">0</div></div>
    <div class="stat"><div class="t">${I('wallet-in')} نسبة الادخار</div><div class="v num">${N(R.save)}٪</div></div></div></div>
  <div class="sec"><div class="sec-h"><h3>${R.days <= 31 ? 'المصروف اليومي' : 'المصروف الشهري'}</h3><span class="badge b-indigo">${esc(R.r.label)}</span></div>
    <div class="card" style="padding:12px 10px 6px">${R.series.some(v => v > 0) ? Chart.bars(R.series, R.labels, { h: 150, highlight: R.hi }) : emptyBox('chart-bar', 'مفيش مصروفات في الفترة دي')}</div></div>
  <div class="sec"><div class="sec-h"><h3>المصروف حسب البند</h3></div><div class="card">${donut.length ? `<div class="donut-wrap">${Chart.donut(donut.map(x => ({ v: x.v, color: x.cat.color })), { center: N(donut.length) + ' بند' })}<div class="legend">${donut.map(x => `<div><i style="background:${x.cat.color}"></i><span>${esc(x.cat.name)}</span><b class="num">${N(pct(x.v, R.s.exp))}٪</b></div>`).join('')}</div></div>` : emptyBox('chart-donut', 'مفيش بيانات')}</div></div>
  ${strengths.length ? `<div class="sec"><div class="sec-h"><h3>💪 نقاط القوة</h3></div><div class="card" style="padding:4px 16px">${insBlock(strengths)}</div></div>` : ''}
  ${weak.length ? `<div class="sec"><div class="sec-h"><h3>⚠️ محتاج تنتبه</h3></div><div class="card" style="padding:4px 16px">${insBlock(weak)}</div></div>` : ''}
  ${info.length ? `<div class="sec"><div class="sec-h"><h3>💡 ملاحظات</h3></div><div class="card" style="padding:4px 16px">${insBlock(info)}</div></div>` : ''}
  ${D().cards.length && R.srcList.length ? `<div class="sec"><div class="sec-h"><h3>صرفت منين؟</h3>${R.cardPaid ? `<span class="badge b-indigo">سددت للكروت ${N(R.cardPaid)}</span>` : ''}</div><div class="card">${R.srcList.map(x => `<div class="bar-row"><div class="top"><span><span class="ic" style="width:30px;height:30px;border-radius:10px;background:${x.color}1f;color:${x.color}">${I(x.k === 'cash' ? 'cash' : 'credit-card')}</span>${esc(x.name)} <small class="faint">${x.type === 'credit' ? 'كريدت' : x.type === 'debit' ? 'ديبت' : ''} · ${N(x.n)} عملية</small></span><b class="num">${N(x.v)}</b></div><div class="track"><i data-w="${pct(x.v, R.s.exp)}" style="background:${x.color}"></i></div></div>`).join('')}</div></div>` : ''}
  <div class="sec"><div class="sec-h"><h3>أكتر حاجات بتشتريها</h3></div><div class="list">${R.items.length ? R.items.map((x, k) => `<div class="item"><span class="ic" style="background:${cat(x.catId).color}1f;color:${cat(x.catId).color};font-weight:700">${N(k + 1)}</span><span class="mid"><b>${esc(x.name)}</b><small>${N(x.count)} مرة · ${esc(cat(x.catId).name)}</small></span><span class="amt num">${N(x.total)}</span></div>`).join('') : emptyBox('shopping-bag', 'اكتب وصف لمصروفاتك', 'عشان أعرف أكتر حاجة بتشتريها')}</div></div>
  ${R.bud.length ? `<div class="sec"><div class="sec-h"><h3>الميزانية — البند بيخلص إمتى؟</h3><button onclick="go('cats')">تعديل</button></div><div class="card">${R.bud.map(budgetRow).join('')}</div></div>` : `<div class="sec"><button class="card" style="width:100%;display:flex;gap:12px;align-items:center;text-align:start" onclick="go('cats')"><span class="ic b-indigo">${I('target')}</span><span style="flex:1"><b>حط ميزانية لكل بند</b><br><small class="faint">وأنا أقولك البند هيخلص خلال قد إيه</small></span>${I('chevron-left')}</button></div>`}
  <div class="sec"><div class="sec-h"><h3>آخر ٦ شهور</h3><span style="font-size:12px" class="faint"><span class="green">■</span> دخل &nbsp; <span class="red">■</span> مصروف</span></div>
    <div class="card" style="padding:12px 10px 6px">${Chart.duo(R.sixS.map(x => x.inc), R.sixS.map(x => x.exp), R.six.map(mk => MONTHS[+mk.slice(5) - 1].slice(0, 3)))}</div></div>
  <div class="sec"><button class="btn" onclick="exportPDF()">${I('file-type-pdf')} تصدير التقرير PDF</button></div>`;
}
function cmp(a, b, upGood) {
  const ch = Math.round((a - b) / b * 100); if (!isFinite(ch)) return '';
  const good = upGood ? ch >= 0 : ch <= 0;
  return `<span class="${good ? 'green' : 'red'}">${ch >= 0 ? '▲' : '▼'} ${N(Math.abs(ch))}٪</span> عن اللي قبلها`;
}

/* ================= SETTINGS ================= */
function vSettings() {
  const s = S();
  const row = (ic, color, t, sub, act, right = I('chevron-left', 'faint')) => `<button class="set" onclick="${act}"><span class="ic" style="background:${color}1f;color:${color}">${I(ic)}</span><span class="mid">${t}<small>${sub}</small></span>${right}</button>`;
  return `${topbar('الإعدادات', { backBtn: true })}
  <div class="sec" style="padding-top:0">
  <div class="card" style="display:flex;align-items:center;gap:14px;margin-bottom:14px;background:var(--grad);color:#fff"><img src="${LOGO_URL}" style="width:56px;height:56px;border-radius:16px;box-shadow:0 8px 20px rgba(0,0,0,.25)"><div style="flex:1"><b style="font-size:18px">${esc(s.name || 'حسابي')}</b><br><small style="opacity:.85">${N(D().tx.length)} حركة · ${N(D().debts.length)} مديونية</small></div></div>
  <div class="set-group">
    ${row('user', '#4F46E5', 'الاسم', esc(s.name || 'مش متحدد'), `editSetting('name')`)}
    ${row('briefcase', '#10B981', 'المرتب', s.salary ? `${N(s.salary)} ${esc(s.currency)} · يوم ${N(s.salaryDay)} في الشهر` : 'سجّل مرتبك عشان يفكّرك', `editSetting('salary')`)}
    ${row('wallet', '#06B6D4', 'الرصيد الافتتاحي', `${N(s.opening)} ${esc(s.currency)} — الفلوس اللي معاك قبل ما تبدأ`, `editSetting('opening')`)}
    ${row('credit-card', '#0EA5E9', 'البطاقات البنكية', D().cards.length ? `${N(Card.all().length)} بطاقة` : 'ضيف كروت الديبت والكريدت', `go('cards')`)}
    ${row('category', '#F59E0B', 'البنود والميزانيات', 'ضيف بنود وحط حد لكل بند', `go('cats')`)}
  </div>
  <div class="set-group">
    ${row('moon', '#6366F1', 'الوضع الليلي', s.theme === 'dark' ? 'شغال' : 'مقفول', `toggleTheme()`, `<span class="switch ${s.theme === 'dark' ? 'on' : ''}"></span>`)}
    ${row('language', '#0EA5E9', EN ? 'Language' : 'اللغة', EN ? 'English' : 'العربية', `langSheet()`, `<span class="badge b-indigo">${EN ? 'EN' : 'ع'}</span>`)}
    ${EN ? '' : row('number', '#EC4899', 'شكل الأرقام', s.digits === 'en' ? 'إنجليزي 123' : 'عربي ١٢٣', `S().digits=S().digits==='en'?'ar':'en';Store.save();refresh()`, `<span class="badge b-indigo">${s.digits === 'en' ? '123' : '١٢٣'}</span>`)}
    ${row('coin', '#EAB308', 'العملة', esc(s.currency), `editSetting('currency')`)}
    ${row('lock', '#EF4444', 'قفل برقم سري', s.pin ? 'شغال' : 'مقفول — احمي بياناتك', `pinSetup()`, `<span class="switch ${s.pin ? 'on' : ''}"></span>`)}
    ${s.pin ? row('fingerprint', '#10B981', 'الدخول بالبصمة أو الوش', s.bio ? 'شغال' : bioOK() ? 'افتح التطبيق من غير ما تكتب الرقم' : (NATIVE && NATIVE.bioAvailable ? 'مفيش بصمة متسجلة على الموبايل' : 'على الموبايل بس'), `toggleBio()`, `<span class="switch ${s.bio ? 'on' : ''}"></span>`) : ''}
    ${s.pin ? row('clock-shield', '#6366F1', 'وقت القفل', lockAfterLabel() + ' من ما تخرج من التطبيق', `lockAfterSheet()`) : ''}
    ${s.pin ? row('password', '#F59E0B', 'تغيير الرقم السري', 'اختار رقم جديد', `changePin()`) : ''}
  </div>
  <div class="sec-h" style="margin-top:4px"><h3>${I('bell')} الإشعارات</h3>${NATIVE && NATIVE.notifAllowed && !NATIVE.notifAllowed() ? `<button onclick="NATIVE.openNotifSettings()">فعّلها من الموبايل</button>` : ''}</div>
  <div class="set-group">
    ${row('calendar-dollar', '#F59E0B', 'تذكير الأقساط', s.notif.inst ? `${s.notif.before ? (EN ? ['', '1 day', '2 days', '3 days'][s.notif.before] + ' before' : 'قبل القسط بـ' + ['', 'يوم', 'يومين', '٣ أيام'][s.notif.before]) : 'يوم القسط نفسه'} · الساعة ${hourLabel(s.notif.hour)}` : 'مقفول', `toggleNotif('inst')`, `<span class="switch ${s.notif.inst ? 'on' : ''}"></span>`)}
    ${s.notif.inst ? row('clock', '#4F46E5', 'ميعاد تذكير الأقساط', 'إمتى أفكّرك، وقبلها بقد إيه', `notifTimes('inst')`) : ''}
    ${row('pencil', '#10B981', 'تذكير يومي بالمصروفات', s.notif.daily ? `كل يوم الساعة ${hourLabel(s.notif.dailyHour)} لو مسجّلتش حاجة` : 'مقفول', `toggleNotif('daily')`, `<span class="switch ${s.notif.daily ? 'on' : ''}"></span>`)}
    ${s.notif.daily ? row('clock', '#06B6D4', 'ميعاد التذكير اليومي', `الساعة ${hourLabel(s.notif.dailyHour)}`, `notifTimes('daily')`) : ''}
    ${row('bell-ringing', '#EC4899', 'جرّب الإشعار', 'هيوصلك إشعار تجريبي دلوقتي', `testNotif()`)}
  </div>
  <div class="sec-h" style="margin-top:4px"><h3>${I('shield-check')} حماية بياناتك</h3></div>
  <div class="set-group">
    ${row('cloud-check', '#10B981', 'نسخة احتياطية تلقائية', abLabel(), `autoBackupNow()`, `<span class="badge ${NATIVE && NATIVE.autoBackup ? 'b-green' : 'b-amber'}">${NATIVE && NATIVE.autoBackup ? 'شغالة' : 'موبايل بس'}</span>`)}
    ${row('history', '#4F46E5', 'نقاط الاسترجاع', 'نسخة كل يوم جوه التطبيق — ارجع لأي يوم', `snapshotsSheet()`)}
  </div>
  <div class="set-group">
    ${row('download', '#10B981', 'نسخة احتياطية', 'احفظ كل بياناتك في ملف', `backupExport()`)}
    ${row('upload', '#4F46E5', 'استرجاع نسخة', 'رجّع بياناتك من ملف', `backupImport()`)}
    ${row('file-type-pdf', '#E11D48', 'تقرير PDF', 'تقرير كامل بالحركات والتحليل', `exportPDF()`)}
    ${row('trash', '#EF4444', 'مسح كل البيانات', 'ابدأ من الأول', `confirmBox('تمسح كل البيانات؟',()=>{localStorage.removeItem(Store.KEY);location.reload()},'امسح الكل')`)}
  </div>
  <div style="text-align:center;color:var(--text3);font-size:12px;padding:10px 0 20px">رصيد — الإصدار 1.10.0<br>Powered by Shady Ahmed</div></div>`;
}
function editSetting(k) {
  const s = S();
  const f = { name: ['الاسم', `<div class="field"><input id="v1" value="${esc(s.name)}" placeholder="اسمك"></div>`],
    salary: ['المرتب', `<div class="amount-box"><input id="v1" inputmode="decimal" value="${s.salary || ''}" placeholder="0"><small>قيمة المرتب الشهري</small></div><div class="field"><label>يوم القبض في الشهر</label><input id="v2" inputmode="numeric" value="${s.salaryDay}"></div>`],
    opening: ['الرصيد الافتتاحي', `<div class="amount-box"><input id="v1" inputmode="decimal" value="${s.opening || ''}" placeholder="0"><small>الفلوس اللي معاك دلوقتي قبل أي حركة</small></div>`],
    currency: ['العملة', `<div class="field"><select id="v1" data-ic="coin" data-color="#EAB308">${['ج.م', 'ر.س', 'د.إ', 'د.ك', '$', '€'].map(c => `<option ${c === s.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div>`] }[k];
  openSheet(`<h3>${f[0]}</h3>${f[1]}<button class="btn" id="ok">${I('check')} حفظ</button>`, sh => {
    setTimeout(() => $('#v1', sh).focus(), 400);
    $('#ok', sh).onclick = () => {
      const v = $('#v1', sh).value;
      if (k === 'name') s.name = v.trim(); else if (k === 'currency') s.currency = v;
      else if (k === 'salary') { s.salary = parseNum(v); s.salaryDay = Math.min(28, Math.max(1, Math.round(parseNum($('#v2', sh).value)) || 1)); }
      else s.opening = parseNum(v);
      Store.save(); closeSheet(); refresh(); toast('اتحفظ');
    };
  });
}
function applyTheme() { document.documentElement.dataset.theme = S().theme === 'dark' ? 'dark' : 'light'; updateBar(); }
function updateBar() {
  if (!$('#splash').classList.contains('hide')) return setBar('#070B3E', false);
  const dark = S().theme === 'dark', overlay = $('#onb').classList.contains('show') || $('#lock').classList.contains('show');
  if (App.view === 'home' && !overlay) return setBar('#4338CA', false);
  setBar(dark ? '#0B1020' : '#F3F5FB', !dark);
}
function toggleTheme() { S().theme = S().theme === 'dark' ? 'light' : 'dark'; Store.save(); applyTheme(); refresh(); }

/* ---- categories ---- */
const ICON_CHOICES = ['tools-kitchen-2', 'shopping-cart', 'bus', 'car', 'bulb', 'home-2', 'device-mobile', 'first-aid-kit', 'school', 'shirt', 'baby-carriage', 'confetti', 'gift', 'armchair', 'heart-handshake', 'coffee', 'pizza', 'plane', 'paw', 'barbell', 'book', 'scissors', 'gas-station', 'wifi', 'droplet', 'flame', 'pill', 'smoking', 'device-tv', 'brush', 'cake', 'briefcase', 'building-bank', 'star', 'tool', 'cash', 'coin', 'dots'];
const COLOR_CHOICES = ['#F97316', '#10B981', '#3B82F6', '#6366F1', '#EAB308', '#8B5CF6', '#06B6D4', '#EF4444', '#EC4899', '#14B8A6', '#A855F7', '#64748B'];
function vCats() {
  const g = type => catsOf(type).filter(c => c.id !== 'debtpay' && c.id !== 'cardpay').map(c => `<button class="item" onclick="catForm('${c.id}')"><span class="ic" style="background:${c.color}1f;color:${c.color}">${I(c.icon)}</span><span class="mid"><b>${esc(c.name)}</b><small>${c.type === 'expense' ? (c.budget ? `ميزانية ${N(c.budget)} في الشهر` : 'من غير ميزانية') : 'دخل'}</small></span>${I('chevron-left', 'faint')}</button>`).join('');
  return `${topbar('البنود والميزانيات', { backBtn: true, right: `<button class="icon-btn" onclick="catForm()">${I('plus')}</button>` })}
  <div class="sec" style="padding-top:0"><div class="alert b-indigo">${I('info-circle')} حط ميزانية شهرية لأي بند، وأنا هقولك هيخلص خلال قد إيه.</div>
  <div class="sec-h"><h3>بنود المصروفات</h3></div><div class="list">${g('expense')}</div>
  <div class="sec-h" style="margin-top:16px"><h3>بنود الدخل</h3></div><div class="list">${g('income')}</div></div>`;
}
function catForm(id) {
  const c = id ? cat(id) : null;
  const st = { icon: c ? c.icon : 'dots', color: c ? c.color : '#4F46E5', type: c ? c.type : 'expense' };
  openSheet(`<h3>${c ? 'تعديل البند' : 'بند جديد'}${c && !c.sys ? `<button class="icon-btn" style="color:var(--red)" id="cdel">${I('trash')}</button>` : ''}</h3>
    ${c ? '' : `<div class="seg" id="cseg"><button data-t="expense" class="on">مصروف</button><button data-t="income">دخل</button></div>`}
    <div class="field"><label>اسم البند</label><input id="cn" value="${esc(c ? c.name : '')}"></div>
    <div class="field" id="bf"><label>الميزانية الشهرية (اختياري)</label><input id="cb" inputmode="decimal" value="${c && c.budget ? c.budget : ''}" placeholder="0 = من غير ميزانية"></div>
    <div class="field"><label>الأيقونة</label><div class="cats" style="grid-template-columns:repeat(6,1fr)" id="icons"></div></div>
    <div class="field"><label>اللون</label><div style="display:flex;gap:8px;flex-wrap:wrap" id="colors"></div></div>
    <button class="btn" id="cs">${I('check')} حفظ</button>`, sh => {
    const draw = () => {
      $('#icons', sh).innerHTML = ICON_CHOICES.map(i => `<button class="cat ${i === st.icon ? 'on' : ''}" data-i="${i}" style="padding:8px 2px"><span class="ic" style="background:${st.color}1f;color:${st.color}">${I(i)}</span></button>`).join('');
      $('#colors', sh).innerHTML = COLOR_CHOICES.map(x => `<button data-c="${x}" style="width:34px;height:34px;border-radius:50%;background:${x};border:3px solid ${x === st.color ? 'var(--text)' : 'transparent'}"></button>`).join('');
      $$('#icons [data-i]', sh).forEach(b => b.onclick = () => { st.icon = b.dataset.i; draw(); });
      $$('#colors [data-c]', sh).forEach(b => b.onclick = () => { st.color = b.dataset.c; draw(); });
      $('#bf', sh).style.display = st.type === 'expense' ? '' : 'none';
    };
    draw();
    $$('#cseg button', sh).forEach(b => b.onclick = () => { st.type = b.dataset.t; $$('#cseg button', sh).forEach(x => x.classList.toggle('on', x === b)); draw(); });
    $('#cs', sh).onclick = () => {
      const name = $('#cn', sh).value.trim(); if (!name) return toast('اكتب اسم البند', 'alert-triangle');
      const rec = { name, icon: st.icon, color: st.color, budget: st.type === 'expense' ? parseNum($('#cb', sh).value) : 0 };
      if (c) Object.assign(c, rec); else D().categories.push(Object.assign({ id: uid(), type: st.type, sys: false }, rec));
      Store.save(); closeSheet(); refresh(); toast('اتحفظ');
    };
    if (c && !c.sys) $('#cdel', sh).onclick = () => { c.hidden = true; Store.save(); closeSheet(); refresh(); toast('البند اتشال', 'trash'); };
  });
}

/* ---- notifications ---- */
function hourLabel(h) { const p = EN ? (h < 12 ? 'AM' : 'PM') : (h < 12 ? 'ص' : 'م'), x = h % 12 || 12; return `${N(x)} ${p}`; }
function needNative() { if (!NATIVE || !NATIVE.syncReminders) { toast('الإشعارات بتشتغل في تطبيق الموبايل بس', 'info-circle'); return true; } return false; }
function askNotif() { try { if (NATIVE && NATIVE.requestNotif) return NATIVE.requestNotif(); } catch (e) { } return true; }
function toggleNotif(k) {
  const n = S().notif; n[k] = !n[k];
  if (n[k] && NATIVE) askNotif();
  Store.save(); refresh(); toast(n[k] ? 'التذكير اتفعل' : 'التذكير اتقفل', n[k] ? 'bell' : 'bell-off');
}
function notifTimes(k) {
  const n = S().notif, hours = Array.from({ length: 24 }, (_, h) => h);
  openSheet(`<h3>${k === 'inst' ? 'تذكير الأقساط' : 'التذكير اليومي'}</h3>
    ${k === 'inst' ? `<div class="field"><label>فكّرني قبل القسط بـ</label><div class="seg" id="bseg">${[[0, 'نفس اليوم'], [1, 'يوم'], [2, 'يومين'], [3, '٣ أيام']].map(([v, l]) => `<button data-v="${v}" class="${n.before === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>` : ''}
    <div class="field"><label>الساعة</label><select id="hh" data-ic="clock" data-color="#4F46E5">${hours.map(h => `<option value="${h}" ${h === (k === 'inst' ? n.hour : n.dailyHour) ? 'selected' : ''}>${hourLabel(h)}</option>`).join('')}</select></div>
    <button class="btn" id="ok">${I('check')} حفظ</button>`, sh => {
    let before = n.before;
    $$('#bseg button', sh).forEach(b => b.onclick = () => { before = +b.dataset.v; $$('#bseg button', sh).forEach(x => x.classList.toggle('on', x === b)); });
    $('#ok', sh).onclick = () => {
      const h = +$('#hh', sh).value;
      if (k === 'inst') { n.hour = h; n.before = before; } else n.dailyHour = h;
      Store.save(); closeSheet(); refresh(); toast('الميعاد اتحفظ', 'clock');
    };
  });
}
function testNotif() {
  if (needNative()) return;
  const ok = askNotif(); syncReminders();
  if (ok === false) return toast('اسمح للتطبيق بالإشعارات الأول', 'bell');
  NATIVE.testNotif('inst'); toast('بعتلك إشعار — بص فوق', 'bell-ringing');
}
window.raseedNotifResult = ok => { toast(ok ? 'الإشعارات اتفعلت' : 'الإشعارات مقفولة — تقدر تفعّلها من الإعدادات', ok ? 'bell' : 'bell-off'); if (App.view === 'settings') refresh(); };
window.raseedOpen = v => { closeSheet(true); closeFab(); if (v === 'debts') go('debts', {}, { root: true }); else if (v === 'add') { go('home', {}, { root: true }); txForm({ type: 'expense' }); } };

/* ---- data protection ---- */
function abLabel() {
  let l = ''; try { l = localStorage.getItem('raseed_ab') || ''; } catch (e) { }
  return l ? `آخر نسخة: ${dayLabel(l)} · في ${BACKUP_WHERE}` : `بتتعمل لوحدها كل يوم في ${BACKUP_WHERE}`;
}
function autoBackupNow() {
  if (!NATIVE || !NATIVE.autoBackup) return toast('النسخة التلقائية بتشتغل على الموبايل بس', 'info-circle');
  if (!D().tx.length && !D().debts.length) return toast('لسه مفيش بيانات تتحفظ', 'info-circle');
  const r = autoBackup(null, true);
  if (r) { toast('اتحفظت في: ' + BACKUP_WHERE, 'cloud-check'); refresh(); }
  else backupExport();
}
function snapshotsSheet() {
  if (!NATIVE || !NATIVE.listSnapshots) return toast('نقاط الاسترجاع على الموبايل بس', 'info-circle');
  let list = []; try { list = JSON.parse(NATIVE.listSnapshots() || '[]'); } catch (e) { }
  const rows = list.map(f => {
    let d = null; try { d = JSON.parse(NATIVE.readSnapshot(f.name)); } catch (e) { }
    if (!d || !Array.isArray(d.tx)) return '';
    const dt = new Date(f.t), when = `${dayLabel(iso(dt))} · ${N(pad(dt.getHours()), true)}:${N(pad(dt.getMinutes()), true)}`;
    return `<button class="item" data-n="${esc(f.name)}"><span class="ic b-indigo">${I('history')}</span><span class="mid"><b>${when}</b><small>${N(d.tx.length)} حركة · ${N((d.debts || []).length)} مديونية</small></span>${I('chevron-left', 'faint')}</button>`;
  }).join('');
  openSheet(`<h3>نقاط الاسترجاع</h3><p class="muted" style="margin:-6px 0 12px;font-size:13px">التطبيق بيحتفظ بنسخة من بياناتك كل يوم (آخر ١٤ نسخة). اختار نسخة ترجعلها.</p>
    <div class="list">${rows || emptyBox('history', 'لسه مفيش نقاط استرجاع', 'هتتعمل لوحدها مع أول تسجيل')}</div>`, sh => {
    $$('[data-n]', sh).forEach(b => b.onclick = () => {
      const raw = NATIVE.readSnapshot(b.dataset.n);
      confirmBox('ترجع للنسخة دي؟', () => restoreData(raw), 'أيوه، رجّعها', 'بياناتك الحالية هتتبدل بالنسخة دي.');
    });
  });
}
function restoreData(raw) {
  try {
    const d = JSON.parse(raw); if (!d.settings || !Array.isArray(d.tx)) throw 0;
    try { localStorage.setItem(Store.KEY, JSON.stringify(d)); } catch (e) { }
    if (NATIVE && NATIVE.persist) NATIVE.persist(JSON.stringify(d));
    Store.load(); applyTheme(); go('home', {}, { root: true }); toast('البيانات رجعت ✓', 'check');
  } catch (e) { toast('الملف ده مش نسخة من رصيد', 'alert-triangle'); }
}

/* ---- backup ---- */
function backupExport() {
  const name = `raseed-backup-${today()}.json`, data = JSON.stringify(D(), null, 1);
  if (NATIVE && NATIVE.saveFile) { NATIVE.saveFile(name, data, 'application/json'); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name; a.click(); toast('النسخة اتحفظت', 'download');
}
function backupImport() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json,*/*';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return; const rd = new FileReader();
    rd.onload = () => {
      try { const d = JSON.parse(rd.result); if (!d.settings || !Array.isArray(d.tx)) throw 0;
        const doIt = () => { $('#onb').classList.remove('show'); d.settings.onboarded = true; restoreData(JSON.stringify(d)); };
        (D().tx.length || D().debts.length) ? confirmBox('هتستبدل بياناتك الحالية بالنسخة دي؟', doIt, 'أيوه، استرجع') : doIt();
      } catch (e) { toast('الملف ده مش نسخة من رصيد', 'alert-triangle'); }
    };
    rd.readAsText(f);
  };
  inp.click();
}

/* ---- PIN + biometric lock ---- */
const hashPin = p => { let h = 5381; for (const c of 'raseed:' + p) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); };
const bioOK = () => { try { return !!(NATIVE && NATIVE.bioAvailable && NATIVE.bioAvailable()); } catch (e) { return false; } };
function pinPad(title, onDone, sub = '', opt = {}) {
  const L = $('#lock'); let val = '';
  const left = opt.bio ? `<button data-k="f" class="bio-k" aria-label="البصمة">${I('fingerprint')}</button>` : `<button data-k="x" style="box-shadow:none;background:none">${App.pinCancel ? I('x') : ''}</button>`;
  L.innerHTML = `<div class="lock-logo"><img src="${LOGO_URL}"></div><h2 style="margin:0">${title}</h2><small class="muted" id="lsub">${sub}</small><div class="pin-dots">${'<i></i>'.repeat(4)}</div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${N(n)}</button>`).join('')}${left}<button data-k="0">${N(0)}</button><button data-k="b" style="box-shadow:none;background:none">${I('backspace')}</button></div>`;
  L.classList.add('show'); updateBar();
  const dots = $$('.pin-dots i', L), upd = () => dots.forEach((d, k) => d.classList.toggle('on', k < val.length));
  $$('.keypad button', L).forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (k === 'f') return askBio();
    if (k === 'b') val = val.slice(0, -1); else if (k === 'x') { if (App.pinCancel) { L.classList.remove('show'); App.pinCancel = false; updateBar(); } return; }
    else if (val.length < 4) val += k;
    if (opt.locked && opt.locked()) { val = ''; upd(); return; }
    upd(); if (NATIVE && NATIVE.vibrate) try { NATIVE.vibrate(8); } catch (e) { }
    if (val.length === 4) setTimeout(() => { const ok = onDone(val); if (ok === false) { if (NATIVE && NATIVE.vibrate) try { NATIVE.vibrate(60); } catch (e) { } $('.pin-dots', L).classList.add('err'); setTimeout(() => { $('.pin-dots', L).classList.remove('err'); val = ''; upd(); }, 420); } }, 120);
  });
}
function unlock() { const L = $('#lock'); L.classList.add('out'); setTimeout(() => { L.classList.remove('show', 'out'); updateBar(); }, 380); App.locked = false; App.fails = 0; }
function askBio() {
  if (!S().bio || !bioOK()) return;
  try { NATIVE.bioAuth(TR('فتح رصيد'), TR('استخدم البصمة أو الوش عشان تفتح')); } catch (e) { }
}
window.raseedBio = (ok, code) => {
  if (App.bioSetup) { const f = App.bioSetup; App.bioSetup = null; return f(ok); }
  if (ok && App.locked) unlock();
};
function lockScreen() {
  if (!S().pin) return;
  App.pinCancel = false; App.locked = true; App.fails = App.fails || 0;
  const useBio = S().bio && bioOK();
  const locked = () => { if (App.waitUntil && Date.now() < App.waitUntil) { const sec = Math.ceil((App.waitUntil - Date.now()) / 1000); $('#lsub').textContent = `استنى ${N(sec)} ثانية وجرّب تاني`; return true; } return false; };
  pinPad('أهلاً بيك 👋', v => {
    if (hashPin(v) === S().pin) { unlock(); return true; }
    App.fails++;
    if (App.fails >= 5) { App.waitUntil = Date.now() + 30000; App.fails = 0; $('#lsub').textContent = 'محاولات كتير غلط — استنى ٣٠ ثانية'; }
    else $('#lsub').textContent = `الرقم غلط — فاضل ${N(5 - App.fails)} محاولات`;
    return false;
  }, useBio ? 'دخّل الرقم السري أو استخدم البصمة' : 'دخّل الرقم السري', { bio: useBio, locked });
  if (useBio) setTimeout(askBio, 450);
}
function pinSetup() {
  App.pinCancel = true;
  if (S().pin) return pinPad('أدخل الرقم الحالي لإلغاء القفل', v => { if (hashPin(v) !== S().pin) return false; S().pin = ''; S().bio = false; Store.save(); unlock(); refresh(); toast('القفل اتشال', 'lock-open'); });
  newPin();
}
function newPin(change) {
  App.pinCancel = true;
  pinPad(change ? 'اختار الرقم السري الجديد' : 'اختار رقم سري من ٤ أرقام', v1 => {
    pinPad('أكّد الرقم السري', v2 => {
      if (v1 !== v2) { toast('الرقمين مش زي بعض', 'alert-triangle'); return false; }
      S().pin = hashPin(v1); Store.save(); unlock(); App.pinCancel = false; refresh(); toast(change ? 'الرقم السري اتغير' : 'القفل اتفعل', 'lock');
      if (!change && bioOK() && !S().bio) setTimeout(() => confirmBox('تفعّل الدخول بالبصمة كمان؟', toggleBio, 'أيوه، فعّلها', 'تفتح التطبيق ببصمتك من غير ما تكتب الرقم كل مرة.'), 500);
    });
  });
}
function changePin() {
  App.pinCancel = true;
  pinPad('أدخل الرقم السري الحالي', v => { if (hashPin(v) !== S().pin) return false; newPin(true); });
}
function toggleBio() {
  if (!S().pin) return toast('فعّل الرقم السري الأول', 'lock');
  if (S().bio) { S().bio = false; Store.save(); refresh(); return toast('الدخول بالبصمة اتقفل', 'fingerprint'); }
  if (!NATIVE || !NATIVE.bioAuth) return toast('البصمة بتشتغل على الموبايل بس', 'info-circle');
  if (!bioOK()) return toast('سجّل بصمة في إعدادات الموبايل الأول', 'fingerprint');
  App.bioSetup = ok => { if (!ok) return toast('البصمة ما اتأكدتش', 'info-circle'); S().bio = true; Store.save(); refresh(); toast('الدخول بالبصمة اتفعل', 'fingerprint'); };
  NATIVE.bioAuth(TR('تفعيل البصمة'), TR('أكّد بصمتك عشان نفعّل الدخول بيها'));
}
function lockAfterSheet() {
  const cur = S().lockAfter ?? 60;
  openSheet(`<h3>اقفل التطبيق لما أخرج منه بعد</h3><div class="list">${[[0, 'على طول'], [60, 'دقيقة'], [300, '٥ دقايق'], [900, '١٥ دقيقة']].map(([v, l]) => `<button class="item" data-v="${v}"><span class="ic b-indigo">${I('clock')}</span><span class="mid"><b>${l}</b></span>${v === cur ? I('check', 'green') : ''}</button>`).join('')}</div>`, sh => {
    $$('[data-v]', sh).forEach(b => b.onclick = () => { S().lockAfter = +b.dataset.v; Store.save(); closeSheet(); refresh(); toast('اتحفظ', 'clock'); });
  });
}
const lockAfterLabel = () => ({ 0: 'على طول', 60: 'بعد دقيقة', 300: 'بعد ٥ دقايق', 900: 'بعد ١٥ دقيقة' })[S().lockAfter ?? 60];

function langSheet() {
  openSheet(`<h3>${EN ? 'Language' : 'اللغة'}</h3><div class="list">${[['ar', 'العربية', 'ع'], ['en', 'English', 'EN']].map(([v, l, b]) => `<button class="item" data-v="${v}"><span class="ic b-indigo" style="font-weight:700">${b}</span><span class="mid"><b class="notr">${l}</b></span>${v === LANG ? I('check', 'green') : ''}</button>`).join('')}</div>`, sh => {
    $$('[data-v]', sh).forEach(b => b.onclick = () => { if (b.dataset.v === LANG) return closeSheet(); setLang(b.dataset.v); });
  });
}

/* ---- onboarding ---- */
function onboarding() {
  const O = $('#onb');
  const sl = [['wallet', 'كل فلوسك في مكان واحد', 'سجّل مصروفك اليومي والإيداعات والمرتب بضغطة واحدة.'],
    ['calendar-dollar', 'قسّط مديونياتك بذكاء', 'سجّل أي مديونية، وقسّطها على المواعيد اللي تناسبك، وأنا أفكّرك بكل قسط.'],
    ['chart-pie', 'تقارير تفهم منها', 'اعرف أكتر حاجة بتصرف فيها، والبند بيخلص إمتى، ونقاط قوتك — وطلّعها PDF.']];
  O.innerHTML = `<button class="onb-lang" onclick="setLang(EN ? 'ar' : 'en')">${I('language')}<span class="notr">${EN ? 'العربية' : 'English'}</span></button><div class="onb-slides" id="os">${sl.map(([ic, t, p]) => `<div class="onb-s"><div class="onb-art">${I(ic)}</div><h2>${t}</h2><p>${p}</p></div>`).join('')}
    <div class="onb-s" style="justify-content:center"><img src="${LOGO_URL}" style="width:84px;height:84px;border-radius:24px;margin-bottom:18px;box-shadow:var(--shadow-lg)"><h2>يلا نبدأ</h2><p style="margin-bottom:20px">شوية بيانات بسيطة (تقدر تغيرها بعدين)</p>
      <div style="width:100%;max-width:340px;text-align:start"><div class="field"><label>اسمك</label><input id="on1" placeholder="مثلاً: شادي"></div>
      <div class="field"><label>مرتبك الشهري (اختياري)</label><input id="on2" inputmode="decimal" placeholder="0"></div>
      <div class="field"><label>الفلوس اللي معاك دلوقتي (اختياري)</label><input id="on3" inputmode="decimal" placeholder="0"></div>
      <button class="btn ghost" style="margin-top:4px" onclick="backupImport()">${I('cloud-download')} عندي نسخة احتياطية — رجّعها</button></div></div></div>
    <div class="onb-foot"><div class="dots" id="od" style="margin:0 0 16px">${'<i></i>'.repeat(4)}</div><button class="btn" id="onx">التالي ${I('chevron-left')}</button></div>`;
  O.classList.add('show');
  const s = $('#os', O), dots = $$('#od i', O), btn = $('#onx', O);
  const idx = () => Math.round(Math.abs(s.scrollLeft) / s.clientWidth);
  const upd = () => { const k = idx(); dots.forEach((d, j) => d.classList.toggle('on', j === k)); btn.innerHTML = k === 3 ? `${I('check')} ابدأ` : `التالي ${I('chevron-left')}`; };
  s.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true }); upd();
  btn.onclick = () => {
    const k = idx();
    if (k < 3) return s.scrollTo({ left: DIRX * (k + 1) * s.clientWidth, behavior: 'smooth' });
    S().name = $('#on1', O).value.trim(); S().salary = parseNum($('#on2', O).value); S().opening = parseNum($('#on3', O).value); S().onboarded = true;
    Store.save(); setTimeout(askNotif, 900); O.style.transition = 'opacity .4s'; O.style.opacity = 0; setTimeout(() => { O.classList.remove('show'); O.style.opacity = ''; updateBar(); }, 400); go('home', {}, { root: true });
  };
}

/* ================= BOOT ================= */
function boot() {
  try { if (NATIVE && NATIVE.setLang) NATIVE.setLang(LANG); } catch (e) { }
  Store.load(); applyTheme(); buildNav(); go('home', {}, { root: true });
  const sp = $('#splash'), app = $('#app');
  app.classList.add('pre');
  setTimeout(() => {
    sp.classList.add('exit');
    setTimeout(() => { app.classList.remove('pre'); app.classList.add('enter'); }, 260);
    setTimeout(() => { sp.classList.add('hide'); app.classList.remove('enter'); updateBar(); }, 950);
  }, 2650);
  setTimeout(() => {
    if (!S().onboarded) onboarding(); else if (S().pin) lockScreen();
    updateBar();
    syncReminders();
    try { const v = NATIVE && NATIVE.takeOpen && NATIVE.takeOpen(); if (v && !S().pin) raseedOpen(v); } catch (e) { }
  }, 3000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) App.hiddenAt = Date.now(); else if (S().pin && !App.locked && !App.pinCancel && App.hiddenAt && Date.now() - App.hiddenAt >= (S().lockAfter ?? 60) * 1000) lockScreen(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') back(); });
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
