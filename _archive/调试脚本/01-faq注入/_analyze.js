'use strict';
const fs = require('fs'), path = require('path');
const la = require(path.join(process.cwd(), '训练管道/local_answer.js')); la.init();
const bank = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'Agent工作区/Agent-B-问题生成/self_train_q_proc200_final.json'), 'utf8'));
const scores = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'Agent工作区/Agent-报告/self_train_baseline_scores.json'), 'utf8'));
const sc = {}; scores.forEach(s => sc[s.id] = s.score);
// 对每题: 命中标题 + score
const rows = [];
bank.forEach(q => {
  const r = la.answer(q.question);
  const t = (r.matchedFAQ && r.matchedFAQ.title) || '(none)';
  rows.push({ id: q.id, title: t, score: sc[q.id] });
});
// 按标题分组，统计各标题下 <9.5 的题数（作为批3优先）
const g = {};
rows.forEach(x => { if (!g[x.title]) g[x.title] = { low: 0, total: 0, ids: [], lowIds: [] }; g[x.title].total++; if (x.score < 9.5) { g[x.title].low++; g[x.title].lowIds.push(x.id); } });
const sorted = Object.keys(g).map(t => ({ title: t, ...g[t] })).sort((a, b) => b.low - a.low);
console.log('=== 各命中条目下 <9.5 题数 (top 25, 批3目标) ===');
sorted.slice(0, 25).forEach(x => { if (x.low > 0) console.log('  ' + x.low + '/' + x.total + '  ' + x.title.slice(0, 44) + '  ' + x.lowIds.slice(0, 10).join(',')); });
const totalLow = rows.filter(x => x.score < 9.5).length;
console.log('\n剩余低分(<9.5)总题数=' + totalLow + '，avg=' + (rows.reduce((a, b) => a + b.score, 0) / rows.length).toFixed(2));
