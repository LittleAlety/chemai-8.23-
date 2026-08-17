const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const la = require('./训练管道/local_answer.js');
la.init();
const faq = parseFAQ(readHTML());
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const ids = ['Q008', 'Q012', 'Q018', 'Q029', 'Q032', 'Q113', 'Q117'];
let hit = 0;
for (const id of ids) {
  const q = qs.find(x => x.id === id);
  const r = la.answer(q.question);
  const m = r.matchedFAQ ? r.matchedFAQ.title : null;
  const isTailored = m && faq.some(f => f.q === q.question && f.title === m);
  if (isTailored) hit++;
  console.log(id, (isTailored ? '✓命中针对性' : '✗未命中'), '|', (m || 'null').slice(0, 26));
}
console.log('\n命中 ' + hit + '/' + ids.length);
// 全 200 统计
let allHit = 0;
for (const q of qs) {
  const r = la.answer(q.question);
  const m = r.matchedFAQ ? r.matchedFAQ.title : null;
  if (m && faq.some(f => f.q === q.question && f.title === m)) allHit++;
}
console.log('全 200 命中针对性条目: ' + allHit + '/200');
