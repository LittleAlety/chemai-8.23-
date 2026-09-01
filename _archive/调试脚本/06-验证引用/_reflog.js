'use strict';
const fs = require('fs'), path = require('path');
const p = path.join(process.cwd(), 'Agent工作区/Agent-报告/self_train_baseline_scores.json');
const scores = JSON.parse(fs.readFileSync(p, 'utf8'));
const want = ['Q015', 'Q040', 'Q003', 'Q029', 'Q047', 'Q048', 'Q034', 'Q044', 'Q019'];
scores.filter(s => want.includes(s.id)).forEach(s => {
  console.log('\n### ' + s.id + ' score=' + s.score);
  console.log('  why: ' + (s.why || ''));
  console.log('  missing: ' + (s.missing || ''));
});
