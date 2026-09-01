'use strict';
const fs = require('fs'), path = require('path');
const la = require(path.join(process.cwd(), '训练管道/local_answer.js')); la.init();
const bank = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'Agent工作区/Agent-B-问题生成/self_train_q_proc200_final.json'), 'utf8'));
const groups = {};
bank.forEach(q => {
  const r = la.answer(q.question);
  const t = (r.matchedFAQ && r.matchedFAQ.title) || '(none)';
  if (!groups[t]) groups[t] = [];
  groups[t].push({ id: q.id, ref: q.referenceAnswer || '' });
});
const target = ['氧化温度过高的后果', '昼夜温差对三草酸合铁(III)酸钾结晶产率和粒径的影响及暗处理原因', '产率计算公式与基准', '第四步：溶剂替换法结晶的热力学原理', '配位反应中草酸过量导致颜色变浅及终点判断'];
target.forEach(t => {
  const g = groups[t]; if (!g) { console.log('\n(无)' + t); return; }
  console.log('\n\n########## ' + t + '  (' + g.length + '题) ##########');
  g.forEach(x => console.log('  [' + x.id + '] ' + x.ref.slice(0, 150)));
});
