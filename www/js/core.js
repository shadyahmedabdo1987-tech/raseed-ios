'use strict';
/* ====== رصيد — core: store, utils, charts ====== */
const NATIVE = window.RaseedNative || null;
const IOS = !!(NATIVE && NATIVE.platform === 'ios');
const LOGO_URL = window.__LOGO || 'img/logo.png';
const FONT_URL = w => (window.__FONTS && window.__FONTS[w]) || `fonts/IBMPlexSansArabic-${w}.woff2`;
const BACKUP_WHERE = IOS ? 'تطبيق الملفات ← على الـ iPhone ← رصيد' : 'التنزيلات ← Raseed';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const I = (n, cls = '') => `<svg class="i i-${n} ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${(window.ICONS || {})[n] || ''}</svg>`;

/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, '0');
const r3 = v => { const x = Math.round((Number(v) || 0) * 100) / 100; return Object.is(x, -0) ? 0 : x; };
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
const addMonths = (s, n) => {
  const d = parseD(s), day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last)); return iso(d);
};
const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const monthKey = s => s.slice(0, 7);
const MONTHS = EN ? ['January','February','March','April','May','June','July','August','September','October','November','December'] : ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DAYS = EN ? ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] : ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
const monthName = mk => { const [y, m] = mk.split('-').map(Number); return `${MONTHS[m - 1]} ${N(y, true)}`; };
const dayLabel = s => {
  const t = today();
  if (s === t) return 'النهارده';
  if (s === addDays(t, -1)) return 'إمبارح';
  if (s === addDays(t, 1)) return 'بكرة';
  const d = parseD(s);
  return `${DAYS[d.getDay()]} ${N(d.getDate(), true)} ${MONTHS[d.getMonth()]}`;
};
const shortDate = s => { const d = parseD(s); return `${N(d.getDate(), true)} ${MONTHS[d.getMonth()]} ${N(d.getFullYear(), true)}`; };
const daysInMonth = mk => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };

/* ---------- month cycle ----------
   mode "day":    the month starts on a fixed day (1 = calendar months, 28 = from the 28th…)
   mode "salary": a new month starts on the date the salary is recorded (25, 26, 27… whatever it is that month);
                  months without a recorded salary fall back to the same day as the last one. */
const Cycle = {
  _c: null, _sig: '',
  mode() { return (Store.data && Store.data.settings.cycleMode) || 'day'; },
  day() { const d = +((Store.data && Store.data.settings.cycleDay) || 1); return Math.min(28, Math.max(1, d || 1)); },
  carry() { return (Store.data && Store.data.settings.carry) || 'all'; },   // all | surplus | none
  isSalary: t => t.type === 'income' && t.catId === 'salary' && !t.noCycle,
  starts() {
    const tx = Store.data.tx, st = Store.data.settings;
    const sig = [tx.length, tx.reduce((m, t) => m + (Cycle.isSalary(t) ? t.date : ''), ''), this.mode(), this.day(), today()].join('|');
    if (this._c && this._sig === sig) return this._c;
    const first = tx.reduce((m, x) => x.date < m ? x.date : m, st.createdAt || today());
    const lo = addMonths(first.slice(0, 7) + '-01', -14), hi = addMonths(today().slice(0, 7) + '-01', 14);
    const out = [];
    const fill = (from, to, day) => { // monthly anchors on "day" strictly after "from" and before "to"
      let k = addMonths(from.slice(0, 7) + '-01', 1);
      while (true) { const mk = monthKey(k), d = `${mk}-${pad(Math.min(day, daysInMonth(mk)))}`; if (d >= to) break; if (d > from) out.push(d); k = addMonths(k, 1); }
    };
    const sal = this.mode() === 'salary' ? [...new Set(tx.filter(Cycle.isSalary).map(t => t.date))].sort() : [];
    if (!sal.length) {
      const day = this.day(); let k = lo;
      while (k <= hi) { const mk = monthKey(k); out.push(`${mk}-${pad(day)}`); k = addMonths(k, 1); }
    } else {
      const d0 = +sal[0].slice(8, 10); let k = lo; while (true) { const mk = monthKey(k), d = `${mk}-${pad(Math.min(d0, daysInMonth(mk)))}`; if (d >= sal[0]) break; out.push(d); k = addMonths(k, 1); }
      sal.forEach((d, i) => {
        out.push(d);
        const nx = sal[i + 1] || hi;
        if (diffDays(d, nx) > 40) fill(d, sal[i + 1] ? addDays(nx, -20) : nx, +d.slice(8, 10));
      });
    }
    this._c = [...new Set(out)].sort(); this._sig = sig; return this._c;
  },
  start(date) { const a = this.starts(); let r = a[0]; for (const s of a) { if (s <= date) r = s; else break; } return r; },
  next(start) { const a = this.starts(); return a.find(s => s > start) || addMonths(start, 1); },
  range(date) { const f = this.start(date); return { from: f, to: addDays(this.next(f), -1) }; },
  keyOfStart(f) { return +f.slice(8, 10) > 15 ? monthKey(addMonths(f.slice(0, 7) + '-01', 1)) : monthKey(f); },
  /* a month is named after the calendar month it mostly covers */
  key(date) { return this.keyOfStart(this.start(date)); },
  rangeOf(key) {
    const f = this.starts().find(s => this.keyOfStart(s) === key);
    if (!f) return { from: key + '-01', to: `${key}-${pad(daysInMonth(key))}` };
    return { from: f, to: addDays(this.next(f), -1) };
  },
  shift(key, n) { return monthKey(addMonths(key + '-01', n)); },
  custom() { return this.mode() === 'salary' || this.day() > 1; }
};

