/* ---------- i18n: Arabic (source) / English ---------- */
const LANG = (() => {
  try {
    const l = localStorage.getItem('raseed_lang');
    if (l === 'ar' || l === 'en') return l;
    if (localStorage.getItem('raseed_v1')) return 'ar';
  } catch (e) { }
  const nl = (navigator.language || 'ar').toLowerCase();
  return nl.startsWith('ar') ? 'ar' : 'en';
})();
const EN = LANG === 'en';
document.documentElement.lang = LANG;
document.documentElement.dir = EN ? 'ltr' : 'rtl';

const TR = (() => {
  if (!EN) return s => s;
  const D = window.EN_DICT || {};
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keys = Object.keys(D).sort((a, b) => b.length - a.length);
  const L = '\\u0621-\\u065F\\u0670-\\u06D3';
  const re = new RegExp('(^|[^' + L + '])(' + keys.map(esc).join('|') + ')(?=[^' + L + ']|$)', 'g');
  const AR = /[؀-ۿ]/;
  const AD = /[٠-٩]/g;
  return s => {
    if (!s || !(AR.test(s) || s.indexOf('←') >= 0)) return s;
    let o = s.replace(/بـ(?=\S)/g, 'بـ '), p;
    do { p = o; o = o.replace(re, (m, a, k) => a + D[k]); } while (o !== p && AR.test(o));
    return o.replace(AD, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٬/g, ',').replace(/←/g, '→').replace(/٫/g, '.');
  };
})();

function trNode(root) {
  if (!EN || !root) return;
  if (root.nodeType === 3) { if (root.parentElement && root.parentElement.closest('.notr')) return; const v = TR(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
  if (root.nodeType !== 1) return;
  if (root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
  if (root.closest && root.closest('.notr')) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement && n.parentElement.closest('.notr') ? 2 : 1 });
  let n; while ((n = w.nextNode())) { const v = TR(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
  const els = root.querySelectorAll ? [root, ...root.querySelectorAll('[placeholder],[aria-label],[title],input[type=button],input[value]')] : [root];
  els.forEach(el => {
    if (!el.getAttribute) return;
    ['placeholder', 'aria-label', 'title'].forEach(a => { const v = el.getAttribute(a); if (v) { const t = TR(v); if (t !== v) el.setAttribute(a, t); } });
  });
}
if (EN) {
  const start = () => {
    document.title = 'Raseed';
    trNode(document.body);
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') trNode(m.target);
        else if (m.type === 'attributes') trNode(m.target);
        else m.addedNodes.forEach(trNode);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] });
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
}
const DIRX = EN ? 1 : -1; /* horizontal scroll direction for sliders */
function setLang(l) {
  try { localStorage.setItem('raseed_lang', l); } catch (e) { }
  try { if (window.Store && Store.data) { Store.data.settings.lang = l; Store.save(); } } catch (e) { }
  location.reload();
}
