// 最终核验：取非SI最佳标题匹配，输出真实DOI+修正期刊年份+置信度
const fs = require('fs');
const md = fs.readFileSync('CORPUS_SUPPLEMENT_100.md', 'utf8');
const rows = md.split('\n').filter(l => /^\|\s*\d{1,3}\s*\|/.test(l) && l.includes('*'));
const entries = rows.map(l => {
  const p = l.split('|').map(s => s.trim());
  return { num: parseInt(p[1]), title: p[2], journal: (p[3] || '').replace(/\*/g, ''), year: p[4] || '' };
});
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9一-龥]+/g, ' ').trim(); }
function titleSim(a, b) {
  const wa = new Set(norm(a).split(' ').filter(w => w.length > 2));
  const wb = new Set(norm(b).split(' ').filter(w => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let inter = 0; wa.forEach(w => { if (wb.has(w)) inter++; });
  return inter / Math.min(wa.size, wb.size);
}
const isSI = d => /\.s\d{3,}|\.s\d+$|\/v\d/.test(d);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const out = [];
  for (const e of entries) {
    let best = { doi: '', title: '', journal: '', year: '', sim: 0 };
    try {
      const url = 'https://api.crossref.org/works?query.bibliographic=' + encodeURIComponent(e.title) +
        '&rows=10&select=DOI,title,container-title,issued&mailto=chemai@example.com';
      const r = await fetch(url, { headers: { 'User-Agent': 'ChemAI/1.0 (mailto:chemai@example.com)' } });
      const j = await r.json();
      const items = (j.message && j.message.items) || [];
      for (const it of items) {
        if (isSI(it.DOI)) continue;
        const t = (it.title && it.title[0]) || '';
        const sim = titleSim(e.title, t);
        if (sim > best.sim) best = { doi: it.DOI || '', title: t, journal: (it['container-title'] && it['container-title'][0]) || '', year: String((it.issued && it.issued['date-parts'] && it.issued['date-parts'][0] && it.issued['date-parts'][0][0]) || ''), sim };
      }
    } catch (e) { /* skip */ }
    const status = best.sim >= 60 ? '✓真实' : (best.sim >= 45 ? '⚠疑似' : '✗未找到');
    out.push({ num: e.num, orig: e.title, oJ: e.journal, oY: e.year, status, sim: Math.round(best.sim), doi: best.doi, real: best.title, rJ: best.journal, rY: best.year });
    await sleep(320);
  }
  fs.writeFileSync('_crs_verified.json', JSON.stringify(out, null, 1), 'utf8');
  const real = out.filter(o => o.status === '✓真实').length, sus = out.filter(o => o.status === '⚠疑似').length, none = out.filter(o => o.status === '✗未找到').length;
  console.log('✓真实: ' + real + ' | ⚠疑似: ' + sus + ' | ✗未找到: ' + none);
  console.log('\n=== 疑似/未找到（需人工或替换）===');
  out.filter(o => o.status !== '✓真实').forEach(o => console.log('#' + o.num + ' [' + o.sim + '%] ' + o.orig.slice(0, 50) + ' → ' + (o.doi ? o.real.slice(0, 45) + ' | ' + o.rJ.slice(0, 25) + ' ' + o.rY + ' | ' + o.doi : '无')));
})().catch(e => { console.error(e); process.exit(1); });
