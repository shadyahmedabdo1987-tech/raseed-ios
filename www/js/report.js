'use strict';
/* ====== رصيد — PDF report ====== */
function reportHTML(period) {
  const R = reportData(period), s = S(), cur = esc(s.currency);
  const M = v => `${N(r3(v))}`;
  const donut = R.byCat.slice(0, 7);
  const owe = D().debts.filter(d => !Debt.done(d));
  const tx = [...R.list].sort((a, b) => a.date.localeCompare(b.date));
  const kind = { good: ['#059669', '#ECFDF5', 'نقطة قوة'], bad: ['#DC2626', '#FEF2F2', 'محتاج تنتبه'], ok: ['#D97706', '#FFFBEB', 'تحسين'], info: ['#4338CA', '#EEF2FF', 'ملاحظة'] };
  const logo = `<img src="${LOGO_URL}" width="58" height="58" style="flex:none">`;
  const css = `@font-face{font-family:Plex;src:url(${FONT_URL('Regular')});font-weight:400}@font-face{font-family:Plex;src:url(${FONT_URL('SemiBold')});font-weight:600}@font-face{font-family:Plex;src:url(${FONT_URL('Bold')});font-weight:700}
  @page{size:A4;margin:14mm 12mm}*{box-sizing:border-box}body{font-family:Plex,sans-serif;color:#0F172A;margin:0;font-size:11.5px;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .hd{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:16px;background:linear-gradient(135deg,#1E1B4B,#4338CA 55%,#06B6D4);color:#fff;margin-bottom:14px}
  .hd h1{margin:0;font-size:22px}.hd p{margin:0;opacity:.85}.hd .r{margin-inline-start:auto;text-align:end;font-size:11px;opacity:.9}
  .kp{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.kp div{border:1px solid #E2E8F0;border-radius:12px;padding:10px 12px}.kp small{color:#64748B;display:block}.kp b{font-size:17px}
  h2{font-size:14px;margin:16px 0 8px;padding-inline-start:10px;border-inline-start:4px solid #4F46E5}
  table{width:100%;border-collapse:collapse}th{background:#F1F5F9;color:#334155;font-weight:600;text-align:start;padding:7px 8px;font-size:11px}td{padding:6px 8px;border-bottom:1px solid #EEF2F7}tr{page-break-inside:avoid}
  .g{color:#059669}.rd{color:#DC2626}.mu{color:#64748B}.bar{height:7px;border-radius:7px;background:#EEF2F7;overflow:hidden;min-width:80px}.bar i{display:block;height:100%;border-radius:7px}
  .row{display:flex;gap:14px;align-items:center}.ins{border-radius:10px;padding:8px 12px;margin-bottom:6px;page-break-inside:avoid}.ins b{display:block}
  .tag{display:inline-block;font-size:10px;padding:1px 8px;border-radius:10px;margin-inline-start:6px}.ft{margin-top:18px;text-align:center;color:#94A3B8;font-size:10px;border-top:1px solid #E2E8F0;padding-top:8px}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.chart{width:100%}.chart text{font-family:Plex;font-size:9px;fill:#64748B}`;
  const kpi = `<div class="kp"><div><small>الإيداعات</small><b class="g">${M(R.s.inc)}</b> <small style="display:inline">${cur}</small></div><div><small>المصروفات</small><b class="rd">${M(R.s.exp)}</b> <small style="display:inline">${cur}</small></div><div><small>الصافي</small><b class="${R.s.net >= 0 ? 'g' : 'rd'}">${R.s.net < 0 ? '−' : ''}${M(Math.abs(R.s.net))}</b></div><div><small>نسبة الادخار / الرصيد الحالي</small><b>${N(R.save)}٪</b> <small style="display:inline">· ${M(Calc.balance())}</small></div></div>`;
  const catTable = `<table><tr><th>البند</th><th>المبلغ</th><th>النسبة</th><th style="width:30%"></th></tr>${R.byCat.map(x => `<tr><td><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${x.cat.color};margin-inline-end:6px"></span>${esc(x.cat.name)}</td><td>${M(x.v)}</td><td>${N(pct(x.v, R.s.exp))}٪</td><td><div class="bar"><i style="width:${pct(x.v, R.byCat[0].v)}%;background:${x.cat.color}"></i></div></td></tr>`).join('') || '<tr><td colspan="4" class="mu">مفيش مصروفات</td></tr>'}</table>`;
  const incTable = R.byInc.length ? `<table><tr><th>مصدر الدخل</th><th>المبلغ</th><th>النسبة</th></tr>${R.byInc.map(x => `<tr><td>${esc(x.cat.name)}</td><td class="g">${M(x.v)}</td><td>${N(pct(x.v, R.s.inc))}٪</td></tr>`).join('')}</table>` : '<p class="mu">مفيش دخل في الفترة دي</p>';
  const items = R.items.length ? `<table><tr><th>#</th><th>الحاجة</th><th>عدد المرات</th><th>الإجمالي</th></tr>${R.items.map((x, k) => `<tr><td>${N(k + 1)}</td><td>${esc(x.name)}</td><td>${N(x.count)}</td><td>${M(x.total)}</td></tr>`).join('')}</table>` : '<p class="mu">مفيش أوصاف كفاية للمصروفات</p>';
  const ins = R.ins.map(([k, , t, p]) => `<div class="ins" style="background:${kind[k][1]}"><b style="color:${kind[k][0]}">${esc(t)}<span class="tag" style="background:#fff;color:${kind[k][0]}">${kind[k][2]}</span></b>${esc(p)}</div>`).join('');
  const bud = R.bud.length ? `<h2>الميزانيات ومعدل الاستهلاك</h2><table><tr><th>البند</th><th>الميزانية</th><th>المصروف</th><th>المتبقي</th><th>التوقع</th></tr>${R.bud.map(b => `<tr><td>${esc(b.c.name)}</td><td>${M(b.c.budget)}</td><td>${M(b.spent)} (${N(b.p)}٪)</td><td class="${b.left < 0 ? 'rd' : ''}">${b.left < 0 ? '−' : ''}${M(Math.abs(b.left))}</td><td>${b.left <= 0 ? '<span class="rd">خلص</span>' : b.willFinishEarly ? `<span class="rd">هيخلص خلال ${N(b.runsOut)} يوم</span>` : '<span class="g">هيكفّي الشهر</span>'}</td></tr>`).join('')}</table>` : '';
  const debts = owe.length ? `<h2>المديونيات الحالية</h2><table><tr><th>الجهة</th><th>النوع</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>القسط الجاي</th><th>متأخر</th></tr>${owe.map(d => { const nx = Debt.next(d), l = Debt.overdue(d).length; return `<tr><td>${esc(d.name)}</td><td>${d.direction === 'owe' ? 'عليّا' : 'ليّا'}</td><td>${M(Debt.total(d))}</td><td class="g">${M(Debt.paid(d))}</td><td class="${d.direction === 'owe' ? 'rd' : 'g'}">${M(Debt.remaining(d))}</td><td>${nx ? `${M(nx.amount - Debt.instPaid(nx))} · ${shortDate(nx.due)}` : Debt.flex(d) ? 'مفتوحة — بدون مواعيد' : '—'}</td><td class="${l ? 'rd' : ''}">${l ? N(l) + ' قسط' : '—'}</td></tr>`; }).join('')}</table>` : '';
  const txt = tx.length ? `<h2>كشف الحركات (${N(tx.length)})</h2><table><tr><th>التاريخ</th><th>البيان</th><th>البند</th><th>داخل</th><th>خارج</th></tr>${tx.map(t => `<tr><td>${shortDate(t.date)}</td><td>${esc(t.note || '—')}${t.src && t.src !== 'cash' && Card.get(t.src) ? ' <span class="mu">(' + esc(Card.get(t.src).name) + ')</span>' : ''}</td><td>${esc(cat(t.catId).name)}</td><td class="g">${t.type === 'income' ? M(t.amount) : ''}</td><td class="rd">${t.type === 'expense' ? M(t.amount) : ''}</td></tr>`).join('')}<tr style="font-weight:700;background:#F8FAFC"><td colspan="3">الإجمالي</td><td class="g">${M(R.s.inc)}</td><td class="rd">${M(R.s.exp)}</td></tr></table>` : '';
  const now = new Date();
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير رصيد - ${esc(R.r.label)}</title><style>${css}</style></head><body>
  <div class="hd">${logo}<div><h1>تقرير رصيد المالي</h1><p>${esc(R.r.label)} · من ${shortDate(R.r.from)} إلى ${shortDate(R.r.to)}</p></div><div class="r">${esc(s.name || '')}<br>اتعمل ${shortDate(today())} ${N(pad(now.getHours()), true)}:${N(pad(now.getMinutes()), true)}</div></div>
  ${kpi}
  <div class="two"><div><h2>المصروف ${R.days <= 31 ? 'اليومي' : 'الشهري'}</h2>${Chart.bars(R.series, R.labels, { h: 150, highlight: R.hi }).replace(/animation:[^;"]+;?/g, '')}</div>
  <div><h2>توزيع المصروفات</h2><div class="row"><div style="width:130px">${Chart.donut(donut.map(x => ({ v: x.v, color: x.cat.color })), { size: 130, stroke: 22, center: '' }).replace(/opacity:0;animation:[^"]+/g, '')}</div><div style="flex:1">${donut.map(x => `<div><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${x.cat.color};margin-inline-end:5px"></span>${esc(x.cat.name)} <b>${N(pct(x.v, R.s.exp))}٪</b></div>`).join('')}</div></div></div></div>
  <h2>التحليل: نقاط القوة والضعف</h2>${ins || '<p class="mu">سجّل حركات أكتر عشان التحليل يبقى أدق</p>'}
  <div class="two"><div><h2>المصروفات حسب البند</h2>${catTable}</div><div><h2>مصادر الدخل</h2>${incTable}<h2>أكتر حاجات بتشتريها</h2>${items}</div></div>
  ${bud}${D().cards.length && R.srcList.length ? `<h2>المصروفات حسب طريقة الدفع</h2><table><tr><th>طريقة الدفع</th><th>النوع</th><th>عدد العمليات</th><th>المبلغ</th><th>النسبة</th></tr>${R.srcList.map(x => `<tr><td>${esc(x.name)}</td><td>${x.type === 'credit' ? 'كريدت' : x.type === 'debit' ? 'ديبت' : 'كاش'}</td><td>${N(x.n)}</td><td>${M(x.v)}</td><td>${N(pct(x.v, R.s.exp))}٪</td></tr>`).join('')}</table>` : ''}${Card.all().some(c => c.type === 'credit') ? `<h2>البطاقات الائتمانية</h2><table><tr><th>البطاقة</th><th>الحد</th><th>المديونية</th><th>المتاح</th><th>ميعاد السداد</th></tr>${Card.all().filter(c => c.type === 'credit').map(c => `<tr><td>${esc(Card.label(c))}</td><td>${M(c.limit)}</td><td class="rd">${M(Math.max(0, Card.used(c)))}</td><td class="g">${M(Card.available(c))}</td><td>${Card.nextDue(c) ? shortDate(Card.nextDue(c)) : '—'}</td></tr>`).join('')}</table>` : ''}${debts}
  <h2>آخر ٦ شهور</h2><table><tr><th>الشهر</th><th>الدخل</th><th>المصروف</th><th>الصافي</th></tr>${R.six.map((mk, k) => `<tr><td>${monthName(mk)}</td><td class="g">${M(R.sixS[k].inc)}</td><td class="rd">${M(R.sixS[k].exp)}</td><td class="${R.sixS[k].net >= 0 ? 'g' : 'rd'}">${R.sixS[k].net < 0 ? '−' : ''}${M(Math.abs(R.sixS[k].net))}</td></tr>`).join('')}</table>
  ${txt}
  <div class="ft">رصيد — تطبيق إدارة المصروفات والمديونيات · Powered by Shady Ahmed</div></body></html>`;
}
const PAGINATE = `<style>body{width:794px;margin:0;padding:36px 34px 30px}.hd{margin-top:0}</style><script>
window.paginate=function(){var PH=1123,M=34;var atoms=[].slice.call(document.querySelectorAll('.hd,.kp,h2,.ins,tr,svg.chart,.row,.ft,p'));
for(var k=0;k<atoms.length;k++){var el=atoms[k],r=el.getBoundingClientRect(),top=r.top+window.scrollY,bot=r.bottom+window.scrollY;if(r.height<=0||r.height>PH-2*M)continue;
var pg=Math.floor(top/PH),end=(pg+1)*PH-M,keep=el.tagName==='H2'?90:(el.tagName==='TR'&&el.querySelector('th')?60:0);
if(top<pg*PH+M&&pg>0){var g0=pg*PH+M-top;push(el,g0);continue;}
if(bot+keep>end){push(el,(pg+1)*PH+M-top);}}
function push(el,gap){if(el.tagName==='TR'){var t=document.createElement('tr');var td=document.createElement('td');td.colSpan=20;td.style.cssText='height:'+gap+'px;padding:0;border:0;background:#fff';t.appendChild(td);el.parentNode.insertBefore(t,el);var tb=el.closest('table'),hr=tb&&tb.querySelector('tr');if(hr&&hr!==el&&hr.querySelector('th')&&!el.querySelector('th')){el.parentNode.insertBefore(hr.cloneNode(true),el);}}
else{var cs=getComputedStyle(el);el.style.marginTop=(parseFloat(cs.marginTop)||0)+gap+'px';}}
return Math.max(1,Math.ceil((document.documentElement.scrollHeight-4)/PH));};<\/script>`;
function exportPDF(period) {
  period = period || App.range.p || 'month'; App.range.p = period;
  const label = periodRange(period).label;
  openSheet(`<h3>تقرير ${esc(label)}</h3>
    <div class="pdf-opts">
      <button class="pdf-opt" id="pSave"><span class="ic" style="background:#E11D481f;color:#E11D48">${I('file-type-pdf')}</span><b>حفظ كملف PDF</b><small>يتحفظ على موبايلك وتقدر تبعته لأي حد</small></button>
      <button class="pdf-opt" id="pPrint"><span class="ic" style="background:#4F46E51f;color:#4F46E5">${I('printer')}</span><b>طباعة</b><small>اطبع على أي طابعة متوصلة</small></button>
    </div>
    <div class="field" style="margin-top:12px">${rangePicker('pdfRange', () => { closeSheet(true); exportPDF(App.range.p); }, { label: 'فترة التقرير' })}</div>`, sh => {
    $('#pSave', sh).onclick = () => { closeSheet(); savePDF(period); };
    $('#pPrint', sh).onclick = () => { closeSheet(); printReport(period); };
  });
}
function reportName(period) { const x = periodRange(period); return `تقرير-رصيد-${(x.custom ? x.from + '-الى-' + x.to : x.label).replace(/[←\s/]+/g, '-')}.pdf`; }
function savePDF(period) {
  if (NATIVE && NATIVE.makePdf) {
    App.pdfPeriod = period; busy(true, 'بجهّز ملف الـ PDF…');
    NATIVE.makePdf(IOS ? reportHTML(period) : reportHTML(period).replace('</head>', PAGINATE + '</head>'), reportName(period));
    return;
  }
  printReport(period, true);
}
function printReport(period, asPdf) {
  const html = reportHTML(period), title = reportName(period).replace('.pdf', '');
  if (NATIVE && NATIVE.print) { NATIVE.print(html, title); toast('بفتح شاشة الطباعة…', 'printer'); return; }
  if (asPdf) toast('اختار «حفظ كـ PDF» من شاشة الطباعة', 'file-type-pdf');
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px';
  document.body.appendChild(f);
  const base = location.href.replace(/[^/]*$/, '');
  f.srcdoc = html.replace('<head>', `<head><base href="${base}">`);
  f.onload = () => setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 3000); }, 500);
}
function busy(on, msg) {
  let b = $('#busy');
  if (!b) { b = document.createElement('div'); b.id = 'busy'; b.innerHTML = '<div class="busy-card"><div class="spinner"></div><b></b></div>'; document.body.appendChild(b); }
  $('b', b).textContent = msg || ''; b.classList.toggle('show', on);
  clearTimeout(b._t); if (on) b._t = setTimeout(() => b.classList.remove('show'), 25000);
}
window.raseedPdfReady = n => { busy(false); toast(`الملف جاهز (${N(n)} صفحة) — اختار مكان الحفظ`, 'file-type-pdf'); };
window.raseedPdfFailed = () => { busy(false); toast('هفتحلك شاشة الطباعة — اختار منها «حفظ كـ PDF»', 'info-circle'); printReport(App.pdfPeriod || 'month'); };
window.raseedSaved = (ok, kind) => {
  busy(false);
  if (!ok) return toast('الحفظ اتلغى', 'info-circle');
  if (kind !== 'pdf') return toast('الملف اتحفظ', 'check');
  openSheet(`<div class="done-anim">${I('check')}</div><h3 style="justify-content:center">التقرير اتحفظ</h3><p class="muted" style="text-align:center;margin:-6px 0 16px">تقدر تفتحه أو تبعته لأي حد</p>
    <div class="btns"><button class="btn" id="oo">${I('eye')} افتح</button><button class="btn ghost" id="ss">${I('share')} شارك</button></div>`, sh => {
    $('#oo', sh).onclick = () => { closeSheet(); NATIVE && NATIVE.openLast && NATIVE.openLast(); };
    $('#ss', sh).onclick = () => { closeSheet(); NATIVE && NATIVE.shareLast && NATIVE.shareLast(); };
  });
};

if (EN) {
  const _rh = reportHTML, _rn = reportName;
  reportHTML = p => TR(_rh(p)).replace('lang="ar" dir="rtl"', 'lang="en" dir="ltr"');
  reportName = p => TR(_rn(p)).replace(/[^\w.\-]+/g, '-');
}
