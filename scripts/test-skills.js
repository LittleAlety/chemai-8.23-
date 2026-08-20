/* 新技能触发回归测试（trouble/phenomena）。用法: node scripts/_test-skills.js */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'assets', 'agent-cluster.js'));
const AC = global.AgentCluster;
const { readFAQRuntime } = require('./lib-assistant-faq.js');

console.log('=== A. 应触发 🔍 异常排查官 ===');
const troubleTriggers = [
  '我的产率很低怎么办', '产品产率偏低', '产率超过了100%', '晶体发黄了',
  '溶液不透明怎么办', '加草酸后不绿', '晶体一直不析出', '析出很慢',
  '晶体全是细小粉末', '实验失败了怎么办', '补救措施', '产物变质了', '烘干后变色',
];
troubleTriggers.forEach(q => {
  const r = AC.skills.trouble(q);
  console.log(r.matched ? '  ✓' : '  ✗未触发', `「${q}」→`, r.matched ? r.items[0].symptom : '');
});

console.log('=== B. 不应触发 🔍 异常排查官 ===');
const troubleNo = ['产率如何计算', '什么是产率', '怎么提高产率才正确', '溶解度的概念', '配位数是多少'];
troubleNo.forEach(q => {
  const r = AC.skills.trouble(q);
  console.log(r.matched ? '  ✗误触发!' : '  ✓', `「${q}」`);
});

console.log('=== C. 应触发 🧭 现象官 ===');
const phTriggers = ['加草酸时看到什么现象', '溶液为什么变绿', '产品是什么颜色', '蓝晒的现象', 'KSCN为什么不显血红', '滴过氧化氢应该观察到什么', '观察晶体颜色'];
phTriggers.forEach(q => {
  const r = AC.skills.phenomena(q);
  console.log(r.matched ? '  ✓' : '  ✗未触发', `「${q}」→`, r.matched ? r.items[0].phenomenon.slice(0, 26) : '');
});

console.log('=== D. 不应触发 🧭 现象官 ===');
const phNo = ['如何计算产率', '摩尔盐是什么', '讲一下历史背景'];
phNo.forEach(q => {
  const r = AC.skills.phenomena(q);
  console.log(r.matched ? '  ✗误触发!' : '  ✓', `「${q}」`);
});

console.log('=== E. FAQ 题目触发统计（合理性：太多=误触发）===');
const faq = readFAQRuntime();
let t1 = 0, t2 = 0, t1s = [], t2s = [];
faq.forEach(e => {
  const q = e.q || e.title || '';
  if (AC.skills.trouble(q).matched) { t1++; if (t1s.length < 8) t1s.push(q); }
  if (AC.skills.phenomena(q).matched) { t2++; if (t2s.length < 8) t2s.push(q); }
});
console.log(`  trouble 触发 ${t1}/${faq.length}`, t1s.slice(0, 4).join(' | '));
console.log(`  phenomena 触发 ${t2}/${faq.length}`, t2s.slice(0, 4).join(' | '));