/* ---------- numbers ---------- */
const AR = '٠١٢٣٤٥٦٧٨٩';
function toAr(str) { return String(str).replace(/[0-9]/g, d => AR[d]).replace(/,/g, '٬'); }
function N(n, plain = false) {
  if (n == null || isNaN(n)) n = 0;
  const s = plain ? String(n) : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return (EN || Store.data.settings.digits === 'en') ? s : toAr(s);
}
const money = (n, sign = false) => {
  const v = Math.abs(r3(n));
  const pre = sign ? (n > 0 ? '+' : n < 0 ? '−' : '') : (n < 0 ? '−' : '');
  return `${pre}${N(v)} <small>${esc(Store.data.settings.currency)}</small>`;
};
const moneyT = n => `${n < 0 ? '−' : ''}${N(Math.abs(r3(n)))} ${Store.data.settings.currency}`;
function parseNum(s) {
  s = String(s || '').trim().replace(/[٠-٩]/g, d => AR.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٬,\s]/g, '').replace(/٫/g, '.');
  const v = parseFloat(s); return isNaN(v) ? 0 : v;
}
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

/* ---------- default data ---------- */
const DEFAULT_CATS = [
  ['food', 'أكل ومطاعم', 'tools-kitchen-2', '#F97316', 'expense'],
  ['market', 'سوبرماركت', 'shopping-cart', '#10B981', 'expense'],
  ['transport', 'مواصلات', 'bus', '#3B82F6', 'expense'],
  ['car', 'عربية وبنزين', 'car', '#6366F1', 'expense'],
  ['bills', 'فواتير', 'bulb', '#EAB308', 'expense'],
  ['rent', 'إيجار وسكن', 'home-2', '#8B5CF6', 'expense'],
  ['phone', 'موبايل ونت', 'device-mobile', '#06B6D4', 'expense'],
  ['health', 'صحة وعلاج', 'first-aid-kit', '#EF4444', 'expense'],
  ['edu', 'تعليم ومدارس', 'school', '#0EA5E9', 'expense'],
  ['clothes', 'لبس', 'shirt', '#EC4899', 'expense'],
  ['kids', 'أطفال', 'baby-carriage', '#F472B6', 'expense'],
  ['fun', 'خروجات وترفيه', 'confetti', '#A855F7', 'expense'],
  ['gifts', 'هدايا ومناسبات', 'gift', '#E11D48', 'expense'],
  ['home', 'مستلزمات البيت', 'armchair', '#14B8A6', 'expense'],
  ['charity', 'صدقات وزكاة', 'heart-handshake', '#22C55E', 'expense'],
  ['debtpay', 'سداد أقساط', 'receipt-2', '#64748B', 'expense'],
  ['cardpay', 'سداد بطاقة', 'credit-card-pay', '#0EA5E9', 'expense'],
  ['other', 'أخرى', 'dots', '#94A3B8', 'expense'],
  ['salary', 'مرتب', 'briefcase', '#10B981', 'income'],
  ['deposit', 'إيداع', 'building-bank', '#4F46E5', 'income'],
  ['bonus', 'مكافأة وحوافز', 'star', '#F59E0B', 'income'],
  ['freelance', 'شغل إضافي', 'tool', '#06B6D4', 'income'],
  ['collect', 'تحصيل ديون', 'cash', '#22C55E', 'income'],
  ['loan', 'قرض أو سلفة', 'coin', '#8B5CF6', 'income'],
  ['iother', 'إيرادات أخرى', 'dots', '#94A3B8', 'income']
].map(([id, name, icon, color, type]) => ({ id, name, icon, color, type, budget: 0, sys: true }));

