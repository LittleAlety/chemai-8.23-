'use strict';
/**
 * corpus_weight_analysis.js — 离线语料权重分析作业（v85）
 *
 * 无 LLM、确定性、幂等。读取语料库(corpus.json 445 条)+ 权威分类(categories.json)
 * + 运行时 FAQ(faq_runtime.js) + 讲义(manual.json)，计算并写出两个产物：
 *   1) data/corpus_weights.json  — 每条语料权威度 A(id)、子域覆盖/权威模型 subfieldAuthority、
 *                                  语料→FAQ 权威映射 faqMapping（供运行时加法式/门禁级 hook 消费）
 *   2) docs/语料权重分析报告.md  — 「好好分析权重」的人类可读报告
 *
 * 纪律：本作业只做分析/产出物，不改任何检索/打分公式。运行时 hook 一律加法式/门禁级。
 *
 * 运行：npm run corpus:weights   （或 node 训练管道/corpus_weight_analysis.js）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORPUS_JSON = path.join(ROOT, 'data', 'corpus.json');
const CATEGORIES_JSON = path.join(ROOT, 'data', 'categories.json');
const MANUAL_JSON = path.join(ROOT, 'data', 'manual.json');
const FAQRUNTIME_JS = path.join(ROOT, 'data', 'faq_runtime.js');
const OUT_WEIGHTS = path.join(ROOT, 'data', 'corpus_weights.json');
const OUT_REPORT = path.join(ROOT, 'docs', '语料权重分析报告.md');

const VERSION = 'v1.0';

/* ---------- 权威度映射表（来源：勘察到的 distinct 分布） ---------- */
const DOCTYPE_W = {
  '实验讲义': 1.0,
  '实验研究': 0.85,
  '期刊论文': 0.80,
  '综述': 0.80,
  'MSDS': 0.90,
  '教学研究': 0.70,
  '方法改进': 0.70,
  '实验教学': 0.60,
  '教案': 0.60,
  '科普/讲义': 0.65,
  '科普': 0.30,
  '习题': 0.25,
  '百科条目': 0.25,
  '竞赛试题': 0.25,
  '图片': 0.25,
  '学生报告': 0.20
};
const DOCTYPE_DEFAULT = 0.55;

const ABSTYPE_W = { publisher: 1.0, editor_summary: 0.70 };
const ABSTYPE_DEFAULT = 0.40; // none

const DEPTH_W = {
  '文献研究级别': 0.85,
  '综述级别': 0.80,
  '实验研究级别': 0.75,
  '教学级别': 0.60,
  '科普级别': 0.30
};
const DEPTH_DEFAULT = 0.40; // none

/* ---------- 语料→FAQ 映射：领域先验（手调，透明可解释） ---------- */
// key = 语料子域(13)，value = 额外映射到的 FAQ 官方案子域及权重(0..0.5)。
// 语料子域本身 1:1 映射回同名 FAQ 官方案子域（权重 1.0），此处为"侧向联想"。
const SIDE_MAPPING = {
  '光化学应用': [['蓝晒工艺', 0.35]],
  '合成制备': [['反应原理', 0.40], ['实验操作', 0.40]],
  '分析测定': [['高等理论', 0.25]],
  '配位化学理论': [['高等理论', 0.20], ['反应原理', 0.30]],
  '结构表征': [['分析测定', 0.30], ['高等理论', 0.20]],
  '热分析': [['分析测定', 0.30]],
  '磁性研究': [['配位化学理论', 0.30], ['高等理论', 0.20]],
  '综合研究': [['实验教学', 0.30], ['反应原理', 0.30]],
  '草酸配合物': [['配位化学理论', 0.40], ['合成制备', 0.30]],
  '摩尔盐相关': [['合成制备', 0.30], ['分析测定', 0.30]],
  '蓝晒工艺': [['光化学应用', 0.40]],
  '实验教学': [['综合研究', 0.30]],
  '安全与废物处理': [['实验操作', 0.30]]
};

