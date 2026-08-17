const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const la = require('./训练管道/local_answer.js');
la.init();
const faq = parseFAQ(readHTML());
const newEntries = faq.slice(1055);
const newTitleSet = new Set(newEntries.map(f => f.title));
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
console.log('FAQ:', faq.length, '| 新增:', newEntries.length, '| 题目:', qs.length);
// 检查新增条目 q 是否=某题目原文
let qExact = 0;
const qTexts = new Set(qs.map(q => q.question));
newEntries.forEach(e => { if (qTexts.has(e.q)) qExact++; });
console.log('新增条目 q=题目原文:', qExact + '/' + newEntries.length);
// 抽查 5 题命中
let hitNew = 0;
qs.slice(0, 200).forEach(q => {
  const r = la.answer(q.question);
  const m = r.matchedFAQ ? r.matchedFAQ.title : null;
  if (m && newTitleSet.has(m)) hitNew++;
});
console.log('命中新增条目:', hitNew + '/' + qs.length);
// 检查 qMatch 逻辑是否存在于 local_answer
const src = fs.readFileSync('训练管道/local_answer.js', 'utf8');
console.log('local_answer 含 qMatch 加成:', src.includes('score+=50'));
