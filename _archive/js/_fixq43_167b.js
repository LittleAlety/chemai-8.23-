const fs = require('fs');
const { parseFAQ, readHTML, applyManifest } = require('./scripts/lib-assistant-faq.js');
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const ids = ['Q043', 'Q167'];
for (const id of ids) {
  const q = qs.find(x => x.id === id);
  let faq = parseFAQ(readHTML());
  const idx = faq.findIndex(f => f.q === q.question);
  if (idx < 0) { console.log(id, '无条目'); continue; }
  const html = applyManifest(readHTML(), [{ index: idx, new_answer: q.referenceAnswer, new_detail: '' }]);
  fs.writeFileSync('assistant.html', html, 'utf8');
  console.log(id, 'answer=参考答案, detail 已清空');
}
console.log('DONE');
