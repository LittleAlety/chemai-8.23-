'use strict';
const fs = require('fs'), path = require('path');
const la = require(path.join(process.cwd(), '训练管道/local_answer.js')); la.init();
const bank = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'Agent工作区/Agent-B-问题生成/self_train_q_proc200_final.json'), 'utf8'));
const byId = {}; bank.forEach(q => byId[q.id] = q);
['Q017', 'Q030', 'Q040', 'Q079', 'Q140'].forEach(id => {
  const q = byId[id];
  const r = la.answer(q.question);
  console.log('\n### ' + id + '  [match:' + ((r.matchedFAQ && r.matchedFAQ.title) || '无').slice(0, 30) + '] calc=' + (r.calc ? (r.calc.type + '=' + JSON.stringify(r.calc.result)) : '(未命中计算)'));
  console.log('  题: ' + q.question);
  console.log('  答前260: ' + String(r.answerText || '').slice(0, 260).replace(/\n/g, ' '));
  console.log('  ref: ' + (q.referenceAnswer || '').slice(0, 160));
});