/* ---------- 工具 ---------- */
function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
}
const SUBMAP = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','⁻':'-','⁺':'+','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]/g, c => SUBMAP[c] || c)
    .replace(/摄氏度|℃|°c/g, '度').replace(/\s+/g, '');
}
function median(arr) {
  const a = arr.slice().sort((x, y) => x - y);
  const n = a.length;
  if (!n) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* 归一化为 FAQ 官方案子域（本作业只认 categories.json 官方案） */
function loadCanonical() {
  const cat = loadJSON(CATEGORIES_JSON);
  const set = new Set(cat.canonical);
  return { canonical: cat.canonical, set, aliases: cat.aliases || {} };
}
function normToCanonical(v, canon) {
  if (!v || typeof v !== 'string') return '综合研究';
  const t = v.trim();
  if (!t) return '综合研究';
  if (canon.set.has(t)) return t;
  if (canon.aliases[t]) return canon.aliases[t];
  return t;
}

/* 细粒度表示：CJK 词二元组 + 小写字母数字串，返回 term→count */
function tokenize(texts) {
  const m = new Map();
  for (const t of texts) {
    const n = norm(t);
    const runs = n.match(/[a-z0-9]+|[一-鿿]+/g) || [];
    for (const r of runs) {
      if (r.length === 0) continue;
      if (/[a-z0-9]/.test(r[0])) {
        m.set(r, (m.get(r) || 0) + 1);
      } else if (r.length === 1) {
        m.set(r, (m.get(r) || 0) + 1);
      } else {
        for (let i = 0; i < r.length - 1; i++) {
          const g = r.slice(i, i + 2);
          m.set(g, (m.get(g) || 0) + 1);
        }
      }
    }
  }
  return m;
}
/* 取 top-k term，返回 Map；用数组保留顺序 */
function topVocab(m, k) {
  const arr = Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, k || 300);
  return new Map(arr);
}
/* s 的词汇被 t 词汇覆盖的比例（非对称，从 s 看）：[0,1] */
function overlap(srcVocab, dstVocab) {
  let tot = 0, hit = 0;
  for (const [k, v] of srcVocab) {
    tot += v;
    const dv = dstVocab.get(k);
    if (dv) hit += Math.min(v, dv);
  }
  return tot ? hit / tot : 0;
}

/* ---------- 每条语料权威度 ---------- */
function authorityOf(e) {
  const doctype = DOCTYPE_W[e.doctype] != null ? DOCTYPE_W[e.doctype] : DOCTYPE_DEFAULT;
  const abstype = e.abstract_type ? (ABSTYPE_W[e.abstract_type] != null ? ABSTYPE_W[e.abstract_type] : ABSTYPE_DEFAULT) : ABSTYPE_DEFAULT;
  const depth = e.depth ? (DEPTH_W[e.depth] != null ? DEPTH_W[e.depth] : DEPTH_DEFAULT) : DEPTH_DEFAULT;
  let meta = 0;
  if (e.journal) meta += 0.06;
  if (e.source_url) meta += 0.04;
  if (e.abstract) meta += 0.05;
  if (e.questions && e.questions.length) meta += Math.min(e.questions.length / 10, 0.05);
  meta = Math.min(meta, 0.20);
  return +(0.40 * doctype + 0.20 * abstype + 0.20 * depth + 0.20 * meta).toFixed(4);
}

