'use strict';
/**
 * 知识清单（data/corpus.json, 445 条）内容级权威事实再检索（v85, 只读）
 *
 * 背景：corpus_weights.json 只做了"权威度权重"，knowledge_audit_report.json 只做了"元数据质量"，
 * 都【没有做内容级事实抽取】。而 corpus 的 abstract/questions/methods 信息密度很高，尤其
 * 缺口的 安全与废物处理(5条)、稀疏的 配位化学理论/结构表征/热分析/磁性研究 里藏着大量未进 FAQ 的
 * 权威数值与条件。
 *
 * 本工具【只读 corpus.json】【不写 faq_runtime.js】(Cycle 3 正在写它)，只产出两份报告：
 *   Agent工作区/Agent-报告/corpus_fact_extract.json  (机读：数值句按子域归类)
 *   docs/knowledge-reextract-report.md               (人读：提炼出的候选权威事实)
 *
 * 提取策略（确定性，无 LLM）：
 *   ① 数值指纹句：abstract/questions 里含 [0-9]+(单位|℃|mL|%) 或含关键词(温度/浓度/比色皿/摩尔/系数/产率) 的句子。
 *   ② 用正则切句(。！？；)，找出含数字的句子，标记子域/id/标题。
 *   ③ 另统计每个子域"含数句子数"= 信息密度，用于识别还能再榨的子域。
 *
 * 用法： node 训练管道/corpus_extract_facts.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const corpus = JSON.parse(fs.readFileSync(path.join(root, 'data', 'corpus.json'), 'utf8'));
const entries = corpus.entries || [];

// 含数值的句子：出现数字至少一位，或含常见化学条件/量词关键词
const NUM_RE = /[0-9]/;
const KEY_RE = /[0-9]|℃|°C|mL|mol|nm|mm|%|浓度|温度|比色皿|摩尔|系数|产率|波长|mL|g\/|mg|量|比|率|℃|K₃|Fe|C₂O₄/;

function splitSentences(text) {
  if (!text) return [];
  return text.split(/[。！？；\n]+/).map(s => s.trim()).filter(Boolean);
}
function isNumericSentence(s) {
  return NUM_RE.test(s);
}

// 按子域聚合数值句
const bySub = {};
const allNumSentences = [];
for (const e of entries) {
  const sub = e.subfield || '未知';
  if (!bySub[sub]) bySub[sub] = [];
  const texts = [];
  if (e.abstract) texts.push({ kind: 'abstract', src: e.abstract });
  if (Array.isArray(e.questions)) e.questions.forEach(q => texts.push({ kind: 'question', src: q }));
  if (e.methods) texts.push({ kind: 'methods', src: e.methods });
  if (e.objects) texts.push({ kind: 'objects', src: e.objects });
  let cnt = 0;
  for (const t of texts) {
    for (const s of splitSentences(t.src)) {
      if (isNumericSentence(s)) {
        cnt++;
        const rec = { id: e.id, sub, title: e.title, kind: t.kind, text: s };
        allNumSentences.push(rec);
        bySub[sub].push(rec);
      }
    }
  }
  e._numericSentenceCount = cnt;
}

// 子域信息密度统计
const subStats = Object.entries(bySub).map(([sub, arr]) => ({
  sub,
  count: arr.length,
  entries: entries.filter(e => e.subfield === sub).length,
  density: +(arr.length / Math.max(1, entries.filter(e => e.subfield === sub).length)).toFixed(2)
})).sort((a, b) => b.density - a.density);

const out = {
  generatedAt: new Date().toISOString(),
  total: entries.length,
  numericSentenceTotal: allNumSentences.length,
  numericSentenceBySub: bySub,
  subInfoDensity: subStats
};
fs.writeFileSync(
  path.join(root, 'Agent工作区', 'Agent-报告', 'corpus_fact_extract.json'),
  JSON.stringify(out, null, 2)
);

// —— 人读报表：按信息密度排序，抽每个子域最"权威"的句子（含 数字+量词 且来自 abstract 的最优先）——
function authoritativeScore(s) {
  let sc = 0;
  if (s.kind === 'abstract') sc += 4;
  if (s.kind === 'question') sc += 1;
  if (/(℃|°C|mL|mol|nm|mm|%|g\/)/.test(s.text)) sc += 3;      // 带单位
  if (/(λ|波长|nm)/.test(s.text) && /(摩尔吸收|系数|absorb)/.test(s.text)) sc += 2;
  if (/(产率|收率|yield)/.test(s.text)) sc += 2;
  if (/(温度|℃)/.test(s.text) && /(烘干|干燥|失重|分解|失水)/.test(s.text)) sc += 2;
  return sc;
}

// 每个子域取信息密度最高的权威句
let md = `# 知识清单再检索 · 内容级权威事实抽取报告\n\n`;
md += `- 生成时间: ${new Date().toISOString()}\n`;
md += `- 语料条目: ${entries.length}  |  含数值句总数: ${allNumSentences.length}\n`;
md += `- 说明: 本报告只读 corpus.json 做内容级再检索（corpus_weights 只做权重、audit 只做质量，均未做内容抽取）。以下为候选"可再榨进 FAQ"的权威事实，按子域信息密度排序。数值需再核对原文，未直接入库。\n\n`;

md += `## 子域信息密度排序（含数值句/条目）\n\n`;
md += `| 子域 | 条目数 | 含数值句 | 密度 |\n|---|---|---|---|\n`;
for (const s of subStats) md += `| ${s.sub} | ${s.entries} | ${s.count} | ${s.density} |\n`;

// 每个子域候选权威句
md += `\n## 各子域候选权威事实\n\n`;
for (const s of subStats) {
  const sub = s.sub;
  const arr = bySub[sub].slice().sort((a, b) => authoritativeScore(b) - authoritativeScore(a));
  md += `\n### ${sub}（含数值句 ${arr.length}，条目 ${s.entries}）\n\n`;
  for (const rec of arr.slice(0, 12)) {
    md += `- [id=${rec.id} · ${rec.kind}] ${rec.text}\n`;
  }
}

fs.writeFileSync(path.join(root, 'docs', 'knowledge-reextract-report.md'), md);

console.log('=== 知识清单再检索（内容级事实抽取）===');
console.log('  语料条目: ' + entries.length + '  含数值句: ' + allNumSentences.length);
console.log('  子域信息密度（含数值句/条目，降序）:');
for (const s of subStats) console.log('    ' + s.sub.padEnd(8) + ' 条目' + s.entries + ' 句' + s.count + ' 密度' + s.density);
console.log('  报告已写: Agent工作区/Agent-报告/corpus_fact_extract.json');
console.log('            docs/knowledge-reextract-report.md');
