const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const faq = parseFAQ(readHTML());
const gen = faq.filter(f => (f.q || '').length <= 30);
const norm = s => String(s || '').toLowerCase().replace(/[^一-龥a-z0-9]/g, '');
const jac = (a, b) => { const sa = new Set(a), sb = new Set(b); let i = 0; sa.forEach(c => { if (sb.has(c)) i++; }); return i / (sa.size + sb.size - i || 1); };
// 近重复: 标题 jaccard 高 或 一个标题包含另一个
const groups = [];
const used = new Set();
for (let i = 0; i < gen.length; i++) {
  if (used.has(i)) continue;
  const g = [i]; used.add(i);
  const ti = norm(gen[i].title);
  for (let j = i + 1; j < gen.length; j++) {
    if (used.has(j)) continue;
    const tj = norm(gen[j].title);
    const sim = jac(ti, tj);
    const contain = (ti && tj && (ti.includes(tj) || tj.includes(ti)) && Math.min(ti.length, tj.length) >= 6);
    if (sim > 0.72 || contain) { g.push(j); used.add(j); }
  }
  if (g.length > 1) groups.push(g);
}
console.log('通用条目:', gen.length, '| 可合并组:', groups.length, '| 可移除条数:', groups.reduce((a, g) => a + g.length - 1, 0));
groups.slice(0, 20).forEach(g => {
  console.log(' 组[' + g.length + ']:', gen[g[0]].title.slice(0, 22), '||', gen[g[1]].title.slice(0, 22), (g[2] ? '|| ' + gen[g[2]].title.slice(0, 18) : ''));
});
fs.writeFileSync('Agent工作区/Agent-优化/dedup_groups.json', JSON.stringify(groups.map(g => g.map(i => ({ idx: i, title: gen[i].title, q: gen[i].q }))), null, 2), 'utf8');