/* ---------- 主流程 ---------- */
function build() {
  const corpus = loadJSON(CORPUS_JSON);
  const canon = loadCanonical();
  const entries = Array.isArray(corpus.entries) ? corpus.entries : [];
  const corpusTotal = entries.length;

  // 官方案子域集合（FAQ 空间 17）
  const faqCanon = canon.canonical;

  // 1) 每条语料原始权威度 A(id)，含其子域
  const rawA = new Map();
  for (const e of entries) {
    const id = e.id;
    let sf = e.subfield;
    sf = normToCanonical(sf, canon); // 语料子域已权威，此处兜底
    rawA.set(id, { subfield: sf, a: authorityOf(e) });
  }

  // 2) 子域计数 + MEDIAN → boost（反挤占）
  const subCount = new Map();
  for (const { subfield } of rawA.values()) subCount.set(subfield, (subCount.get(subfield) || 0) + 1);
  const subfields = Array.from(subCount.keys());
  const MEDIAN = median(Array.from(subCount.values()));
  const subfieldAuthority = {};
  for (const sf of subfields) {
    const count = subCount.get(sf);
    const ratio = +(count / corpusTotal).toFixed(4);
    const boost = +clamp(1 + 0.35 * (MEDIAN - count) / MEDIAN, 0.85, 1.45).toFixed(4);
    const tier = count > MEDIAN ? 'OVER' : (count < MEDIAN ? 'UNDER' : 'BALANCED');
    subfieldAuthority[sf] = { count, ratio, tier, boost };
  }

  // 3) entryAuthority[id] = { a: A(id)*boost(subfield), subfield }
  const entryAuthority = {};
  for (const e of entries) {
    const { subfield, a } = rawA.get(e.id);
    const boost = subfieldAuthority[subfield].boost;
    entryAuthority[e.id] = { subfield, a: a, boosted: +(a * boost).toFixed(4) };
  }

  // 4) 语料→FAQ 权威映射 = 主(同名1.0) + 领域先验侧向 + 数据驱动词重合补强
  const corpusVocab = new Map();   // subfield → vocab(来自语料)
  for (const sf of new Set(entries.map(e => normToCanonical(e.subfield, canon)))) {
    const texts = [];
    for (const e of entries) {
      if (normToCanonical(e.subfield, canon) !== sf) continue;
      texts.push(e.title || '', (e.questions || []).join('|'), e.objects || '', e.methods || '', e.abstract || '', e.content || '');
    }
    corpusVocab.set(sf, topVocab(tokenize(texts), 300));
  }
  const faqVocab = new Map();      // FAQ 官方案子域 → vocab(来自 keys+ents+title)
  let faq = [];
  try {
    const faqLib = require(path.join(ROOT, 'scripts', 'lib-assistant-faq.js'));
    faq = faqLib.readFAQRuntime(FAQRUNTIME_JS);
  } catch (e) {
    console.warn('[corpus_weight] 读 faq_runtime.js 失败，语料→FAQ 映射仅用领域先验:', e.message);
  }
  if (faq.length) {
    for (const sf of faqCanon) {
      const texts = [];
      for (const f of faq) {
        if (normToCanonical(f.subfield, canon) !== sf) continue;
        texts.push((f.keys || []).join('|'), (f.ents || []).join('|'), f.title || '');
      }
      faqVocab.set(sf, topVocab(tokenize(texts), 300));
    }
  }

  const faqMapping = [];
  for (const sf of subfields) {
    const links = [];
    // 主映射：同名官方案子域
    links.push({ sf: sf, w: 1.0, source: 'primary' });
    // 领域先验侧向（稀疏、精准）
    for (const [t, w] of (SIDE_MAPPING[sf] || [])) {
      if (t !== sf && faqCanon.includes(t)) links.push({ sf: t, w: w, source: 'curated' });
    }
    links.sort((a, b) => b.w - a.w);
    faqMapping.push({ source: sf, links });
  }

  // 数据驱动词重合矩阵（仅作参考/验证，不注入运行时信号——避免稀释偏好精度）
  const dataDrivenOverlap = {};
  if (faqVocab.size) {
    for (const sf of subfields) {
      if (!corpusVocab.has(sf)) continue;
      const cv = corpusVocab.get(sf);
      const ranks = [];
      for (const t of faqCanon) {
        if (t === sf) continue;
        ranks.push({ sf: t, ov: +overlap(cv, faqVocab.get(t) || new Map()).toFixed(3) });
      }
      ranks.sort((a, b) => b.ov - a.ov);
      dataDrivenOverlap[sf] = ranks.filter(r => r.ov >= 0.10);
    }
  }

  // 5) 覆盖分层
  const over = subfields.filter(s => subfieldAuthority[s].tier === 'OVER').sort((a, b) => subfieldAuthority[b].count - subfieldAuthority[a].count);
  const under = subfields.filter(s => subfieldAuthority[s].tier === 'UNDER').sort((a, b) => subfieldAuthority[a].count - subfieldAuthority[b].count);

  const weights = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    corpusTotal,
    faqTotal: faq.length,
    medianSubfieldCount: MEDIAN,
    subfieldAuthority,
    entryAuthority,
    coverage: { over, under },
    faqMapping,
    dataDrivenOverlap
  };

  fs.mkdirSync(path.dirname(OUT_WEIGHTS), { recursive: true });
  fs.writeFileSync(OUT_WEIGHTS, JSON.stringify(weights, null, 2) + '\n', 'utf8');

  writeReport(weights, { faqCanon, MEDIAN });
  return weights;
}

