'use strict';
const fs = require('fs'), path = require('path');
const la = require(path.join(process.cwd(), '训练管道/local_answer.js')); la.init();
const bank = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'Agent工作区/Agent-B-问题生成/self_train_q_proc200_final.json'), 'utf8'));
const scores = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'Agent工作区/Agent-报告/self_train_baseline_scores.json'), 'utf8'));
const sc = {}; scores.forEach(s => sc[s.id] = s.score);
const groups = {};
bank.forEach(q => {
  const r = la.answer(q.question);
  const t = (r.matchedFAQ && r.matchedFAQ.title) || '(none)';
  if (!groups[t]) groups[t] = [];
  groups[t].push({ id: q.id, ref: q.referenceAnswer || '', score: sc[q.id] });
});
const target = [
  '洗涤FeC₂O₄·2H₂O时冷热水选择对后续氧化和产率的影响',
  'H₂O₂过量12mL对配位反应及产物纯度的影响分析',
  '产率过低原因',
  '三草酸合铁酸钾结晶中棉线作为晶核的优势',
  '烘干温度时间',
  '产率计算方法（含公式推导）',
  '摩尔盐溶解时加入稀硫酸抑制Fe²⁺水解与氧化',
  '倾滗法技巧',
];
target.forEach(t => {
  const g = groups[t]; if (!g) { console.log('\n(无)' + t); return; }
  console.log('\n########## ' + t + '  (' + g.length + '题, 低分' + g.filter(x => x.score < 9.5).length + ') ##########');
  g.forEach(x => console.log('  [' + x.id + ' s=' + x.score + '] ' + x.ref.slice(0, 170)));
});
