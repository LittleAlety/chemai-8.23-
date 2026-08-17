const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const la = require('./训练管道/local_answer.js');
la.init();
const faq = parseFAQ(readHTML());
const newTitles = new Set(faq.slice(1055).map(f => f.title));
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n20_final.json', 'utf8'));
let hitNew = 0, matched = 0;
qs.forEach(q => {
  const r = la.answer(q.question);
  const m = r.matchedFAQ ? r.matchedFAQ.title : null;
  if (m) matched++;
  const isNew = m && newTitles.has(m);
  if (isNew) hitNew++;
  console.log(q.id, (isNew ? '✓新条目' : (m ? '·' : '✗未命中')), '|', (m || 'null').slice(0, 30));
});
console.log('\n命中新条目: ' + hitNew + '/' + qs.length + ' | 总命中: ' + matched + '/' + qs.length + ' | FAQ=' + faq.length);
