const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const la = require('./训练管道/local_answer.js');
la.init();
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const faq = parseFAQ(readHTML());
for (const id of ['Q135', 'Q140', 'Q162']) {
  const q = qs.find(x => x.id === id);
  const r = la.answer(q.question);
  const m = r.matchedFAQ ? r.matchedFAQ.title : null;
  const hasOwn = faq.some(f => f.q === q.question);
  const routedOwn = m && faq.some(f => f.q === q.question && f.title === m);
  console.log('===== ' + id + ' =====');
  console.log('题目:', q.question.slice(0, 55));
  console.log('有 q=本题 条目:', hasOwn, '| 路由到 own:', routedOwn);
  console.log('命中:', (m || 'null').slice(0, 30));
  console.log('回答前60字:', r.answerText.replace(/\n/g, ' ').slice(0, 60));
  console.log('');
}
