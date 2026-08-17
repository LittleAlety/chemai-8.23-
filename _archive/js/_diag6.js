const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const la = require('./训练管道/local_answer.js');
la.init();
const faq = parseFAQ(readHTML());
const newTitleSet = new Set(faq.slice(1055).map(f => f.title));
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const s2 = JSON.parse(fs.readFileSync('Agent工作区/Agent-C-答案评分/self_train_scores_r2.json', 'utf8'));
const sc = {}; s2.forEach(x => sc[x.id] = x.score);
let matchedHigh = [], matchedLow = [], unmatch = [];
qs.forEach(q => {
  const r = la.answer(q.question);
  const m = r.matchedFAQ ? r.matchedFAQ.title : null;
  const score = sc[q.id];
  if (m && newTitleSet.has(m)) { if (score >= 9.5) matchedHigh.push(score); else matchedLow.push(score); }
  else unmatch.push(score);
});
const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '-';
console.log('命中新条目且≥9.5:', matchedHigh.length, '| 命中新条目但<9.5:', matchedLow.length, '| 未命中新条目:', unmatch.length);
console.log('平均分 → 命中且达标:', avg(matchedHigh), '| 命中但低:', avg(matchedLow), '| 未命中:', avg(unmatch));
// 命中新条目但低分的示例
const lowEx = qs.filter(q => { const r = la.answer(q.question); const m = r.matchedFAQ && r.matchedFAQ.title; return m && newTitleSet.has(m) && sc[q.id] < 9.5; });
console.log('\n命中新条目但<9.5 示例:');
lowEx.slice(0, 3).forEach(q => {
  const r = la.answer(q.question);
  console.log(' ', q.id, '分', sc[q.id], '| 命中:', (r.matchedFAQ || {}).title.slice(0, 30));
  console.log('   答案前80字:', r.answerText.replace(/\n/g, ' ').slice(0, 80));
});