const Store = {
  KEY: 'raseed_v1',
  data: null,
  blank() {
    return {
      v: 1,
      settings: { cycleMode: 'day', cycleDay: 1, carry: 'all', name: '', currency: 'ج.م', digits: 'ar', theme: 'light', pin: '', notif: { inst: true, before: 1, hour: 10, daily: false, dailyHour: 21 }, salary: 0, salaryDay: 1, opening: 0, onboarded: false, createdAt: today() },
      categories: JSON.parse(JSON.stringify(DEFAULT_CATS)),
      tx: [],
      debts: [],
      cards: []
    };
  },
  load() {
    try {
      let raw = null; try { raw = localStorage.getItem(this.KEY); } catch (e) { }
      if (!raw && NATIVE && NATIVE.restore) { try { raw = NATIVE.restore() || null; } catch (e) { } }
      this.data = raw ? JSON.parse(raw) : this.blank();
    }
    catch (e) { this.data = this.blank(); }
    const b = this.blank();
    this.data.settings = Object.assign(b.settings, this.data.settings || {});
    this.data.settings.notif = Object.assign({ inst: true, before: 1, hour: 10, daily: false, dailyHour: 21 }, this.data.settings.notif || {});
    this.data.categories = this.data.categories || b.categories;
    DEFAULT_CATS.forEach(c => { if (!this.data.categories.find(x => x.id === c.id)) this.data.categories.push(JSON.parse(JSON.stringify(c))); });
    this.data.tx = this.data.tx || []; this.data.debts = this.data.debts || []; this.data.cards = this.data.cards || [];
  },
  save() {
    const json = JSON.stringify(this.data); let ok = false;
    try { localStorage.setItem(this.KEY, json); ok = true; } catch (e) { }
    if (NATIVE && NATIVE.persist) { try { ok = NATIVE.persist(json) || ok; } catch (e) { } }
    if (!ok) toast('مقدرتش أحفظ البيانات', 'alert-triangle');
    autoBackup(json);
    syncReminders();
  }
};
const cat = id => Store.data.categories.find(c => c.id === id) || Store.data.categories.find(c => c.id === 'other');
const catsOf = type => Store.data.categories.filter(c => c.type === type && !c.hidden);

