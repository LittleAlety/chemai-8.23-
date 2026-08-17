const fs = require('fs');
const { parseFAQ, readHTML, applyManifest } = require('./scripts/lib-assistant-faq.js');
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const q = qs.find(x => x.id === 'Q175');
const faq = parseFAQ(readHTML());
const idx = faq.findIndex(f => f.q === q.question);
console.log('Q175 题目:', q.question.slice(0, 50));
console.log('参考答案长度:', (q.referenceAnswer || '').length);
if (idx >= 0) {
  const html = applyManifest(readHTML(), [{ index: idx, new_answer: q.referenceAnswer, new_detail: '' }]);
  fs.writeFileSync('assistant.html', html, 'utf8');
  console.log('Q175 answer=参考答案, detail 已清空');
} else console.log('无条目');
