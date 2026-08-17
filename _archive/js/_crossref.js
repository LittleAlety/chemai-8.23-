// 解析 CORPUS_SUPPLEMENT_100.md 的 100 条，逐条查 Crossref 拿真实 DOI
const fs = require('fs');
const md = fs.readFileSync('CORPUS_SUPPLEMENT_100.md', 'utf8');
const rows = md.split('\n').filter(l => /^\|\s*\d{1,3}\s*\|/.test(l) && l.includes('*'));
const entries = rows.map(l => {
  const parts = l.split('|').map(s => s.trim());
  return { num: parseInt(parts[1]), title: parts[2], journal: (parts[3] || '').replace(/\*/g, ''), year: parts[4] || '' };
});
console.log('解析条目: ' + entries.length);

function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9一-龥]+/g, ' ').trim(); }
function titleSim(a, b) {
  const wa = new Set(norm(a).split(' ').filter(w => w.length > 2));
  const wb = new Set(norm(b).split(' ').filter(w => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let inter = 0; wa.forEach(w => { if (wb.has(w)) inter++; });
  return inter / Math.min(wa.size, wb.size);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const out = [];
  for (const e of entries) {
    let best = { doi: '', title: '', journal: '', year: '', sim: 0 };
    try {
      const url = 'https://api.crossref.org/works?query.bibliographic=' + encodeURIComponent(e.title) +
        '&rows=2&select=DOI,title,container-title,issued&mailto=chemai@example.com';
      const r = await fetch(url, { headers: { 'User-Agent': 'ChemAI/1.0 (mailto:chemai@example.com)' } });
      const j = await r.json();
      const items = (j.message && j.message.items) || [];
      for (const it of items) {
        const itTitle = (it.title && it.title[0]) || '';
        const itJ = (it['container-title'] && it['container-title'][0]) || '';
        const itY = (it.issued && it.issued['date-parts'] && it.issued['date-parts'][0] && it.issued['date-parts'][0][0]) || '';
        const sim = titleSim(e.title, itTitle);
        if (sim > best.sim) best = { doi: it.DOI || '', title: itTitle, journal: itJ, year: String(itY), sim };
      }
    } catch (err) { /* skip */ }
    out.push({ num: e.num, orig: e.title, journal: e.journal, year: e.year, doi: best.doi, match: best.title, mJ: best.journal, mY: best.year, sim: Math.round(best.sim * 100) });
    await sleep(400);
  }
  fs.writeFileSync('_crossref_results.json', JSON.stringify(out, null, 1), 'utf8');
  // 摘要
  const found = out.filter(o => o.doi && o.sim >= 50).length;
  const weak = out.filter(o => o.doi && o.sim < 50).length;
  const none = out.filter(o => !o.doi).length;
  console.log('匹配到DOI且相似度≥50%: ' + found + ' | 相似度<50%: ' + weak + ' | 无DOI: ' + none);
  console.log('\n=== 相似度 < 50%（可能虚构或标题不符）===');
  out.filter(o => o.sim < 50).forEach(o => console.log('#' + o.num + ' [' + o.sim + '%] ' + o.orig.slice(0, 60) + ' → ' + (o.doi ? o.match.slice(0, 50) : '无') + (o.doi ? ' DOI:' + o.doi : '')));
})().catch(e => { console.error(e); process.exit(1); });
