const fs = require('fs');
const la = require('./训练管道/local_answer.js');
la.init();
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n20_final.json', 'utf8'));
console.log('FAQ:', la.faqCount, '| 重跑 20 题（注入后）');
let matched = 0, hasAnswer = 0;
qs.forEach(q => {
  const r = la.answer(q.question);
  const m = r.matchedFAQ ? r.matchedFAQ.title : null;
  const text = (r.answerText || '').trim();
  if (m) matched++;
  if (text && text.length > 30 && !text.startsWith('本地检索未命中')) hasAnswer++;
  console.log('[' + (m ? '命中' : '未中') + '] ' + q.question.slice(0, 42));
  if (m) console.log('      → ' + m.slice(0, 40) + ' | 文本' + text.length + '字 | ' + text.replace(/\n/g, ' ').slice(0, 70));
});
console.log('\n命中: ' + matched + '/20 | 有实质回答: ' + hasAnswer + '/20');
