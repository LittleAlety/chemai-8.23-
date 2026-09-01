'use strict';
// 验证 P1 错库守卫：Q036（烘干/产物）应命中铁实验条目而非"二草酸合铜"；Q015 也查一下。
const fs = require('fs');
const path = require('path');
const la = require(path.join(__dirname, '..', '..', '..', '训练管道/local_answer.js'));
la.init();
const bank = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'Agent工作区/Agent-B-问题生成/self_train_q_proc200_final.json'), 'utf8'));
const byId = {}; bank.forEach(q => byId[q.id] = q);
['Q036', 'Q015', 'Q008', 'Q013'].forEach(id => {
  const q = byId[id];
  const r = la.answer(q.question);
  const mf = r.matchedFAQ ? (r.matchedFAQ.title || '') : '(none)';
  const ans = String(r.answerText || '').slice(0, 80).replace(/\n/g, ' ');
  console.log('\n' + id + ': [' + (r.matchedFAQ && r.matchedFAQ.subfield) + '] ' + mf.slice(0, 38));
  console.log('   答: ' + ans);
});
