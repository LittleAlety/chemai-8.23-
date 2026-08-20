/**
 * verify-lecture-facts.js — 讲义权威事实回归守门（v60）
 * ---------------------------------------------------------------------
 * 复用浏览器端 assets/agent-cluster.js 的 scanFacts（讲义冲突校验生产代码），
 * 扫描全部数据层，检测与武汉大学实验讲义（100℃失水 / 8mL H₂O₂ / 10mL K₂C₂O₄ 水等）冲突的数值。
 *   - 权威层（faq_runtime / assessment_kp / manual / questions_bank）：命中=硬错误，退出码 1
 *   - 文献层（corpus）：命中=警告（文献为低权威，允许与讲义差异，仅提示）
 * 用法: node scripts/verify-lecture-facts.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

global.window = global; // agent-cluster.js 写 window.AgentCluster
require(path.join(ROOT, 'assets', 'agent-cluster.js'));
const AC = global.AgentCluster;
if (!AC || !AC.scanFacts) { console.error('❌ 无法加载 AgentCluster.scanFacts'); process.exit(1); }
const { readFAQRuntime } = require('./lib-assistant-faq.js');

function jsonStrings(v, out, depth) {
  out = out || [];
  if (v == null) return out;
  if (typeof v === 'string') { out.push(v); return out; }
  if (Array.isArray(v)) { v.forEach(x => jsonStrings(x, out, (depth || 0) + 1)); return out; }
  if (typeof v === 'object') { Object.keys(v).forEach(k => jsonStrings(v[k], out, (depth || 0) + 1)); }
  return out;
}

const HARD = [], WARN = [];
function scan(name, hard, items) {
  let hits = 0;
  (items || []).forEach(item => {
    const text = item.text != null ? item.text : item;
    if (!text) return;
    const c = AC.scanFacts(text);
    c.forEach(w => {
      hits++;
      const who = item.title ? `「${item.title}」` : '';
      const line = `  [${name}] ${who} ${w.slice(0, 56)}…`;
      (hard ? HARD : WARN).push(line);
    });
  });
  return hits;
}

// 权威层（硬性）
scan('faq_runtime', true, readFAQRuntime().map(e => ({ title: e.title, text: (e.answer || '') + '\n' + (e.detail || '') })));
['assessment_kp.json', 'manual.json', 'questions_bank.json'].forEach(f => {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8').replace(/^﻿/, '')); }
  catch (e) { console.error(`❌ 解析失败 ${f}: ${e.message}`); process.exit(1); }
  scan(f, true, jsonStrings(j));
});
// 文献层（警告）
try {
  const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'corpus.json'), 'utf8').replace(/^﻿/, ''));
  const entries = corpus.entries || corpus;
  scan('corpus', false, (entries || []).map(e => ({ title: e.title, text: (e.abstract || '') + '\n' + (e.title || '') })));
} catch (e) { console.log('  ⚠ corpus 跳过:', e.message); }

console.log(HARD.length ? `✖ 权威层讲义冲突 ${HARD.length} 处：` : '✔ 权威层（FAQ/测评/讲义/题库）无讲义数值冲突');
HARD.forEach(l => console.log(l));
if (WARN.length) { console.log(`⚠ 文献层（corpus，低权威，仅供参考）${WARN.length} 处：`); WARN.forEach(l => console.log(l)); }
else console.log('✔ 文献层无命中');

if (HARD.length) { console.error('\n✖ 存在权威层冲突，请修复后重跑'); process.exit(1); }
console.log('\n✔ verify-lecture-facts 通过');