/* ---------- bank cards ---------- */
const CARD_THEMES = [['#1E1B4B', '#4338CA', '#06B6D4'], ['#0F172A', '#334155', '#64748B'], ['#064E3B', '#047857', '#34D399'], ['#7C2D12', '#C2410C', '#FBBF24'], ['#4A044E', '#A21CAF', '#F472B6'], ['#172554', '#1D4ED8', '#60A5FA'], ['#450A0A', '#B91C1C', '#F87171'], ['#1C1917', '#78716C', '#D6D3D1']];
const Card = {
  all: () => Store.data.cards.filter(c => !c.archived),
  get: id => Store.data.cards.find(c => c.id === id),
  src: t => t.src || 'cash',
  onCredit: t => { if (!t.src || t.src === 'cash') return false; const c = Card.get(t.src); return !!(c && c.type === 'credit'); },
  txs: c => Store.data.tx.filter(t => t.src === c.id),
  pays: c => Store.data.tx.filter(t => t.cardPay === c.id),
  used(c) {
    if (c.type !== 'credit') return 0;
    let u = c.openingUsed || 0;
    Card.txs(c).forEach(t => u += t.type === 'expense' ? t.amount : -t.amount);
    Card.pays(c).forEach(t => u -= t.amount);
    return r3(u);
  },
  available: c => (c.limit || 0) - Card.used(c),
  spent(c, from, to) { return Card.txs(c).filter(t => t.type === 'expense' && (!from || t.date >= from) && (!to || t.date <= to)).reduce((s, t) => s + t.amount, 0); },
  theme: c => CARD_THEMES[(c.theme || 0) % CARD_THEMES.length],
  label: c => c.name + (c.last4 ? ' •' + c.last4 : ''),
  nextDue(c) {
    if (!c.dueDay) return null; const t = today(), d = parseD(t);
    const mk = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, day = Math.min(c.dueDay, daysInMonth(mk));
    let due = `${mk}-${pad(day)}`; if (due < t) { const n = addMonths(mk + '-01', 1); due = n.slice(0, 8) + pad(Math.min(c.dueDay, daysInMonth(n.slice(0, 7)))); }
    return due;
  }
};

/* ---------- calculations ---------- */
const Calc = {
  cash(list) { return list.reduce((s, t) => Card.onCredit(t) ? s : s + (t.type === 'income' ? t.amount : -t.amount), 0); },
  /** money on hand. carry = all: everything since the start (opening + all). none: only this month (each month stands alone).
      surplus: savings roll into next month, a deficit doesn't. */
  balance(date = today()) {
    const st = Store.data.settings, mode = Cycle.carry();
    if (mode === 'all') return st.opening + Calc.cash(Store.data.tx);
    const r = Cycle.range(date), cur = Calc.cash(Calc.inRange(r.from, r.to));
    const first = Store.data.tx.reduce((m, x) => x.date < m ? x.date : m, st.createdAt || today());
    if (mode === 'none') return cur + (Cycle.start(first) === r.from ? st.opening : 0);
    let carry = st.opening;
    Cycle.starts().filter(x => x >= Cycle.start(first) && x < r.from).forEach(f => { carry = Math.max(0, carry + Calc.cash(Calc.inRange(f, addDays(Cycle.next(f), -1)))); });
    return carry + cur;
  },
  /** what came over from earlier months into the current one (for the label under the balance) */
  carried(date = today()) {
    const mode = Cycle.carry(); if (mode === 'all') return null;
    const r = Cycle.range(date); return Calc.balance(date) - Calc.cash(Calc.inRange(r.from, r.to));
  },
  inRange(from, to) { return Store.data.tx.filter(t => (!from || t.date >= from) && (!to || t.date <= to)); },
  sums(list) {
    let inc = 0, exp = 0; list.forEach(t => { if (t.catId === 'cardpay') return; if (t.type === 'income') { if (!Card.onCredit(t)) inc += t.amount; } else exp += t.amount; });
    return { inc, exp, net: inc - exp };
  },
  month(mk) { const r = Cycle.rangeOf(mk); return Calc.inRange(r.from, r.to); },
  byCat(list, type = 'expense') {
    const m = {}; list.filter(t => t.type === type && t.catId !== 'cardpay' && !(type === 'income' && Card.onCredit(t))).forEach(t => m[t.catId] = (m[t.catId] || 0) + t.amount);
    return Object.entries(m).map(([id, v]) => ({ cat: cat(id), v })).sort((a, b) => b.v - a.v);
  },
  avgDaily(days = 30) {
    const t = today(), from = addDays(t, -(days - 1));
    const list = Calc.inRange(from, t).filter(x => x.type === 'expense' && x.catId !== 'debtpay' && x.catId !== 'cardpay' && !Card.onCredit(x));
    if (!list.length) return 0;
    const first = Store.data.tx.reduce((m, x) => x.date < m ? x.date : m, t);
    const span = Math.max(7, Math.min(days, diffDays(first, t) + 1));
    return list.reduce((s, x) => s + x.amount, 0) / span;
  },
  runway() {
    const bal = Calc.balance(), avg = Calc.avgDaily();
    if (avg <= 0 || bal <= 0) return { days: bal <= 0 ? 0 : null, avg, date: null };
    const days = Math.floor(bal / avg);
    return { days, avg, date: addDays(today(), days) };
  },
  budgets(mk = Cycle.key(today())) {
    const list = Calc.month(mk), t = today(), rg = Cycle.rangeOf(mk);
    const dim = diffDays(rg.from, rg.to) + 1, cur = Cycle.key(t) === mk ? diffDays(rg.from, t) + 1 : dim;
    return Store.data.categories.filter(c => c.type === 'expense' && c.budget > 0).map(c => {
      const spent = list.filter(x => x.type === 'expense' && x.catId === c.id).reduce((s, x) => s + x.amount, 0);
      const rate = spent / Math.max(1, cur);
      const left = c.budget - spent;
      let runsOut = null;
      if (left <= 0) runsOut = 0; else if (rate > 0) runsOut = Math.floor(left / rate);
      const willFinishEarly = runsOut !== null && runsOut < (dim - cur);
      return { c, spent, left, p: pct(spent, c.budget), runsOut, willFinishEarly, daysLeftInMonth: dim - cur };
    }).sort((a, b) => b.p - a.p);
  },
  topItems(list, n = 6) {
    const m = {};
    list.filter(t => t.type === 'expense' && t.note && t.note.trim()).forEach(t => {
      const k = t.note.trim().replace(/\s+/g, ' ');
      m[k] = m[k] || { name: k, count: 0, total: 0, catId: t.catId };
      m[k].count++; m[k].total += t.amount;
    });
    return Object.values(m).sort((a, b) => b.count - a.count || b.total - a.total).slice(0, n);
  },
  weekday(list) {
    const w = Array(7).fill(0); list.filter(t => t.type === 'expense').forEach(t => w[parseD(t.date).getDay()] += t.amount); return w;
  }
};

