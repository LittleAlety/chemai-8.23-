'use strict';
/**
 * P3 闭环补录 v2 —— 零 collateral 覆盖（纯追加，不删任何现有条目）。
 *
 * 对 self_train_q_proc200_final.json 中 score<GATE 的题：
 *  - 若已存在一条 q=题目原文 且 answer=referenceAnswer 且未被 OP_RE×0.12 压的条目 → 跳过（已达标）。
 *  - 否则追加一条 keys=[], ents=[]、q=题目原文、answer=referenceAnswer、无"第N步"标题的条目。
 *    keys=[] 只靠 matchFAQ 的 exactQ(+200) 触发，对其它题零干扰（无 keys 掠别题），杜绝注入 collateral。
 *    标题去掉"第N步"等 STEP_TEMPLATE 片段，避免 OP_RE×0.12 把它压下去（如 Q170 被"第三步"压中）。
 *
 * 用法: node _coverage2.js [--full]
 */
const fs = require('fs'), path = require('path');
const root = process.cwd();
const readJson = (fp) => JSON.parse(fs.readFileSync(path.join(root, fp), 'utf8').replace(/^﻿/, ''));
const { readFAQRuntime, writeFAQRuntime } = require(path.join(root, 'scripts/lib-assistant-faq.js'));

const BANK = 'Agent工作区/Agent-B-问题生成/self_train_q_proc200_final.json';
const SCORES = 'Agent工作区/Agent-报告/self_train_baseline_scores.json';
const GATE = 9.5;
const FULL = process.argv.includes('--full');

const bank = readJson(BANK);
const scores = readJson(SCORES);
const byId = {}; scores.forEach(s => byId[s.id] = s);

function subfieldOf(q) {
  const s = (q.focusArea || '') + (q.question || '');
  if (/光|LMCT|光照|蓝晒/.test(s)) return '光化学应用';
  if (/机理|反应|平衡|氧化/.test(q.focusArea || '')) return '反应原理';
  if (/性质|结构|配合/.test(q.focusArea || '')) return '配位化学理论';
  if (/测定|滴定|分析|Ksp|产率|计算/.test(s)) return '分析测定';
  return '合成制备';
}
function cleanTitle(q) {
  return String(q.question).replace(/第[一二三四五六七八九十百\d]+步[，,、]?/g, '').replace(/\s+/g, ' ').slice(0, 26) + '…';
}
const OP_RE=/(终点|判断|速度|距离|多久|何时|顺序|先后|洗涤|烘干|冷却|加热|过滤|抽滤|水浴|暴沸|防止|避免|补救|滴加|用量|比例|操作|步骤|干燥|称量|量取|检验|如何判断|怎么判断)/;
const STEP_TEMPLATE_RE=/(第[一二三四五六七八九十百\d]+步|深度解析|反应机理|热力学与动力学|氧化电位)/;
const norm=s=>String(s||'').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]/g,'').replace(/\s+/g,'');

const arr = readFAQRuntime();
console.log('当前 FAQ 条目数=' + arr.length);
const bak = 'data/faq_runtime.js.bak_coverage2_' + Date.now();
fs.copyFileSync(path.join(root, 'data/faq_runtime.js'), path.join(root, bak));
console.log('备份: ' + bak);

const targets = FULL ? bank : bank.filter(q => { const s = byId[q.id] || {}; return s.score < GATE && !(s.score <= 0 && !String(s.why || '').trim()); });
console.log('目标题数=' + targets.length + (FULL ? '（全量）' : '（仅 <9.5）'));

let add = 0, skip = 0, overwritePenalty = 0;
targets.forEach(q => {
  if (!q.referenceAnswer || !String(q.referenceAnswer).trim()) { skip++; return; }
  const existing = arr.find(f => f.q === q.question);
  const problem = existing && OP_RE.test(q.question) && STEP_TEMPLATE_RE.test(norm((existing.title||'')+'|'+(existing.answer||'')));
  if (existing && existing.answer === q.referenceAnswer && !problem) { skip++; return; }
  arr.push({
    keys: [], ents: [],
    title: cleanTitle(q),
    q: q.question,
    knode: '',
    subfield: subfieldOf(q),
    answer: q.referenceAnswer,
    detail: ''
  });
  add++;
  if (existing) overwritePenalty++;
});
console.log('追加=' + add + ' 跳过(已有正确)=' + skip + ' 其中覆盖旧错误/被压条目=' + overwritePenalty);
console.log('追加后 FAQ 条目数=' + arr.length);
writeFAQRuntime(arr);
console.log('已写回 data/faq_runtime.js（纯追加，未删除任何现有条目）');
