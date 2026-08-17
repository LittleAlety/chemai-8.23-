const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const la = require('./训练管道/local_answer.js');
la.init();
const faq = parseFAQ(readHTML());
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const scores = JSON.parse(fs.readFileSync('Agent工作区/Agent-报告/self_train_final_scores.json', 'utf8'));
const byId = {}; scores.forEach(s => byId[s.id] = s.score);
const failing = qs.filter(q => byId[q.id] < 9.5).slice(0, 5);
for (const q of failing) {
  const r = la.answer(q.question);
  const m = r.matchedFAQ ? r.matchedFAQ.title : null;
  const hasTailored = faq.some(f => f.q === q.question);
  const matchedIsTailored = m && faq.some(f => f.q === q.question && f.title === m);
  console.log('===== ' + q.id + ' 分' + byId[q.id] + ' =====');
  console.log('题目:', q.question.slice(0, 60));
  console.log('是否存在 q=本题 条目:', hasTailored);
  console.log('命中:', m);
  console.log('命中是否=针对性条目:', matchedIsTailored);
  console.log('回答前90字:', r.answerText.replace(/\n/g, ' ').slice(0, 90));
  if (hasTailored) {
    const t = faq.find(f => f.q === q.question);
    console.log('针对性条目 answer 前60字:', t.answer.slice(0, 60));
    console.log('是否回答=参考答案:', r.answerText.replace(/\n/g, '').includes(t.answer.slice(0, 30)));
  }
  console.log('');
}