/* ---------- 报告 ---------- */
function writeReport(w, ctx) {
  const md = [];
  md.push('# ChemAI 语料权重分析报告', '');
  md.push('> 由 `训练管道/corpus_weight_analysis.js` 离线生成（无 LLM、确定性）。生成时间：' + w.generatedAt + '', '');
  md.push('## 一、方法', '');
  md.push('每条语料的权威度 `A(id) ∈ [0,1]` 由四条带权常数构成（权重：0.40/0.20/0.20/0.20）：', '');
  md.push('```');
  md.push('A(id) = 0.40·doctype + 0.20·abstract_type + 0.20·depth + 0.20·metadata_completeness');
  md.push('(metadata = +journal0.06 +source_url0.04 +abstract0.05 +min(questions/10,0.05), 封顶 0.20)');
  md.push('```', '');
  md.push('### doctype 权威映射', '');
  md.push('| doctype | 权威分 |', '|---|---|');
  for (const [k, v] of Object.entries(DOCTYPE_W)) md.push('| ' + k + ' | ' + v + ' |');
  md.push('| *(未知)* | ' + DOCTYPE_DEFAULT + ' |', '');
  md.push('### abstract_type 权威映射', '');
  md.push('| abstract_type | 权威分 |', '|---|---|');
  for (const [k, v] of Object.entries(ABSTYPE_W)) md.push('| ' + k + ' | ' + v + ' |');
  md.push('| *(缺失)* | ' + ABSTYPE_DEFAULT + ' |', '');
  md.push('### depth 权威映射', '');
  md.push('| depth | 权威分 |', '|---|---|');
  for (const [k, v] of Object.entries(DEPTH_W)) md.push('| ' + k + ' | ' + v + ' |');
  md.push('| *(缺失)* | ' + DEPTH_DEFAULT + ' |', '');

  md.push('## 二、子域覆盖度 / 权威度模型（反挤占）', '');
  md.push('子域中位数覆盖数 = **' + ctx.MEDIAN + '**。`boost(s) = clamp(1 + 0.35·(MEDIAN − count)/MEDIAN, 0.85, 1.45)`：稀疏但权威的域上浮（防被挤掉），过度覆盖≈0.85（反挤占）。', '');
  md.push('| 子域 | 条数 | 占比 | tier | boost |', '|---|---|---|---|---|');
  for (const sf of Object.keys(w.subfieldAuthority)) {
    const s = w.subfieldAuthority[sf];
    md.push('| ' + sf + ' | ' + s.count + ' | ' + s.ratio + ' | ' + s.tier + ' | ' + s.boost + ' |');
  }
  md.push('', '### 覆盖过度（OVER，≥中位数）', '');
  for (const sf of w.coverage.over) md.push('- ' + sf + ' (' + w.subfieldAuthority[sf].count + ' 条)');
  md.push('', '### 覆盖不足（UNDER，<中位数）', '');
  for (const sf of w.coverage.under) md.push('- ' + sf + ' (' + w.subfieldAuthority[sf].count + ' 条)');
  md.push('', '`entryAuthority[id] = A(id)·boost(subfield)`，用于运行时对 `searchCorpus` 命中做**加法式**权威度提升（见下）。', '');

  md.push('## 三、语料→FAQ 权威映射（运行时）', '');
  md.push('语料子域 1:1 主映射同名 FAQ 官方案子域（权重 1.0），附加「领域先验」侧向联想。运行时据此按问题主导语料子域优先选对应 FAQ 子域（稀疏、精准）。', '');
  md.push('| 语料子域 | → FAQ 子域(权重) |', '|---|---|');
  for (const m of w.faqMapping) {
    const links = m.links.map(l => l.sf + '[' + l.w + ']').join('，');
    md.push('| ' + m.source + ' | ' + links + ' |');
  }
  md.push('', '## 三·附、数据驱动词重合矩阵（参考，不注入运行时）', '');
  md.push('下表为语料子域词汇被 FAQ 官方案子域词汇覆盖的比例（词二元组 + 字母数字串）。**仅作验证/分析**，不并入运行时 `faqMapping`，避免偏好被稀释。', '');
  md.push('| 语料子域 | 重合度高的 FAQ 子域(ov≥0.10) |', '|---|---|');
  for (const m of Object.keys(w.dataDrivenOverlap || {})) {
    const links = (w.dataDrivenOverlap[m] || []).map(r => r.sf + '(' + r.ov + ')').join('，');
    md.push('| ' + m + ' | ' + (links || '（无）') + ' |');
  }
  md.push('', '## 四、汇总', '');
  md.push('- 语料总条数：**' + w.corpusTotal + '**', '');
  md.push('- 运行时 FAQ：**' + (w.faqTotal || '-') + '** 条', '');
  md.push('- 子域数：**' + Object.keys(w.subfieldAuthority).length + '**', '');
  md.push('', '## 五、运行时安全 hook（门禁级 / 加法式，不改基础打分）', '');
  md.push('1. **searchCorpus 加法权威度提升**：命中语料 `e.id` 时，`s += entryAuthority[id].boosted · CORPUS_AUTH_BOOST(≈4)`。', '');
  md.push('2. **buildLLMContext 权威优先 cherry-pick**：`searchCorpus(q,6)` 后按 `score + boosted·BOOST` 重排取 top-2，LLM 优先见权威语料。', '');
  md.push('3. **下游门禁**：`confidenceScore` / `relatedFAQs` / `bestOnTopicFAQ` 按映射子域对 `scores.corpus` 做 clamp 加法，并优先被映射的 FAQ 子域。', '');
  md.push('', '以上均为对已有运行分的**加法项**或排序偏好；`matchFAQ` 基础打分表达式与 penalty 逐字不变；`corpus_weights.json` 缺失时干净退回现行行为。', '');
  md.push('', '---', '');
  md.push('*本报告只做分析与建议，不改检索/打分公式。*', '');

  fs.mkdirSync(path.dirname(OUT_REPORT), { recursive: true });
  fs.writeFileSync(OUT_REPORT, md.join('\n'), 'utf8');
}

/* ---------- 入口 ---------- */
const w = build();
console.log('[corpus_weight] 完成。corpusTotal=' + w.corpusTotal + '，faqTotal=' + (w.faqTotal || '-')
  + '，子域=' + Object.keys(w.subfieldAuthority).length
  + '，entryAuthority=' + Object.keys(w.entryAuthority).length);
console.log('[corpus_weight] 写出：' + path.relative(ROOT, OUT_WEIGHTS) + ' / ' + path.relative(ROOT, OUT_REPORT));
