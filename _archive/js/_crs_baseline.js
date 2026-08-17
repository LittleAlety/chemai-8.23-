// CrossRef 基线核验：严格匹配（Jaccard 标题相似 + 期刊吻合 + 年份容差），输出 top5 候选供复核
// 修复 _crs4.js 缺陷：inter/min 相似度、无期刊校验、无 SI/ChemInform 排除
const fs = require('fs');

const md = fs.readFileSync('CORPUS_SUPPLEMENT_100.md', 'utf8');
const rows = md.split('\n').filter(l => /^\|\s*\d{1,3}\s*\|/.test(l) && l.includes('*'));
const entries = rows.map(l => {
  const p = l.split('|').map(s => s.trim());
  return { num: parseInt(p[1]), title: p[2], journal: (p[3] || '').replace(/\*/g, '').trim(), year: p[4] || '' };
});

// ---- 规范化：上下标→普通字符 ----
const SUB = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+','ᴵ':'i' };
function norm(s) {
  let t = String(s || '');
  for (const k in SUB) t = t.split(k).join(SUB[k]);
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function stripAnno(s) { return String(s || '').replace(/\s*\([^)]*\)\s*$/, '').trim(); }
function words(s) { return new Set(norm(s).split(' ').filter(w => w.length > 2)); }
function jac(a, b) {
  const wa = words(a), wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let inter = 0; wa.forEach(w => { if (wb.has(w)) inter++; });
  return inter / (wa.size + wb.size - inter);
}
// 期刊显著 token 共享（如 "Chemical Education"、"Thermochimica"、"Physical Review"）
function jrnlAgree(a, b) {
  if (!a || !b) return false;
  const wa = words(a), wb = words(b);
  let n = 0; wa.forEach(w => { if (wb.has(w)) n++; });
  return n >= 1;
}
const isSI = d => /\.s\d{3,}|\.s\d+$|\/v\d/.test(d);
const BAD = /chem.?inform|abstract/i;
const skipType = t => !t || /book-chapter|book|dissertation|report|standard/i.test(t);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const out = [];
  for (const e of entries) {
    const top5 = [];
    try {
      const url = 'https://api.crossref.org/works?query.bibliographic=' + encodeURIComponent(stripAnno(e.title)) +
        '&rows=5&select=DOI,title,container-title,issued,type&mailto=chemai@example.com';
      const r = await fetch(url, { headers: { 'User-Agent': 'ChemAI/1.0 (mailto:chemai@example.com)' } });
      const j = await r.json();
      const items = (j.message && j.message.items) || [];
      for (const it of items) {
        if (!it.DOI || isSI(it.DOI) || BAD.test((it['container-title'] || []).join(' '))) continue;
        const t = (it.title && it.title[0]) || '';
        const jr = (it['container-title'] && it['container-title'][0]) || '';
        const y = String((it.issued && it.issued['date-parts'] && it.issued['date-parts'][0] && it.issued['date-parts'][0][0]) || '');
        top5.push({
          doi: it.DOI, title: t, journal: jr, year: y, type: it.type || '',
          titleJac: +jac(e.title, t).toFixed(2), jAgree: jrnlAgree(e.journal, jr),
          yDiff: y ? Math.abs(parseInt(y) - parseInt(e.year)) : 99
        });
      }
    } catch (err) { /* 网络错误忽略 */ }
    const real = top5.find(c => c.titleJac >= 0.75 && !skipType(c.type) && c.jAgree && c.yDiff <= 3);
    const near = top5.find(c => c.titleJac >= 0.75 && !skipType(c.type));
    out.push({ num: e.num, orig: e.title, oJ: e.journal, oY: e.year,
      status: real ? 'real' : (near ? 'near' : 'none'), top5: top5.slice(0, 5) });
    await sleep(300);
  }
  fs.writeFileSync('_crs_review.json', JSON.stringify(out, null, 1), 'utf8');
  const nReal = out.filter(o => o.status === 'real').length;
  const nNear = out.filter(o => o.status === 'near').length;
  const nNone = out.filter(o => o.status === 'none').length;
  console.log('real=' + nReal + ' near=' + nNear + ' none=' + nNone);
  console.log('\n=== real（高置信，可直接用）===');
  out.filter(o => o.status === 'real').forEach(o => {
    const c = o.top5[0];
    console.log('#' + o.num + ' → ' + c.title.slice(0, 55) + ' | ' + c.journal.slice(0, 22) + ' ' + c.year + ' | ' + c.doi);
  });
  console.log('\n=== near（标题高相似但期刊/年份存疑，需复核）===');
  out.filter(o => o.status === 'near').forEach(o => {
    const c = o.top5[0];
    console.log('#' + o.num + ' [jac ' + c.titleJac + ' jAgree ' + c.jAgree + ' yDiff ' + c.yDiff + '] ' + o.orig.slice(0, 40) + '\n    → ' + (c.title || '').slice(0, 50) + ' | ' + (c.journal || '').slice(0, 20) + ' ' + c.year + ' | ' + c.doi);
  });
})().catch(e => { console.error(e); process.exit(1); });
