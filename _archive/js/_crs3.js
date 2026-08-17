// 精细化核验：剔除 SI 补充材料，要求标题+期刊+年份对齐
const fs = require('fs');
const md = fs.readFileSync('CORPUS_SUPPLEMENT_100.md', 'utf8');
const rows = md.split('\n').filter(l => /^\|\s*\d{1,3}\s*\|/.test(l) && l.includes('*'));
const entries = rows.map(l => {
  const parts = l.split('|').map(s => s.trim());
  return { num: parseInt(parts[1]), title: parts[2], journal: (parts[3] || '').replace(/\*/g, ''), year: parts[4] || '' };
});
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9一-龥]+/g, ' ').trim(); }
function titleSim(a, b) {
  const wa = new Set(norm(a).split(' ').filter(w => w.length > 2));
  const wb = new Set(norm(b).split(' ').filter(w => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let inter = 0; wa.forEach(w => { if (wb.has(w)) inter++; });
  return inter / Math.min(wa.size, wb.size);
}
function jSim(j1, j2) {
  const a = norm(j1).slice(0, 25), b = norm(j2).slice(0, 25);
  if (!a || !b) return true; // 期刊缺失则放宽
  return a.includes(b) || b.includes(a) || a.split(' ').filter(w => w.length > 3).some(w => b.includes(w));
}
function isSI(doi) { return /\.s\d{3,}|\.s\d+$|\/v\d/.test(doi); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
(async () => {
  const out = [];
  for (const e of entries) {
    let best = { doi: '', title: '', journal: '', year: '', sim: 0, real: false };
    try {
      const url = 'https://api.crossref.org/works?query.bibliographic=' + encodeURIComponent(e.title) +
        '&rows=6&select=DOI,title,container-title,issued&mailto=chemai@example.com';
      const r = await fetch(url, { headers: { 'User-Agent': 'ChemAI/1.0 (mailto:chemai@example.com)' } });
      const j = await r.json();
      const items = (j.message && j.message.items) || [];
      for (const it of items) {
        if (isSI(it.DOI)) continue; // 跳过补充材料
        const itTitle = (it.title && it.title[0]) || '';
        const itJ = (it['container-title'] && it['container-title'][0]) || '';
        const itY = (it.issued && it.issued['date-parts'] && it.issued['date-parts'][0] && it.issued['date-parts'][0][0]) || '';
        const sim = titleSim(e.title, itTitle);
        const jok = jSim(e.journal, itJ);
        const yok = Math.abs((parseInt(e.year) || 0) - (parseInt(itY) || 0)) <= 5;
        // 判真：标题相似≥50 且（期刊对齐 或 年份对齐）
        const real = sim >= 50 && (jok || yok) && sim > best.sim;
        if (sim > best.sim || (real && sim >= best.sim)) {
          if (real || !best.real) best = { doi: it.DOI || '', title: itTitle, journal: itJ, year: String(itY), sim: Math.round(sim), real };
        }
      }
    } catch (err) { /* skip */ }
    out.push({ num: e.num, orig: e.title, oJ: e.journal, oY: e.year, doi: best.doi, mT: best.title, mJ: best.journal, mY: best.year, sim: best.sim, real: best.real });
    await sleep(350);
  }
  fs.writeFileSync('_crs_final.json', JSON.stringify(out, null, 1), 'utf8');
  const realN = out.filter(o => o.real && o.doi).length;
  const weakN = out.filter(o => !o.real || !o.doi).length;
  console.log('核验为真实论文: ' + realN + ' | 未能核验/可能虚构: ' + weakN);
  console.log('\n=== 未能核验（可能 AI 虚构）===');
  out.filter(o => !o.real || !o.doi).forEach(o => console.log('#' + o.num + ' ' + o.orig.slice(0, 55) + (o.doi ? ' [近匹配但期刊/年份不符: ' + o.mJ.slice(0, 25) + ' ' + o.mY + ' DOI:' + o.doi + ']' : '')));
})().catch(e => { console.error(e); process.exit(1); });
