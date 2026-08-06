'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const writeJSON = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2), 'utf8');

const FAQ = readJSON('data/faq_unified.json');
const MANUAL = readJSON('data/manual.json');
const CORPUS = readJSON('data/corpus.json');
const CORPUS_IDS = new Set((CORPUS.entries || []).map(e => String(e.id)));

const norm = s => String(s || '')
  .toLowerCase()
  .replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)])
  .replace(/\s+/g, '');

const GAP_FIXES = [
  {
    title: '莫尔盐vs绿矾作为铁源的比较',
    keys: [
      '绿矾', '硫酸亚铁', 'feso4', '摩尔盐区别', '绿矾区别',
      '比较', '区别', '对比', 'vs', '哪个稳定',
      '为什么用莫尔盐', '为什么用摩尔盐', '为什么不用绿矾',
      '摩尔盐和绿矾哪个稳定', '莫尔盐和绿矾哪个稳定',
      '绿矾和摩尔盐区别', '摩尔盐和绿矾区别',
      '硫酸亚铁与摩尔盐区别', 'fe2+稳定性'
    ]
  }
];

function agentTrainer(cycle) {
  const issues = [];
  GAP_FIXES.forEach(gap => {
    const entry = FAQ.find(f => f.title === gap.title);
    if (!entry) {
      issues.push({ type: 'missing', title: gap.title, message: '缺少条目' });
      return;
    }
    const keys = new Set((entry.keys || []).map(norm));
    const missing = gap.keys.filter(k => !keys.has(norm(k)));
    if (missing.length) {
      issues.push({ type: 'missing_keys', title: gap.title, missing });
    }
  });
  console.log(`[Cycle ${cycle}] 甲(Trainer): 检测到 ${issues.length} 个 FAQ 检索缺口`);
  return issues;
}

function agentGenerator(cycle, apply) {
  let changed = 0;
  GAP_FIXES.forEach(gap => {
    const entry = FAQ.find(f => f.title === gap.title);
    if (!entry) return;
    if (!Array.isArray(entry.keys)) entry.keys = [];
    const existing = new Set(entry.keys.map(norm));
    gap.keys.forEach(k => {
      if (!existing.has(norm(k))) {
        if (apply) entry.keys.push(k);
        changed++;
      }
    });
    if (apply && !String(entry.q || '').includes('区别')) {
      entry.q = entry.title;
      changed++;
    }
  });
  if (apply) writeJSON('data/faq_unified.json', FAQ);
  console.log(`[Cycle ${cycle}] 乙(Generator): ${apply ? '应用' : '预演'} ${changed} 个关键词/标题修正`);
  return changed;
}

function agentValidator(cycle) {
  const issues = [];
  const seen = new Set();
  FAQ.forEach(f => {
    const title = norm(f.title);
    if (!title) issues.push({ title: f.title, issue: '空标题' });
    if (seen.has(title)) issues.push({ title: f.title, issue: '重复标题' });
    seen.add(title);
    if (!Array.isArray(f.keys) || !f.keys.length) issues.push({ title: f.title, issue: '缺少 keys' });
    if (!f.answer || String(f.answer).trim().length < 20) issues.push({ title: f.title, issue: '答案过短' });
    (f.corpus_refs || []).forEach(ref => {
      const ids = String(ref).match(/(?:语料|文献)?#\s*(\d{1,4})/g) || [];
      ids.forEach(raw => {
        const id = String(Number(raw.replace(/[^\d]/g, '')));
        if (!CORPUS_IDS.has(id)) issues.push({ title: f.title, issue: '无效语料引用 #' + id });
      });
    });
  });
  console.log(`[Cycle ${cycle}] 丁(Validator): 发现 ${issues.length} 个数据问题`);
  return issues;
}

function scoreFAQ(query, f) {
  const nq = norm(query);
  const title = norm(f.title || '');
  const q = norm(f.q || f.title || '');
  let score = 0;
  (f.keys || []).forEach(k => {
    const nk = norm(k);
    if (nk && nq.includes(nk)) score += nk.length >= 3 ? 4 : 2;
  });
  if (title && (nq.includes(title) || title.includes(nq))) score += 14;
  if (q && (nq.includes(q) || q.includes(nq))) score += 10;
  if (/区别|比较|对比|vs/.test(nq) && /vs|比较|区别|对比/.test(f.title || '')) score += 12;
  return score;
}

function agentScorer(cycle) {
  const probes = [
    '绿矾与摩尔盐区别',
    '为什么用摩尔盐而不是绿矾',
    '莫尔盐和绿矾哪个稳定',
    '产物烘干温度是多少',
    '为什么要避光保存'
  ];
  console.log(`[Cycle ${cycle}] 丙(Scorer): 本地 FAQ 检索评分`);
  probes.forEach(query => {
    const ranked = FAQ.map(f => ({ f, score: scoreFAQ(query, f) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const top = ranked[0];
    console.log('  ' + query + ' -> ' + (top && top.score ? top.f.title + ' (' + top.score + ')' : '(无命中)'));
  });
}

const apply = process.argv.includes('--apply');
for (let cycle = 1; cycle <= 3; cycle++) {
  console.log('\n===== Agent Cluster Cycle ' + cycle + ' =====');
  const train = agentTrainer(cycle);
  agentGenerator(cycle, apply);
  agentValidator(cycle);
  agentScorer(cycle);
  if (cycle === 3 && train.length) {
    console.log('建议：继续补充 keys/新增 FAQ 后重跑本脚本');
  }
}
