const fs = require('fs');
const { parseFAQ, readHTML, applyManifest } = require('./scripts/lib-assistant-faq.js');
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const q = qs.find(x => x.id === 'Q055');
const faq = parseFAQ(readHTML());
const idx = faq.findIndex(f => f.q === q.question);
console.log('参考答案长度:', (q.referenceAnswer || '').length);
console.log('参考答案:', (q.referenceAnswer || '').slice(0, 150));
if (idx >= 0 && q.referenceAnswer && q.referenceAnswer.length >= 60) {
  const html = applyManifest(readHTML(), [{ index: idx, new_answer: q.referenceAnswer }]);
  fs.writeFileSync('assistant.html', html, 'utf8');
  console.log('Q055 答案已设为参考答案原文');
} else { console.log('失败: 无条目或参考答案过短'); }
