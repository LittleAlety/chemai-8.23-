'use strict';
// 验证 P2 多部分题聚合：Q012/Q016/Q015 的完整答案是否补上了 top-1 之外的子点。
const fs = require('fs');
const path = require('path');
const la = require(path.join(__dirname, '..', '..', '..', '训练管道/local_answer.js'));
la.init();
const bank = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'Agent工作区/Agent-B-问题生成/self_train_q_proc200_final.json'), 'utf8'));
const byId = {}; bank.forEach(q => byId[q.id] = q);
['Q012', 'Q016', 'Q015'].forEach(id => {
  const q = byId[id];
  const r = la.answer(q.question);
  console.log('\n===== ' + id + '  [' + (r.matchedFAQ && r.matchedFAQ.title) + '] =====');
  console.log(r.answerText);
});
