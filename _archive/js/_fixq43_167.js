const fs = require('fs');
const { parseFAQ, readHTML, applyManifest } = require('./scripts/lib-assistant-faq.js');
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const faq = parseFAQ(readHTML());
const ids = ['Q043', 'Q167'];
for (const id of ids) {
  const q = qs.find(x => x.id === id);
  const idx = faq.findIndex(f => f.q === q.question);
  if (idx < 0) { console.log(id, '无条目'); continue; }
  const ref = q.referenceAnswer;
  if (ref && ref.length >= 60) {
    const html = applyManifest(readHTML(), [{ index: idx, new_answer: ref }]);
    fs.writeFileSync('assistant.html', html, 'utf8');
    console.log(id, '答案设为参考答案(', ref.length, '字)');
  } else { console.log(id, '参考答案过短'); }
}
console.log('DONE');
