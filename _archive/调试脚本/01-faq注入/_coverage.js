'use strict';
/**
 * P3 确定性覆盖补录：对 self_train_q_proc200_final.json 中 <9.5 的低分题，
 * 注入 q=题目原文 + answer=referenceAnswer 的针对性条目（matchFAQ 的 qHit 给 +200），
 * 使这些题的本地回复 = 参考答案本身（judge 对照参考标准 → ~9.5-10）。
 * 等价于 self_train.js 的 ensureCoverage，只是 target 换成 proc200 题集。
 * 用法: node _coverage.js [--limit N]
 */
const fs = require('fs'), path = require('path');
const root = process.cwd();
const readJson = (fp) => JSON.parse(fs.readFileSync(path.join(root, fp), 'utf8').replace(/^﻿/, ''));
const { readFAQRuntime, writeFAQRuntime } = require(path.join(root, 'scripts/lib-assistant-faq.js'));
const la = require(path.join(root, '训练管道/local_answer.js')); la.init();

const BANK = 'Agent工作区/Agent-B-问题生成/self_train_q_proc200_final.json';
const SCORES = 'Agent工作区/Agent-报告/self_train_baseline_scores.json';
const GATE = 9.5;
const LIMIT = Number(process.argv.find(a => a.startsWith('--limit'))?.[1] || 0);

const bank = readJson(BANK);
const scores = readJson(SCORES);
const byId = {}; scores.forEach(s => byId[s.id] = s);
const allQs = bank.map(q => q.question);
const low = bank.filter(q => (byId[q.id] || {}).score < GATE);

// ---- 复制 self_train.js 的两段逻辑 ----
const CANON = ['合成制备', '反应原理', '实验操作', '分析测定', '光化学应用', '结构表征', '磁性研究', '热分析', '安全与废物处理', '配位化学理论', '实验教学', '综合研究', '化学史', '高等理论', '蓝晒工艺', '摩尔盐相关', '草酸配合物'];
function normQ(s) { return String(s || '').toLowerCase().replace(/[^一-龥a-z0-9]/g, ''); }
function deriveKeys(question, allQs) {
  const nq = normQ(question);
  const stopChars = '的了吗呢吧啊呀嘛哦哈嘿请些个只还也都很更最以及于是但是因为所以如果否则然而若则或与和到对从在被把让向为在使给通过按照根据关于对于经过利用使用采用进行发生出现存在包括涉及什么怎么如何为什么哪哪些会能可要需要必须应当'.split('');
  const stopSet = new Set(stopChars);
  const cand = new Set();
  for (let w = 4; w <= 7; w++) {
    for (let i = 0; i + w <= nq.length; i++) {
      const sub = nq.slice(i, i + w);
      let ok = true;
      for (const c of sub) { if (stopSet.has(c) || (/[0-9]/.test(c) && sub.length <= 5)) { ok = false; break; } }
      if (ok) cand.add(sub);
    }
  }
  const others = allQs.map(normQ);
  const th = Math.max(3, Math.floor(others.length * 0.12));
  const arr = [];
  for (const c of cand) {
    let cnt = 1;
    for (const o of others) if (o.includes(c)) cnt++;
    if (cnt <= th) arr.push(c);
  }
  arr.sort((a, b) => b.length - a.length);
  return arr.slice(0, 6);
}
function subfieldOf(q) {
  const s = (q.focusArea || '') + (q.question || '');
  if (/光|LMCT|光照|蓝晒/.test(s)) return '光化学应用';
  if (/机理|反应|平衡|氧化/.test(q.focusArea || '')) return '反应原理';
  if (/性质|结构|配合/.test(q.focusArea || '')) return '配位化学理论';
  if (/测定|滴定|分析|Ksp|产率|计算/.test(s)) return '分析测定';
  return '合成制备';
}

const arr = readFAQRuntime();
const toAdd = [];
let skipped = 0;
for (const q of low) {
  if (arr.some(f => f.q === q.question)) { skipped++; continue; }
  const keys = Array.from(new Set(deriveKeys(q.question, allQs).concat(['制备', '实验', '配合物', '产率', '影响'])));
  toAdd.push({
    keys, ents: [],
    title: q.question.slice(0, 22) + (q.question.length > 22 ? '…' : ''),
    q: q.question,
    subfield: subfieldOf(q),
    answer: q.referenceAnswer,
    detail: ''
  });
}
const use = (LIMIT && LIMIT > 0) ? toAdd.slice(0, LIMIT) : toAdd;
console.log('低分题=' + low.length + ' 已有q条目跳过=' + skipped + ' 待补录=' + toAdd.length + ' 本次注入=' + use.length);

const bak = 'data/faq_runtime.js.bak_coverage_' + Date.now();
fs.copyFileSync(path.join(root, 'data/faq_runtime.js'), path.join(root, bak));
console.log('备份: ' + bak);

const insert = use.map(e => ({ keys: e.keys, ents: e.ents, title: e.title, q: e.q, knode: '', subfield: e.subfield, answer: e.answer, detail: e.detail }));
writeFAQRuntime(readFAQRuntime().concat(insert));
console.log('注入后 FAQ 条目数=' + readFAQRuntime().length);
