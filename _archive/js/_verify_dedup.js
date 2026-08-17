const la = require('./训练管道/local_answer.js');
la.init();
const tests = ['螯合效应是什么', '量子产率怎么算', '晶体场理论要点', '作图规范有哪些', '乙醇安全注意事项'];
for (const q of tests) {
  const r = la.answer(q);
  console.log('Q:', q);
  console.log('  →', (r.matchedFAQ ? r.matchedFAQ.title : '无匹配').slice(0, 30), '| 文本', (r.answerText || '').length, '字');
}
// 训练题路由抽查（应命中各自的针对性条目）
const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const faq = parseFAQ(readHTML());
const allQs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_all_599.json', 'utf8'));
let hit = 0;
allQs.slice(0, 15).forEach(q => {
  const r = la.answer(q.question);
  const m = r.matchedFAQ ? r.matchedFAQ.title : null;
  if (m && faq.some(f => f.q === q.question && f.title === m)) hit++;
});
console.log('\n训练题抽样路由命中自身条目:', hit + '/15');
