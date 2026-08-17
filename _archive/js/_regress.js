const fs = require('fs');
const r1 = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_replies_r1.json', 'utf8'));
const r2 = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_replies_r2.json', 'utf8'));
const s1 = JSON.parse(fs.readFileSync('Agent工作区/Agent-C-答案评分/self_train_scores_r1.json', 'utf8'));
const s2 = JSON.parse(fs.readFileSync('Agent工作区/Agent-C-答案评分/self_train_scores_r2.json', 'utf8'));
const byId1 = {}; r1.forEach(x => byId1[x.id] = x);
const byId2 = {}; r2.forEach(x => byId2[x.id] = x);
const sc1 = {}; s1.forEach(x => sc1[x.id] = x.score);
const sc2 = {}; s2.forEach(x => sc2[x.id] = x.score);
// 新增条目
const faq = require('./scripts/lib-assistant-faq.js').parseFAQ(require('./scripts/lib-assistant-faq.js').readHTML());
const newTitles = new Set(faq.slice(1055).map(f => f.title));
let changed = 0, hijack = 0;
r1.forEach(x => {
  const m1 = x.matchedFAQ, m2 = byId2[x.id] && byId2[x.id].matchedFAQ;
  const d1 = sc1[x.id], d2 = sc2[x.id];
  if (m1 !== m2) changed++;
  if (m2 && newTitles.has(m2)) hijack++;
  if (m1 !== m2 || Math.abs(d1 - d2) >= 1) {
    console.log(x.id, '| R1→R2 分数', d1, '→', d2, '| 命中:', (m1 || 'null').slice(0, 22), '→', (m2 || 'null').slice(0, 22), m2 && newTitles.has(m2) ? '【新条目】' : '');
  }
});
console.log('\n命中变化:', changed + '/20 | 命中新条目:', hijack);
console.log('新增条目数:', newTitles.size);