/* ---------- debts ---------- */
const Debt = {
  instPaid: i => (i.payments || []).reduce((s, p) => s + p.amount, 0),
  instDone: i => Debt.instPaid(i) >= i.amount - 0.009,
  flex: d => d.mode === 'flex',
  adds: d => (d.entries || []).filter(e => e.kind === 'add').reduce((s, e) => s + e.amount, 0),
  pays: d => (d.entries || []).filter(e => e.kind === 'pay').reduce((s, e) => s + e.amount, 0),
  total: d => Debt.flex(d) ? Debt.adds(d) : d.installments.reduce((s, i) => s + i.amount, 0),
  paid: d => Debt.flex(d) ? Debt.pays(d) : d.installments.reduce((s, i) => s + Debt.instPaid(i), 0),
  remaining: d => Math.max(0, Debt.total(d) - Debt.paid(d)),
  done: d => Debt.flex(d) ? Debt.total(d) > 0 && Debt.paid(d) >= Debt.total(d) - 0.009 : d.installments.length > 0 && d.installments.every(Debt.instDone),
  next: d => d.installments.filter(i => !Debt.instDone(i)).sort((a, b) => a.due < b.due ? -1 : 1)[0] || null,
  overdue: d => d.installments.filter(i => !Debt.instDone(i) && i.due < today()),
  schedule(total, count, firstDue, freq, instAmount) {
    count = Math.max(1, Math.round(count));
    const base = instAmount > 0 ? instAmount : Math.floor(total / count * 100) / 100;
    const out = []; let acc = 0, due = firstDue;
    for (let k = 0; k < count; k++) {
      let amt = k === count - 1 ? r3((total - acc)) : base;
      if (amt <= 0) break;
      out.push({ id: uid(), due, amount: amt, payments: [] }); acc += amt;
      due = freq === 'w' ? addDays(due, 7) : freq === '2w' ? addDays(due, 14) : freq === '3m' ? addMonths(due, 3) : freq === '6m' ? addMonths(due, 6) : addMonths(due, 1);
    }
    return out;
  },
  upcoming(days = 7) {
    const t = today(), lim = addDays(t, days), out = [];
    Store.data.debts.forEach(d => d.installments.forEach((i, idx) => {
      if (!Debt.instDone(i) && i.due <= lim) out.push({ d, i, idx, late: i.due < t });
    }));
    return out.sort((a, b) => a.i.due < b.i.due ? -1 : 1);
  }
};

