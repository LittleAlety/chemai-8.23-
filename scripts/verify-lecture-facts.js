/**
 * verify-lecture-facts.js — 讲义权威事实回归守门（v60）
 * ---------------------------------------------------------------------
 * 复用浏览器端 assets/agent-cluster.js 的 scanFacts（讲义冲突校验生产代码），
 * 扫描全部数据层，检测与武汉大学实验讲义（100℃失水 / 8mL H₂O₂ / 10mL K₂C₂O₄ 水等）冲突的数值。
 *   - 权威层（faq_runtime / assessment_kp / manual / questions_bank）：命中=硬错误，退出码 1
 *   - 文献层（corpus）：命中=警告（文献为低权威，允许与讲义差异，仅提示）
 * v74+ 增补：语义项人工核查清单（SEMANTIC_CHECKLIST）——提示应人工复核的正确表述是否仍在，
 *   非自动校验（探针命中≠科学正确），仅报告不影响退出码。
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

function jsonStrings(v, out) {
  out = out || [];
  if (v == null) return out;
  if (typeof v === 'string') { out.push(v); return out; }
  if (Array.isArray(v)) { v.forEach(x => jsonStrings(x, out)); return out; }
  if (typeof v === 'object') { Object.keys(v).forEach(k => jsonStrings(v[k], out)); }
  return out;
}

/* 权威层数据（数值守卫 + 语义清单共用）。layers = [{name, strings:[...]}] */
const layers = [];
layers.push({ name: 'faq_runtime', strings: readFAQRuntime().map(e => (e.answer || '') + '\n' + (e.detail || '')) });
['assessment_kp.json', 'manual.json', 'questions_bank.json'].forEach(f => {
  try { layers.push({ name: f, strings: jsonStrings(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8').replace(/^﻿/, ''))) }); }
  catch (e) { console.error(`❌ 解析失败 ${f}: ${e.message}`); process.exit(1); }
});

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

layers.forEach(L => scan(L.name, true, L.strings.map(s => ({ title: null, text: s }))));

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

/* =====================================================================
 * 语义项·人工核查清单（v74）
 * 说明：全站只有数值守卫（scanFacts），以下概念/归属类事实无法自动校验，
 * 仅通过「已修正表述是否仍存在于数据」作漂移提示——探针命中≠科学正确，
 * 只能提醒人工复核。不参与退出码，绝不伪装成自动校验。
 * ===================================================================== */
const SEMANTIC_CHECKLIST = [
  { id: 'ch1-s2 诺奖归属', source: '化学史/诺贝尔奖', where: '手册 第1章-2节',
    correct: '晶体场理论由 Bethe(1929) 提出；van Vleck 1977 诺奖(磁性/电子结构)、Bethe 1967 诺奖(核反应/恒星能量)，均与晶体场理论无关',
    probes: ['与晶体场理论无关'] },
  { id: 'ch1-s2 Sidgwick 年代', source: '配位化学史', where: '手册 第1章-2节',
    correct: 'Sidgwick 于 1927 年提出 EAN 规则（非 1940 年）',
    probes: ['1927年，英国化学家'] },
  { id: 'ch2-s2 氧化还原方向', source: '氧化还原', where: '手册 第2章-2节',
    correct: '酸性条件草酸根→CO₂（被氧化）；Fe³⁺ 已是最高氧化态，KMnO₄ 不能将其还原为 Fe²⁺',
    probes: ['已是最高氧化态'] },
  { id: 'ch2-s3 成键理论分组', source: '配位化学', where: '手册 第2章-3节',
    correct: 'VBT／CFT／MOT 为三个独立成键视角，不应把杂化轨道(VBT)与晶体场(CFT)混为一谈',
    probes: ['多理论视角辨析', '价键理论（VBT）视角', '晶体场理论（CFT）视角', '分子轨道理论（MOT）视角'] },
];

console.log('\n【语义项·人工核查清单】（非自动校验；探针仅提示"已修正表述是否仍在"，命中≠科学正确，该栏需人眼复核）');
let semMissing = 0;
SEMANTIC_CHECKLIST.forEach(item => {
  const spots = {};
  let total = 0;
  item.probes.forEach(p => layers.forEach(L => {
    let n = 0; L.strings.forEach(s => { if (s.indexOf(p) !== -1) n++; });
    if (n) { spots[L.name] = (spots[L.name] || 0) + n; total += n; }
  }));
  if (total > 0) {
    console.log(`  ✔ [${item.id}] 命中 ${total} 处（${Object.keys(spots).join('、')}） — 应人工复核`);
  } else {
    semMissing++;
    console.log(`  ✖ [${item.id}] 未命中 —— 该修正表述可能被改写/回退，请人工核对（应含「${item.probes[0]}」）`);
  }
});
console.log(`  · 语义项共 ${SEMANTIC_CHECKLIST.length} 条，全部在数据中检出 ${SEMANTIC_CHECKLIST.length - semMissing}/${SEMANTIC_CHECKLIST.length}。`);
console.log('  · 注意：命中只代表"这句话还在"，不代表它科学正确；概念/归属类错误仍须人工确认。');

if (HARD.length) { console.error('\n✖ 存在权威层冲突，请修复后重跑'); process.exit(1); }
console.log('\n✔ verify-lecture-facts 通过（语义清单为提示项，不影响退出码）');
