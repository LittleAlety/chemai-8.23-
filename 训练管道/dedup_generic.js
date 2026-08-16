const fs = require('fs');
const path = require('path');
const { parseFAQ, readHTML, extractFAQArray } = require('../scripts/lib-assistant-faq.js');
const root = path.join(__dirname, '..');
const norm = s => String(s || '').toLowerCase().replace(/[^一-龥a-z0-9]/g, '');
// 不剥括号：化学式括号(Fe(OH)₃/Fe(SCN)₃)是语义, 剥了会误合并
const faq = parseFAQ(readHTML());
const gen = faq.filter(f => (f.q || '').length <= 30);
const genIdx = faq.map((f, i) => (f.q || '').length <= 30 ? i : -1).filter(i => i >= 0);

// 保守聚类: 去括号后标题归一相等 或 互为前缀(较短≥4字)
const groups = [];
const used = new Set();
for (let i = 0; i < gen.length; i++) {
  if (used.has(i)) continue;
  const g = [i]; used.add(i);
  const ti = norm(gen[i].title);
  for (let j = i + 1; j < gen.length; j++) {
    if (used.has(j)) continue;
    const tj = norm(gen[j].title);
    const eq = ti && tj && ti === tj;
    const pref = ti && tj && Math.min(ti.length, tj.length) >= 4 && (ti.startsWith(tj) || tj.startsWith(ti)) && Math.abs(ti.length - tj.length) <= 12;
    if (eq || pref) { g.push(j); used.add(j); }
  }
  if (g.length > 1) groups.push(g);
}
console.log('可安全合并组:', groups.length, '| 可移除:', groups.reduce((a, g) => a + g.length - 1, 0));
groups.forEach(g => { console.log('  [' + g.length + ']:', g.map(i => gen[i].title.slice(0, 20)).join(' || ')); });

// 合并: 保留答案最长者, 合并 keys/ents, 移除其余
const keepSet = new Set();
const merged = [];
groups.forEach(g => {
  let best = g[0];
  for (const i of g) if ((gen[i].answer || '').length > (gen[best].answer || '').length) best = i;
  keepSet.add(best);
  const keys = Array.from(new Set(g.flatMap(i => gen[i].keys || [])));
  const ents = Array.from(new Set(g.flatMap(i => gen[i].ents || [])));
  // 更新保留条目为合并版
  gen[best].keys = keys; gen[best].ents = ents;
  merged.push(gen[best]);
});
const removedCount = groups.reduce((a, g) => a + g.length - 1, 0);
if (removedCount === 0) { console.log('无可合并，退出'); process.exit(0); }
console.log('\n=== 合并计划（--dry 仅预览不写入）===');
groups.forEach(g => {
  const best = g.reduce((m, i) => (gen[i].answer || '').length > (gen[m].answer || '').length ? i : m, g[0]);
  console.log('保留: ' + gen[best].title.slice(0, 24) + ' (答案' + (gen[best].answer || '').length + '字)');
  g.filter(i => i !== best).forEach(i => console.log('  移除: ' + gen[i].title.slice(0, 30)));
});
if (process.argv.includes('--dry')) { console.log('\n（dry-run，未写入）'); process.exit(0); }

// 重建 FAQ: 所有条目，移除被合并的（非 keep 的组内成员）
const keepGroupIdx = new Set();
groups.forEach(g => g.forEach((gi, k) => { if (k === 0) keepGroupIdx.add(g[0]); }));
const keepGlob = new Set(groups.map(g => g[0]));
const newFaq = faq.filter((f, i) => {
  if (genIdx.includes(i)) {
    const gi = genIdx.indexOf(i);
    return !groups.some(g => g.includes(gi) && g[0] !== gi);   // 保留每个组的代表, 移除其他
  }
  return true;
});
function jsStr(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'"; }
const html = readHTML();
const { start, end } = extractFAQArray(html);
const block = newFaq.map(e =>
  '{keys:' + JSON.stringify(e.keys || []) + ',ents:' + JSON.stringify(e.ents || []) +
  ',title:' + jsStr(e.title) + ',q:' + jsStr(e.q || '') + ",knode:''" + ',subfield:' + jsStr(e.subfield) +
  ',answer:' + jsStr(e.answer) + ',detail:' + jsStr(e.detail || '') + '}').join(',\n ');
fs.writeFileSync(path.join(root, 'assistant.html'), html.slice(0, start) + '[' + block + ']' + html.slice(end + 1), 'utf8');
console.log('已合并:', groups.length, '组, 移除', removedCount, '条 | FAQ:', faq.length, '→', newFaq.length);