/* ---------- ui helpers ---------- */
let toastT;
function toast(msg, icon = 'check') {
  const t = $('#toast'); t.innerHTML = I(icon) + esc(msg); t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
  if (NATIVE && NATIVE.vibrate) try { NATIVE.vibrate(12); } catch (e) { }
}
function countUp(root = document) {
  $$('[data-count]', root).forEach(el => {
    const target = parseFloat(el.dataset.count), dur = 1100, t0 = performance.now(), neg = target < 0;
    const cur = el.dataset.cur || '';
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      const v = Math.round(Math.abs(target) * e);
      el.innerHTML = `${neg ? '−' : ''}${N(p < 1 ? v : r3(Math.abs(target)))}${cur ? ` <small>${esc(cur)}</small>` : ''}`;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
function animateBars(root = document) {
  requestAnimationFrame(() => setTimeout(() => {
    $$('[data-w]', root).forEach(el => el.style.width = el.dataset.w + '%');
    $$('[data-off]', root).forEach(el => el.style.strokeDashoffset = el.dataset.off);
  }, 60));
}
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.rip,.btn,.item,.qa span,.set,.chip-b'); if (!b) return;
  b.classList.add('rip');
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), sp = document.createElement('span');
  sp.className = 'rp'; sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  b.appendChild(sp); setTimeout(() => sp.remove(), 600);
}, { passive: true });

/* ---------- charts (pure svg) ---------- */
const Chart = {
  bars(values, labels, { h = 150, color = 'url(#gBar)', highlight = -1, fmt = v => N(r3(v)) } = {}) {
    const W = 340, H = h, pb = 22, pt = 18, n = values.length || 1, max = Math.max(1, ...values);
    const bw = Math.min(26, (W - 10) / n * .62), gap = (W - 10) / n;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="gBar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4F46E5"/><stop offset="1" stop-color="#06B6D4"/></linearGradient><linearGradient id="gBarR" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#E11D48"/><stop offset="1" stop-color="#F97316"/></linearGradient></defs>`;
    [.25, .5, .75, 1].forEach(f => { const y = H - pb - (H - pb - pt) * f; s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-dasharray="3 4"/>`; });
    values.forEach((v, k) => {
      const bh = Math.max(v > 0 ? 3 : 0, (H - pb - pt) * v / max), x = W - 5 - gap * k - gap / 2 - bw / 2, y = H - pb - bh;
      s += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${Math.min(6, bw / 2)}" fill="${k === highlight ? 'url(#gBarR)' : color}" style="transform-origin:center bottom;transform-box:fill-box;animation:growY .9s cubic-bezier(.2,.8,.2,1) ${k * 0.03}s both"/>`;
      if (labels[k] !== '') s += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(labels[k])}</text>`;
      if (k === highlight && v > 0) s += `<text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle" style="fill:var(--text);font-weight:600">${fmt(v)}</text>`;
    });
    return s + '</svg>';
  },
  duo(a, b, labels, { h = 160 } = {}) {
    const W = 340, H = h, pb = 22, pt = 10, n = labels.length || 1, max = Math.max(1, ...a, ...b), gap = (W - 10) / n, bw = Math.min(14, gap * .3);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}">`;
    [.5, 1].forEach(f => { const y = H - pb - (H - pb - pt) * f; s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-dasharray="3 4"/>`; });
    labels.forEach((l, k) => {
      const cx = W - 5 - gap * k - gap / 2;
      [[a[k], '#10B981', cx + 1], [b[k], '#F43F5E', cx - bw - 1]].forEach(([v, c, x], j) => {
        const bh = Math.max(v > 0 ? 3 : 0, (H - pb - pt) * v / max);
        s += `<rect x="${x}" y="${H - pb - bh}" width="${bw}" height="${bh}" rx="4" fill="${c}" style="transform-origin:center bottom;transform-box:fill-box;animation:growY .9s cubic-bezier(.2,.8,.2,1) ${k * .05 + j * .1}s both"/>`;
      });
      s += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(l)}</text>`;
    });
    return s + '</svg>';
  },
  donut(items, { size = 140, stroke = 22, center = '' } = {}) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, total = items.reduce((s, x) => s + x.v, 0) || 1;
    let acc = 0, s = `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface2)" stroke-width="${stroke}"/>`;
    items.forEach((x, k) => {
      const len = c * x.v / total;
      s += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${x.color}" stroke-width="${stroke}" stroke-dasharray="${Math.max(0, len - 2)} ${c}" stroke-dashoffset="${-acc}" transform="rotate(-90 ${size / 2} ${size / 2})" style="opacity:0;animation:fadeIn .5s ease ${k * .08}s forwards"/>`;
      acc += len;
    });
    return s + `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" style="font-family:Plex;font-weight:700;font-size:15px;fill:var(--text)">${center}</text></svg>`;
  },
  ring(p, color = '#4F46E5', label = '') {
    const r = 26, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, p / 100));
    return `<div class="ring"><svg viewBox="0 0 62 62"><circle class="bgc" cx="31" cy="31" r="${r}"/><circle class="fg" cx="31" cy="31" r="${r}" stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${off}"/></svg><span>${label || N(p) + '٪'}</span></div>`;
  }
};
const st = document.createElement('style');
st.textContent = '@keyframes growY{from{transform:scaleY(0)}to{transform:scaleY(1)}}@keyframes fadeIn{to{opacity:1}}';
document.head.appendChild(st);

