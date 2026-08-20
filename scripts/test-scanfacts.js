/* scanFacts 误报回归测试（v60 讲义权威层）：
 * 加载浏览器端 agent-cluster.js，用其 scanFacts 扫描全部 FAQ 答案/语料摘要/测评文本，
 * 统计命中与误报（正确表述不应被纠错）。用法: node scripts/_test-scanfacts.js */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global; // agent-cluster.js 在 load 时写 window.AgentCluster
require(path.join(ROOT, 'assets', 'agent-cluster.js'));
const AC = global.AgentCluster;
if (!AC || !AC.scanFacts) { console.error('❌ AgentCluster 未加载'); process.exit(1); }

const { readFAQRuntime } = require('./lib-assistant-faq.js');
const faq = readFAQRuntime();

function check(text, label) {
  const c = AC.scanFacts(text);
  if (c.length) console.log(`  ⚠ [${label}] ${c[0].slice(0, 60)}…`);
  return c.length;
}

let fp = 0, totalHit = 0;
console.log('=== A. 已知正确表述（应 0 命中）===');
const correct = [
  '加入 8 mL 6% H₂O₂，40℃ 水浴慢慢滴加',
  '此结晶水合物在 100℃ 会失去结晶水，230℃ 分解',
  '烘干 50℃ 20 分钟（严禁 110℃，失结晶水温度为 100℃，110℃ 烘干会失水变质）',
  '称取 5.0 g 莫尔盐（M=392.14 g/mol），理论产量 6.26 g',
  'K₂C₂O₄·H₂O 3.5 g + 10 mL 蒸馏水微热溶解',
  '维持微沸约 4 分钟',
  '先一次加 6 mL 0.5mol/L H₂C₂O₄，保持微沸继续滴加',
  '加入 10 mL 乙醇，暗处静置',
  '配位数为 6，[Fe(C₂O₄)₃]³⁻ 为八面体构型',
  '洗涤至检验不到 SO₄²⁻',
  '产物在 100℃ 失结晶水，110℃ 烘干会使产物脱水变质，严禁使用 110℃ 烘干',
  '草酸钾 K₂C₂O₄·H₂O 潮解后应在 110℃ 烘干后再使用（草酸钾失水温度远高于 110℃）',
];
correct.forEach((s, i) => { if (check(s, '正确#' + i)) fp++; });

console.log('=== B. 已知错误表述（应 ≥1 命中）===');
const wrong = [
  '加入 10 mL 6% 的过氧化氢溶液进行氧化',
  '产物在 110℃ 失去 3 分子结晶水',
  '用烘箱 110℃ 烘干产物',
  '草酸钾用 15 mL 水溶解',
  '称取 8 g 莫尔盐作为铁源',
  '加入 20 mL 乙醇促进结晶',
];
wrong.forEach((s, i) => { totalHit += check(s, '错误#' + i); });

console.log('=== C. 全部 FAQ 答案误报扫描（正确答案不应被纠错）===');
const faqFp = [];
faq.forEach((e, i) => {
  const text = (e.answer || '') + '\n' + (e.detail || '');
  const c = AC.scanFacts(text);
  if (c.length) faqFp.push({ title: e.title, c: c[0], text: text.slice(0, 90) });
});
console.log(`  FAQ ${faq.length} 条，命中 ${faqFp.length} 条：`);
faqFp.slice(0, 25).forEach(x => console.log(`   • [${x.title}] ${x.c.slice(0, 70)}`));
if (faqFp.length > 25) console.log(`   … 共 ${faqFp.length} 条（详见上方）`);

console.log('=== D. 语料摘要（corpus abstracts 命中）===');
let corpusHit = 0;
try {
  const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'corpus.json'), 'utf8').replace(/^﻿/, ''));
  const entries = corpus.entries || corpus;
  (entries || []).forEach(e => {
    const t = (e.abstract || '') + (e.title || '');
    if (t && AC.scanFacts(t).length) { corpusHit++; }
  });
  console.log(`  corpus ${(entries || []).length} 篇，scanFacts 命中 ${corpusHit} 篇（文献内容为低权威，命中属预期可接受）`);
} catch (e) { console.log('  corpus 读取跳过:', e.message); }

console.log('\n===== 汇总 =====');
console.log(`正确表述误报: ${fp}  错误表述命中: ${totalHit}/${wrong.length}  FAQ 命中: ${faqFp.length}/${faq.length}`);