window.raseedFlush = () => { try { if (NATIVE && NATIVE.persist && Store.data) NATIVE.persist(JSON.stringify(Store.data)); } catch (e) { } };
window.raseedSaved = ok => toast(ok ? 'الملف اتحفظ' : 'الحفظ اتلغى', ok ? 'check' : 'info-circle');
function setBar(color, light) { if (NATIVE && NATIVE.setBar) try { NATIVE.setBar(color, !!light); } catch (e) { } }

function syncReminders() {
  if (!NATIVE || !NATIVE.syncReminders || !Store.data) return;
  try {
    const n = Store.data.settings.notif, items = [];
    Store.data.debts.forEach(d => d.installments.forEach(i => {
      if (Debt.instDone(i)) return;
      items.push({ name: d.name, dir: d.direction, due: i.due, amt: moneyT(i.amount - Debt.instPaid(i)) });
    }));
    (Store.data.cards || []).forEach(c => { if (c.type === 'credit' && c.dueDay && !c.archived) { const u = Card.used(c), due = Card.nextDue(c); if (u > 0 && due) items.push({ name: 'بطاقة ' + c.name, dir: 'owe', due, amt: moneyT(u) }); } });
    items.sort((a, b) => a.due < b.due ? -1 : 1);
    const lastTx = Store.data.tx.filter(t => t.type === 'expense').reduce((m, t) => t.date > m ? t.date : m, '');
    NATIVE.syncReminders(JSON.stringify({ inst: !!n.inst, before: n.before, hour: n.hour, min: 0, daily: !!n.daily, dailyHour: n.dailyHour, dailyMin: 0, digits: EN ? 'en' : Store.data.settings.digits, lang: LANG, lastTx, items: items.slice(0, 200) }));
  } catch (e) { }
}

function autoBackup(json, force) {
  if (!NATIVE || !NATIVE.autoBackup || !Store.data) return '';
  const d = Store.data; if (!d.tx.length && !d.debts.length) return '';
  let last = ''; try { last = localStorage.getItem('raseed_ab') || ''; } catch (e) { }
  const t = today(); if (!force && last === t) return '';
  try { const r = NATIVE.autoBackup(json || JSON.stringify(d), t); if (r) { try { localStorage.setItem('raseed_ab', t); } catch (e) { } } return r; } catch (e) { return ''; }
}
