/**
 * ChemAI 统一训练管线 (总集)
 * 整合原 run_10cycle_v2.js / run_4agents_200q.js / run_5cycle.js
 *
 * 四代理架构: 甲(Trainer)→乙(Generator)→丁(Validator)→丙(Scorer)
 * 所有结果写入总集 reports_master.json
 *
 * 用法:
 *   node run_pipeline.js                   — 默认: 1轮, 全17分类, 102题/轮
 *   node run_pipeline.js --cycles 10       — 10轮训练
 *   node run_pipeline.js --mode quick      — 快速模式 (50题/轮, 14分类, 轻量模型)
 *   node run_pipeline.js --mode full       — 完整模式 (102题/轮, 17分类, v4模型)
 *   node run_pipeline.js --mode single     — 单轮200题模式
 *   node run_pipeline.js --sync-html       — 额外同步FAQ到assistant.html
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = __dirname;
const API_KEY = process.env.DEEPSEEK_KEY || 'sk-cd6926d91adf4252a2529a9f9f3f1aef';
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

// ===== 配置 =====
const CONFIGS = {
  quick: {
    model: 'deepseek-chat', modelFlash: 'deepseek-chat',
    cycles: 10, questionsPerCycle: 50, rateMs: 300,
    excludedCats: ['蓝晒工艺', '摩尔盐相关', '草酸配合物'],
    description: '快速模式 — deepseek-chat, 50题/轮, 14分类'
  },
  full: {
    model: 'deepseek-v4-pro', modelFlash: 'deepseek-v4-flash',
    cycles: 10, questionsPerCycle: 102, rateMs: 200,
    excludedCats: [],
    description: '完整模式 — deepseek-v4, 102题/轮, 17分类全覆盖'
  },
  single: {
    model: 'deepseek-v4-pro', modelFlash: 'deepseek-v4-flash',
    cycles: 1, questionsPerCycle: 200, rateMs: 150,
    excludedCats: [],
    description: '单轮模式 — 200题, 17分类加权分配'
  }
};

// 解析命令行参数
function parseArgs() {
  const args = { mode: 'full', cycles: null, syncHtml: false };
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--mode' && process.argv[i + 1]) {
      args.mode = process.argv[++i];
    } else if (process.argv[i] === '--cycles' && process.argv[i + 1]) {
      args.cycles = parseInt(process.argv[++i]);
    } else if (process.argv[i] === '--sync-html') {
      args.syncHtml = true;
    }
  }
  return args;
}

const CLI = parseArgs();
const CFG = CONFIGS[CLI.mode] || CONFIGS.full;
if (CLI.cycles) CFG.cycles = CLI.cycles;

console.log('配置: ' + CFG.description);
console.log('周期: ' + CFG.cycles + ' | 模型: ' + CFG.model + ' | 速率: ' + CFG.rateMs + 'ms');

// ===== 数据加载 =====
function readJSON(fp) {
  let r = fs.readFileSync(fp, 'utf8');
  if (r.charCodeAt(0) === 0xFEFF) r = r.slice(1);
  return JSON.parse(r);
}

const FAQ = readJSON(path.join(BASE, 'data', 'faq_unified.json'));
const KB = readJSON(path.join(BASE, 'data', 'kb.json'));
const MANUAL = readJSON(path.join(BASE, 'data', 'manual.json'));
const CATS = readJSON(path.join(BASE, 'data', 'categories.json'));
const INITIAL_FAQ = FAQ.length;

// 活跃分类 (排除指定分类)
const ACTIVE_CATS = CATS.canonical.filter(c => !CFG.excludedCats.includes(c));

// ===== 分类→手册章节映射 =====
const CAT_CH_MAP = {
  '合成制备':        { ch: [3, 4], focus: '制备原理、操作步骤、投料比、产率计算' },
  '反应原理':        { ch: [3], focus: '氧化还原反应、配位反应方程式、反应机理、中间体' },
  '实验操作':        { ch: [4, 12], focus: '过滤、结晶、洗涤、干燥、称量、故障排查' },
  '分析测定':        { ch: [5], focus: '滴定分析、KMnO₄标定、含量测定、定量检测' },
  '光化学应用':      { ch: [6], focus: '光化学反应、LMCT、蓝晒、避光操作、量子产率' },
  '结构表征':        { ch: [2, 5], focus: 'UV-Vis、IR、XRD、晶体结构、颜色外观、晶系' },
  '磁性研究':        { ch: [5, 7], focus: '磁化率、磁矩、磁天平、顺磁/抗磁、高自旋d⁵' },
  '热分析':          { ch: [5], focus: 'TG-DSC、热分解、脱水温度、热稳定性、失重分析' },
  '安全与废物处理':  { ch: [8], focus: '安全规范、废液分类、回收处理、急救措施、MSDS' },
  '配位化学理论':    { ch: [7], focus: '晶体场理论、CFSE、高/低自旋、Jahn-Teller、光谱化学序' },
  '实验教学':        { ch: [9, 11], focus: '教学目标、思政素养、实验报告、考核方式' },
  '综合研究':        { ch: [10], focus: '跨章节综合、对比分析、扩展知识、前沿进展' },
  '化学史':          { ch: [1], focus: '配位化学发展史、诺贝尔奖、关键发现、奠基人物' },
  '高等理论':        { ch: [7, 10], focus: '量子化学计算、分子轨道、热力学参数、动力学模型' },
  '蓝晒工艺':        { ch: [6], focus: '蓝晒原理、光敏剂、曝光参数、显影定影、图像质量' },
  '摩尔盐相关':      { ch: [1, 3], focus: '莫尔盐制备、性质、纯度分析' },
  '草酸配合物':      { ch: [2, 3], focus: '草酸根配位模式、其他草酸配合物、对比研究' },
};

function catManualRef(cat) {
  const m = CAT_CH_MAP[cat]; if (!m) return '';
  const chs = MANUAL.chapters || [];
  return m.ch.map(n => {
    const c = chs[n - 1];
    return c ? '【' + c.title + '】\n' + (c.sections || []).map(s => s.title + ': ' + (s.content || '').slice(0, 300)).join('\n') : '';
  }).join('\n');
}

// ===== RAG Pipeline (共享) =====
const SUBMAP = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '⁻': '-', '⁺': '+' };
const norm = s => String(s || '').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => SUBMAP[c] || c).replace(/\s+/g, '');
const AMB = new Set(['℃', '°c', '40', '40℃', '100', '100℃', '0', '0℃', '20', '20℃', 'g', 'ml', 'mol', '%', 'h', 'ph', '水', '酸', '碱', '盐', '色', '热', '光', '铁', '氧', '氢', '碳']);

function matchFAQ(q) {
  const nq = norm(q); let best = null, bs = 0;
  const qbg = new Set(); for (let i = 0; i < nq.length - 1; i++) qbg.add(nq.slice(i, i + 2));
  for (const f of FAQ) {
    let kh = 0, sh = 0;
    for (const k of (f.keys || [])) { const nk = norm(k); if (nk.length < 2 || AMB.has(nk)) continue; if (nq.includes(nk)) { kh++; if (nk.length >= 4) sh++; } }
    let eh = 0; for (const en of (f.ents || [])) { if (norm(en).length >= 2 && nq.includes(norm(en))) eh++; }
    const ft = norm((f.title || '') + ' ' + (f.answer || '')); const fbg = new Set();
    for (let i = 0; i < ft.length - 1; i++) fbg.add(ft.slice(i, i + 2));
    let bg = 0; for (const b of qbg) { if (fbg.has(b)) bg++; }
    const sc = kh * 3 + sh * 6 + eh * 8 + Math.min(bg * 0.4, 15);
    if ((kh >= 1 || eh >= 1 || bg >= 15) && sc >= bs) { bs = sc; best = f; }
  }
  return best;
}

function kbTokens(text) {
  const s = norm(String(text || '')); const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[一-鿿]/.test(c)) { let j = i; while (j < s.length && /[一-鿿]/.test(s[j])) j++; const run = s.slice(i, j); for (let k = 0; k < run.length - 1; k++) out.push(run.slice(k, k + 2)); i = j; }
    else if (/[a-z0-9·+\-°℃%()\[\]⁺⁻]/.test(c)) { let j = i; while (j < s.length && /[a-z0-9·+\-°℃%()\[\]⁺⁻]/.test(s[j])) j++; const tk = s.slice(i, j); if (tk.length >= 2 || /\d/.test(tk)) out.push(tk); i = j; }
    else i++;
  }
  return out;
}

let BM25_IDX = null;
function kbIndex() {
  if (BM25_IDX) return BM25_IDX;
  const docs = KB.map(en => { const parts = []; kbTokens(en.topic || '').forEach(x => { parts.push(x, x, x); }); kbTokens((en.keys || []).join(', ')).forEach(x => { parts.push(x, x); }); kbTokens(en.answer || '').forEach(x => parts.push(x)); const tf = {}; parts.forEach(x => tf[x] = (tf[x] || 0) + 1); return { en, tf, len: parts.length || 1 }; });
  const df = {}; let tot = 0; docs.forEach(d => { tot += d.len; for (const t in d.tf) df[t] = (df[t] || 0) + 1; });
  BM25_IDX = { docs, df, avgdl: tot / (docs.length || 1), N: docs.length }; return BM25_IDX;
}

function bm25MatchKB(q) {
  const idx = kbIndex(); const qtoks = kbTokens(q).filter(t => t.length >= 2); const nq = norm(q); const k1 = 1.5, b = 0.75; const arr = [];
  for (const d of idx.docs) { let sc = 0; for (const t of qtoks) { const f = d.tf[t]; if (!f) continue; const idf = Math.log(1 + (idx.N - idx.df[t] + 0.5) / (idx.df[t] + 0.5)); sc += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / idx.avgdl)); } for (const k of (d.en.keys || [])) { const nk = norm(k); if (nk.length >= 3 && nq.includes(nk)) sc += 6; } for (const t of (d.en.ents || [])) { const nt = norm(t); if (nt.length >= 2 && nq.includes(nt)) sc += 8; } if (sc <= 0) continue; arr.push({ en: d.en, score: sc }); }
  if (!arr.length) return null; arr.sort((a, b2) => b2.score - a.score); if (arr[0].score < 3.0) return null;
  return { entry: arr[0].en, score: arr[0].score, second: arr[1] ? arr[1].en : null };
}

function buildContext(q) {
  const parts = [];
  const faq = matchFAQ(q);
  if (faq) parts.push('【FAQ · ' + faq.title + '】\n' + (faq.answer || '') + (faq.detail ? '\n' + faq.detail : ''));
  const m = bm25MatchKB(q);
  if (m) { parts.push('【KB · ' + m.entry.topic + '】\n' + (m.entry.answer || '')); if (m.second && m.second.topic) parts.push('【KB补充 · ' + m.second.topic + '】\n' + (m.second.answer || '')); }
  parts.push('【实验关键参数】莫尔盐M=392.14g/mol | 产物M=491.25g/mol | 标准5.0g莫尔盐→理论6.26g | 氧化40℃ | 结晶水失重110℃ | 草酸pKa1=1.25 pKa2=4.27 | H2O2 φ°=+1.77V | Fe3+/Fe2+ φ°=+0.771V | [Fe(C2O4)3]3- lgKf≈20.2 | 高自旋d5 μeff≈5.92BM');
  return parts.join('\n\n---\n\n');
}

// ===== API 调用 =====
function callLLM(systemPrompt, userMessage, maxTokens = 600, temperature = 0.3, retries = 2, useFlash = false) {
  const model = useFlash ? CFG.modelFlash : CFG.model;
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const body = JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }], max_tokens: maxTokens, temperature });
      const req = https.request(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY } }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(d);
            if (json.choices && json.choices[0]) resolve(json.choices[0].message.content);
            else if (json.error) {
              if (n < retries) { setTimeout(() => attempt(n + 1), 2000); }
              else reject(new Error('API error: ' + JSON.stringify(json.error)));
            } else reject(new Error('Unexpected: ' + d.slice(0, 200)));
          } catch (e) {
            if (n < retries) { setTimeout(() => attempt(n + 1), 2000); }
            else reject(new Error('Parse: ' + e.message));
          }
        });
      });
      req.on('error', e => { if (n < retries) setTimeout(() => attempt(n + 1), 2000); else reject(e); });
      req.setTimeout(180000, () => { req.destroy(); if (n < retries) setTimeout(() => attempt(n + 1), 2000); else reject(new Error('Timeout')); });
      req.write(body); req.end();
    };
    attempt(0);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractJSON(text) {
  try { return JSON.parse(text); } catch (e) { }
  const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (m) {
    try { return JSON.parse(m[0]); } catch (e2) {
      let fixed = m[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/\n/g, '\\n').replace(/\r/g, '');
      try { return JSON.parse(fixed); } catch (e3) { }
    }
  }
  return null;
}

// ===== 甲: Trainer =====
async function agentTrainer(cycleNum, prevScores) {
  console.log('\n' + '='.repeat(60));
  console.log('C' + cycleNum + ' 甲 (Trainer): 分析FAQ缺口...');

  const dist = {}; FAQ.forEach(e => { dist[e.subfield] = (dist[e.subfield] || 0) + 1; });
  const zeroCats = CATS.canonical.filter(c => !dist[c]);
  const thinCats = CATS.canonical.filter(c => dist[c] && dist[c] < 15);
  const allCatStatus = CATS.canonical.map(c => c + ':' + (dist[c] || 0) + '条').join(', ');

  const prevInfo = prevScores ? ('上轮平均分:' + prevScores.avgScore + ', 薄弱:' + JSON.stringify(prevScores.weakCategories || []).slice(0, 200)) : '首轮';

  const prompt = '你是ChemAI FAQ训练师。分析FAQ并提出改进。\n\n' +
    '【FAQ总条目】' + FAQ.length + '\n' +
    '【各分类覆盖】' + allCatStatus + '\n' +
    '【0覆盖分类】' + (zeroCats.length > 0 ? zeroCats.join(', ') : '无') + '\n' +
    '【薄弱分类(<15条)】' + thinCats.join(', ') + '\n' +
    '【分类体系】' + JSON.stringify(CATS.canonical) + '\n' +
    '【上轮反馈】' + prevInfo + '\n\n' +
    '输出JSON（只输出JSON）：\n' +
    '{"analysis":"分析","gapCategories":["分类1"],"fixes":[\n' +
    '  {"action":"new_entry","q":"问题","answer":"答案(100-300字)","subfield":"分类名","title":"标题","detail":"细节(50-200字)","keys":["k1","k2","k3","k4","k5"],"ents":["e1","e2"]},\n' +
    '  {"action":"enrich_answer","q":"已有问题原文","new_value":"更完整答案"},\n' +
    '  {"action":"add_detail","q":"已有问题原文","new_value":"补充detail"},\n' +
    '  {"action":"add_keys","q":"已有问题原文","new_value":["新关键词"]}\n' +
    ']}';

  const result = await callLLM('你是FAQ训练师。只输出JSON。', prompt, 6000, 0.4, 2, false);
  const parsed = extractJSON(result);
  if (parsed && parsed.analysis) {
    console.log('  分析: ' + parsed.analysis);
    console.log('  缺口: ' + JSON.stringify(parsed.gapCategories || []));
    console.log('  修复: ' + (parsed.fixes || []).length + ' 条');
    return parsed;
  }
  console.log('  解析失败，使用默认');
  return { analysis: 'parse error', gapCategories: zeroCats.length > 0 ? zeroCats : thinCats.slice(0, 5), fixes: [] };
}

function applyFixes(fixes) {
  let applied = 0, newE = 0, enriched = 0, det = 0, keysAdd = 0;
  if (!Array.isArray(fixes)) return { applied: 0, newEntries: 0, enriched: 0, details: 0, keysAdded: 0 };

  fixes.forEach(fix => {
    if (!fix || !fix.action) return;
    if (fix.action === 'new_entry') {
      let newEntry;
      if (typeof fix.new_value === 'string') {
        try { newEntry = JSON.parse(fix.new_value); } catch (e) { }
      } else if (typeof fix.new_value === 'object') {
        newEntry = fix.new_value;
      }
      if (!newEntry && fix.q && fix.answer) {
        newEntry = { q: fix.q, answer: fix.answer, subfield: fix.subfield || '综合研究', title: fix.title || fix.q, keys: fix.keys || [], ents: fix.ents || [], detail: fix.detail || '' };
      }
      if (newEntry && newEntry.q && newEntry.answer && !FAQ.find(e => e.q === newEntry.q)) {
        let sf = newEntry.subfield || '综合研究';
        if (CATS.aliases[sf]) sf = CATS.aliases[sf];
        if (!CATS.canonical.includes(sf)) sf = '综合研究';
        FAQ.push({ q: newEntry.q, title: newEntry.title || newEntry.q, answer: newEntry.answer, subfield: sf, keys: (newEntry.keys || []).slice(0, 15), ents: (newEntry.ents || []).slice(0, 8), detail: newEntry.detail || '', knode: '' });
        applied++; newE++;
      }
    } else if (fix.action === 'enrich_answer') {
      const e = FAQ.find(e => e.q === fix.q); if (!e) return;
      if (fix.new_value && typeof fix.new_value === 'string' && fix.new_value.length > (e.answer || '').length) { e.answer = fix.new_value; applied++; enriched++; }
    } else if (fix.action === 'add_detail') {
      const e = FAQ.find(e => e.q === fix.q); if (!e) return;
      if (fix.new_value && typeof fix.new_value === 'string') { if (!e.detail || fix.new_value.length > e.detail.length) { e.detail = fix.new_value; applied++; det++; } }
    } else if (fix.action === 'add_keys') {
      const e = FAQ.find(e => e.q === fix.q); if (!e) return;
      if (Array.isArray(fix.new_value) && fix.new_value.length > 0) {
        const ex = new Set((e.keys || []).map(k => k.toLowerCase()));
        const toAdd = fix.new_value.filter(k => !ex.has(String(k).toLowerCase()));
        if (toAdd.length > 0) { e.keys = [...(e.keys || []), ...toAdd]; applied++; keysAdd++; }
      }
    }
  });
  return { applied, newEntries: newE, enriched, details: det, keysAdded: keysAdd };
}

// ===== 乙: Generator =====
async function agentGenerator(cycleNum) {
  const categories = ACTIVE_CATS;
  console.log('\n' + '='.repeat(60));

  if (CFG.mode === 'single') {
    // 200题加权分配模式
    return await generatorWeighted(categories);
  }

  // 标准模式: 每分类等量出题
  const PER_CAT = Math.max(1, Math.floor(CFG.questionsPerCycle / categories.length));
  console.log('C' + cycleNum + ' 乙 (Generator): ' + categories.length + '分类, 目标' + (categories.length * PER_CAT) + '题...');

  const allQ = [];
  for (let cIdx = 0; cIdx < categories.length; cIdx++) {
    const category = categories[cIdx];
    const manualRef = catManualRef(category);
    const catFAQCount = FAQ.filter(e => e.subfield === category).length;
    const mapping = CAT_CH_MAP[category] || { ch: [], focus: '' };

    const prompt = '你是ChemAI出题官。为三草酸合铁(III)酸钾制备实验的【' + category + '】分类生成' + PER_CAT + '道精准题目。\n\n' +
      '【分类说明】' + (mapping.focus || '综合考察') + '\n' +
      '【FAQ已有】' + catFAQCount + '条\n' +
      '【手册参考】\n' + manualRef.slice(0, 2000) + '\n\n' +
      '【题型】填空(fill)×' + Math.max(1, Math.floor(PER_CAT * 0.35)) + ', 简答(short)×' + Math.max(1, Math.floor(PER_CAT * 0.35)) + ', 单选(single)×' + Math.max(1, Math.floor(PER_CAT * 0.2)) + ', 计算(calculation)×' + Math.max(1, Math.floor(PER_CAT * 0.1)) + '\n' +
      '【难度】基础×' + Math.ceil(PER_CAT * 0.35) + ', 中等×' + Math.ceil(PER_CAT * 0.45) + ', 较难×' + Math.floor(PER_CAT * 0.2) + '\n' +
      '输出JSON数组（只输出JSON）：\n' +
      '[{"question":"题目","category":"' + category + '","type":"fill","difficulty":"基础","answer":"标准答案","explanation":"解析(含手册章节)"}]';

    let success = false;
    for (let att = 0; att < 3 && !success; att++) {
      try {
        const result = await callLLM('你是化学出题官。只输出JSON数组。', prompt, 8000, 0.5, 2, false);
        const parsed = extractJSON(result);
        if (parsed && Array.isArray(parsed) && parsed.length >= Math.floor(PER_CAT * 0.5)) {
          parsed.forEach(q => { q._cycle = cycleNum; q._batch = cIdx + 1; if (!CATS.canonical.includes(q.category)) q.category = category; });
          allQ.push(...parsed);
          success = true;
          process.stdout.write('\r  [' + (cIdx + 1) + '/' + categories.length + '] ' + category + ': ' + parsed.length + '题  ');
        } else if (att < 2) await sleep(1000);
      } catch (e) { if (att < 2) await sleep(1000); }
    }
    if (!success) console.log('\n  ⚠ ' + category + ' 生成失败');
    await sleep(CFG.rateMs);
  }
  console.log('\n  总生成: ' + allQ.length + ' 题');
  return allQ;
}

// 加权分配模式 (200题)
async function generatorWeighted(categories) {
  const TARGET = CFG.questionsPerCycle;
  const dist = {}; FAQ.forEach(e => { dist[e.subfield] = (dist[e.subfield] || 0) + 1; });
  const weights = {}; let totalWeight = 0;
  categories.forEach(c => { const cnt = dist[c] || 1; weights[c] = Math.max(6, Math.round(30 - Math.log2(cnt + 1) * 5)); totalWeight += weights[c]; });
  const perCat = {}; let allocated = 0;
  categories.forEach(c => { perCat[c] = Math.max(6, Math.round(weights[c] / totalWeight * TARGET)); allocated += perCat[c]; });
  const diff = TARGET - allocated;
  const sortedCats = [...categories].sort((a, b) => (dist[a] || 0) - (dist[b] || 0));
  for (let i = 0; i < Math.abs(diff); i++) { const idx = i % sortedCats.length; perCat[sortedCats[idx]] += (diff > 0 ? 1 : -1); }

  console.log('乙 (Generator): 加权分配' + TARGET + '题');
  categories.forEach(c => console.log('  ' + c + ': FAQ=' + (dist[c] || 0) + ' → ' + perCat[c] + '题'));

  let allQ = []; let total = 0;
  for (const category of categories) {
    const n = perCat[category]; if (n <= 0) continue;
    const manualRef = catManualRef(category);
    const prompt = '你是ChemAI出题官。为三草酸合铁(III)酸钾制备实验的【' + category + '】分类生成' + n + '道精准题目。\n\n' +
      '【手册参考】\n' + manualRef.slice(0, 2000) + '\n\n' +
      '【题型】填空(fill)×' + Math.max(2, Math.floor(n * 0.3)) + ', 简答(short)×' + Math.max(2, Math.floor(n * 0.35)) + ', 单选(single)×' + Math.max(1, Math.floor(n * 0.25)) + ', 计算(calculation)×' + Math.max(1, Math.floor(n * 0.1)) + '\n' +
      '【难度】基础×' + Math.ceil(n * 0.35) + ', 中等×' + Math.ceil(n * 0.45) + ', 较难×' + Math.floor(n * 0.2) + '\n' +
      '输出JSON数组（只输出JSON）：\n' +
      '[{"question":"题目","category":"' + category + '","type":"fill","difficulty":"基础","answer":"标准答案","explanation":"解析(含章节号)"}]';

    let success = false;
    for (let att = 0; att < 3 && !success; att++) {
      try {
        const result = await callLLM('你是化学出题官。只输出JSON数组。', prompt, 8000, 0.5, 2, false);
        const parsed = extractJSON(result);
        if (parsed && Array.isArray(parsed) && parsed.length >= Math.floor(n * 0.6)) {
          parsed.forEach(q => { q._category = category; });
          allQ.push(...parsed);
          success = true; total += parsed.length;
          process.stdout.write('\r  [' + total + '/' + TARGET + '] ' + category + ': ' + parsed.length + '题');
        } else if (att < 2) await sleep(1500);
      } catch (e) { if (att < 2) await sleep(1500); }
    }
    if (!success) console.log('\n  ⚠ ' + category + ' 生成失败');
    await sleep(CFG.rateMs);
  }
  console.log('\n  总生成: ' + allQ.length + ' 题');
  return allQ.slice(0, TARGET);
}

// ===== 丁: Validator =====
async function agentValidator(cycleNum, questions) {
  console.log('\n' + '='.repeat(60));
  console.log('C' + cycleNum + ' 丁 (Validator): 校验 ' + questions.length + ' 题...');
  if (!questions.length) return [];

  const validations = []; const BATCH = 10;
  for (let i = 0; i < questions.length; i += BATCH) {
    const batch = questions.slice(i, i + BATCH);
    const qText = batch.map((q, j) => '[' + (j + 1) + '] ' + (q.category || q._category || '') + ' | Q:' + q.question + '\n   A:' + (q.answer || '').slice(0, 150)).join('\n\n');
    const batchCats = [...new Set(batch.map(q => q.category || q._category).filter(Boolean))];
    const refs = batchCats.map(c => catManualRef(c)).filter(Boolean).join('\n---\n').slice(0, 4000);

    try {
      const result = await callLLM('你是化学内容校验官。只输出JSON数组。',
        '【手册】\n' + refs + '\n\n【待校验】\n' + qText + '\n\n输出JSON：[{"index":题号,"valid":true/false,"issue":"问题或写无","correction":"修正或写无","manualRef":"手册章节"}]',
        5000, 0.2, 2, false);
      const parsed = extractJSON(result);
      if (parsed && Array.isArray(parsed)) {
        parsed.forEach(r => {
          if (r.index !== undefined && r.valid !== undefined) {
            const qi = i + parseInt(r.index) - 1;
            if (qi >= 0 && qi < questions.length) validations.push({ index: qi, question: questions[qi].question.slice(0, 80), category: questions[qi].category || questions[qi]._category, ...r });
          }
        });
      }
    } catch (e) { /* skip */ }
    await sleep(CFG.rateMs);
    process.stdout.write('\r  校验: ' + Math.min(i + BATCH, questions.length) + '/' + questions.length);
  }
  const vc = validations.filter(v => v.valid).length;
  const ic = validations.filter(v => !v.valid).length;
  console.log('\n  有效:' + vc + ' | 有问题:' + ic + ' (' + (validations.length > 0 ? Math.round(vc / validations.length * 100) : 0) + '%)');
  return validations;
}

// ===== 丙: Scorer =====
async function agentScorer(cycleNum, questions) {
  console.log('\n' + '='.repeat(60));
  console.log('C' + cycleNum + ' 丙 (Scorer): RAG+LLM评分 ' + questions.length + ' 题...');
  if (!questions.length) return { scores: [], avgScore: 0, catScores: {}, weakCategories: [], apiErrors: 0, elapsed: 0 };

  const scores = []; let totalScore = 0; const catScores = {}; let apiErrors = 0; const t0 = Date.now();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]; const context = buildContext(q.question);
    let aiAnswer;
    try { aiAnswer = await callLLM('你是ChemAI助手。基于参考精准回答。标注来源。无参考说「知识清单未命中」。', context + '\n\n【问题】' + q.question, 800, 0.3, 2, true); } catch (e) { aiAnswer = '(ERROR)'; apiErrors++; }
    await sleep(CFG.rateMs);

    const judgePrompt = '评分AI回答。\n【问题】' + q.question + '\n【标准答案】' + (q.answer || '').slice(0, 250) + '\n【AI回答】' + (aiAnswer || '').slice(0, 500) + '\n\n4维度(各0-25)：1.事实准确性 2.完整性 3.来源引用 4.表述清晰度\n输出JSON：{"a":X,"c":X,"s":X,"l":X,"t":X,"brief":"评价"}';
    let score = { accuracy: 0, completeness: 0, source_usage: 0, clarity: 0, total: 0, brief_comment: '' };
    try {
      const raw = await callLLM('你是评分官。只输出JSON。', judgePrompt, 600, 0.2, 2, true);
      const parsed = extractJSON(raw);
      if (parsed) {
        score.accuracy = Math.max(0, Math.min(25, parseInt(parsed.a || parsed.accuracy) || 0));
        score.completeness = Math.max(0, Math.min(25, parseInt(parsed.c || parsed.completeness) || 0));
        score.source_usage = Math.max(0, Math.min(25, parseInt(parsed.s || parsed.source_usage) || 0));
        score.clarity = Math.max(0, Math.min(25, parseInt(parsed.l || parsed.clarity) || 0));
        score.total = score.accuracy + score.completeness + score.source_usage + score.clarity;
        score.brief_comment = String(parsed.brief || '');
      }
    } catch (e) { apiErrors++; }
    totalScore += score.total;
    const cat = q.category || q._category || '未分类';
    if (!catScores[cat]) catScores[cat] = { total: 0, count: 0 };
    catScores[cat].total += score.total; catScores[cat].count++;
    scores.push({ index: i, question: q.question.slice(0, 60), category: cat, score, aiAnswer: (aiAnswer || '').slice(0, 150) });
    await sleep(CFG.rateMs);
    const elapsed = Math.floor((Date.now() - t0) / 1000);
    const eta = i < questions.length - 1 ? Math.floor(elapsed / (i + 1) * (questions.length - i - 1)) : 0;
    if (i % 10 === 0 || i === questions.length - 1) process.stdout.write('\r  [' + (i + 1) + '/' + questions.length + '] avg=' + (totalScore / (i + 1)).toFixed(1) + ' | ' + elapsed + 's | ETA ' + eta + 's');
  }

  const avgScore = parseFloat((totalScore / questions.length).toFixed(2));
  const weakCategories = Object.entries(catScores).map(([cat, d]) => ({ category: cat, avg: parseFloat((d.total / d.count).toFixed(1)), count: d.count })).sort((a, b) => a.avg - b.avg);
  console.log('\n  均分:' + avgScore + ' | 最弱: ' + weakCategories.slice(0, 3).map(c => c.category + '(' + c.avg + ')').join(', '));
  return { scores, avgScore, catScores, weakCategories, apiErrors, elapsed: Math.floor((Date.now() - t0) / 1000) };
}

// ===== HTML 同步 =====
function syncFAQtoHTML() {
  console.log('\n=== FAQ → HTML 同步 ===');
  let html = fs.readFileSync(path.join(BASE, 'assistant.html'), 'utf8');
  const faqStart = html.indexOf('const FAQ=[');
  const commentMarker = '/* FAQ 匹配：多关键词命中率';
  const commentPos = html.indexOf(commentMarker, faqStart);
  if (faqStart < 0 || commentPos < 0) { console.log('  ✗ 找不到FAQ位置'); return; }
  const before = html.slice(Math.max(0, commentPos - 40), commentPos);
  const bm = before.match(/\];\s*$/);
  if (!bm) { console.log('  ✗ 找不到FAQ数组结束'); return; }

  const escLocal = s => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
  let faqJS = 'const FAQ=[\n'; let cnt = 0;
  FAQ.forEach(entry => {
    const keys = (entry.keys || []).filter(k => k && String(k).length >= 2).slice(0, 15);
    const ents = (entry.ents || []).filter(e => e && String(e).length >= 2).slice(0, 5);
    const title = entry.title || '', answer = (entry.answer || '').slice(0, 500), detail = (entry.detail || '').slice(0, 800);
    if (!title || !answer || answer.length < 10) return;
    if (!keys.length && !ents.length) return;
    faqJS += ' {keys:' + JSON.stringify(keys) + ',ents:' + JSON.stringify(ents) + ",title:'" + escLocal(title) + "',q:'" + escLocal(entry.q || title) + "',knode:'" + (entry.knode || '') + "',subfield:'" + escLocal(entry.subfield || '综合研究') + "',answer:'" + escLocal(answer) + "',detail:'" + escLocal(detail) + "'},\n";
    cnt++;
  });
  faqJS += '];\r\r\n/* FAQ 匹配';
  const newHtml = html.slice(0, faqStart) + faqJS + html.slice(commentPos);
  fs.writeFileSync(path.join(BASE, 'assistant.html'), newHtml, 'utf8');
  console.log('  ✓ HTML已更新: ' + cnt + '条FAQ');
}

// ===== 总集报告更新 =====
function updateMasterReport(runData) {
  const MASTER_PATH = path.join(BASE, 'reports_master.json');
  let master;
  if (fs.existsSync(MASTER_PATH)) {
    try { master = readJSON(MASTER_PATH); } catch (e) { master = { version: 'unified', runs: [] }; }
  } else {
    master = { version: 'unified', runs: [] };
  }

  const runName = CLI.mode + '-' + Date.now().toString(36);
  master.runs.push({
    name: runName,
    description: CFG.description,
    generatedAt: new Date().toISOString(),
    ...runData
  });

  master.summary = {
    totalRuns: master.runs.length,
    lastRun: runName,
    lastUpdated: new Date().toISOString()
  };

  fs.writeFileSync(MASTER_PATH, JSON.stringify(master, null, 2), 'utf8');
  console.log('  报告已写入总集: reports_master.json (' + runName + ')');
}

// ===== MAIN =====
async function main() {
  const t0 = Date.now();
  console.log('='.repeat(60));
  console.log('ChemAI 统一训练管线');
  console.log('FAQ:' + FAQ.length + ' | KB:' + KB.length + ' | 分类:' + CATS.canonical.length + ' (活跃:' + ACTIVE_CATS.length + ')');
  console.log('模式: ' + CFG.description + ' | 周期: ' + CFG.cycles);
  console.log('='.repeat(60));

  const allCycles = [];
  let prevScores = null;

  for (let cycle = 1; cycle <= CFG.cycles; cycle++) {
    const cycleStart = Date.now();
    console.log('\n' + '#'.repeat(60));
    console.log('#### CYCLE ' + cycle + '/' + CFG.cycles + ' ####  [总运行' + Math.floor((Date.now() - t0) / 60000) + 'min]');
    console.log('#'.repeat(60));

    // 甲: Trainer
    const training = await agentTrainer(cycle, prevScores);
    const fixResult = applyFixes(training.fixes || []);
    console.log('  甲修复: ' + fixResult.applied + '条 (新' + fixResult.newEntries + ' 富' + fixResult.enriched + ' 详' + fixResult.details + ' 键' + fixResult.keysAdded + ')');
    fs.writeFileSync(path.join(BASE, 'data', 'faq_unified.json'), JSON.stringify(FAQ, null, 2), 'utf8');
    await sleep(CFG.rateMs);

    // 乙: Generator
    const questions = await agentGenerator(cycle);
    await sleep(CFG.rateMs);

    // 丁: Validator
    const validations = await agentValidator(cycle, questions);
    await sleep(CFG.rateMs);

    // 丙: Scorer
    const scoreResult = await agentScorer(cycle, questions);
    prevScores = scoreResult;

    // 周期数据
    const dist = {}; FAQ.forEach(e => { dist[e.subfield] = (dist[e.subfield] || 0) + 1; });
    const cycleData = {
      cycle, timestamp: new Date().toISOString(), cycleDurationMin: Math.floor((Date.now() - cycleStart) / 60000),
      training: { analysis: training.analysis, gapCategories: training.gapCategories, fixesProposed: (training.fixes || []).length, ...fixResult },
      generation: { questionCount: questions.length, categoriesCovered: [...new Set(questions.map(q => q.category || q._category))], sampleQuestions: questions.slice(0, 5).map(q => ({ q: q.question.slice(0, 80), cat: q.category || q._category, type: q.type, diff: q.difficulty })) },
      validation: { total: validations.length, valid: validations.filter(v => v.valid).length, invalid: validations.filter(v => !v.valid).length },
      scoring: { avgScore: scoreResult.avgScore, weakCategories: scoreResult.weakCategories.slice(0, 5), apiErrors: scoreResult.apiErrors, elapsed: scoreResult.elapsed },
      faqCount: FAQ.length, faqDistribution: dist, zeroCoverageCats: CATS.canonical.filter(c => !dist[c])
    };
    allCycles.push(cycleData);

    const zeroCats = CATS.canonical.filter(c => !dist[c]);
    console.log('\n  C' + cycle + ' 完成 [' + cycleData.cycleDurationMin + 'min]: FAQ=' + FAQ.length + ' (+' + (FAQ.length - INITIAL_FAQ) + ') Qs=' + questions.length + ' 分数=' + scoreResult.avgScore + (zeroCats.length > 0 ? ' ⚠0覆盖:' + zeroCats.join(',') : ' ✓'));
  }

  // 最终报告
  const totalMin = Math.floor((Date.now() - t0) / 60000);
  const finalDist = {}; FAQ.forEach(e => { finalDist[e.subfield] = (finalDist[e.subfield] || 0) + 1; });

  const finalReport = {
    version: CLI.mode,
    generatedAt: new Date().toISOString(),
    totalDurationMin: totalMin,
    totalCycles: CFG.cycles,
    initialFaqCount: INITIAL_FAQ,
    finalFaqCount: FAQ.length,
    faqGrowth: FAQ.length - INITIAL_FAQ,
    totalQuestionsGenerated: allCycles.reduce((s, c) => s + c.generation.questionCount, 0),
    finalDistribution: finalDist,
    zeroCoverageAtEnd: CATS.canonical.filter(c => !finalDist[c]),
    scoreProgression: allCycles.map(c => ({ cycle: c.cycle, avgScore: c.scoring.avgScore, faqCount: c.faqCount, questionCount: c.generation.questionCount })),
    cycles: allCycles
  };

  // 写入总集
  updateMasterReport(finalReport);

  // 保存FAQ
  fs.writeFileSync(path.join(BASE, 'data', 'faq_unified.json'), JSON.stringify(FAQ, null, 2), 'utf8');

  // HTML同步
  if (CLI.syncHtml) syncFAQtoHTML();

  console.log('\n' + '='.repeat(60));
  console.log('管线完成! 总耗时: ' + totalMin + 'min');
  console.log('FAQ: ' + INITIAL_FAQ + ' → ' + FAQ.length + ' (+' + (FAQ.length - INITIAL_FAQ) + ')');
  console.log('分数趋势: ' + allCycles.map(c => 'C' + c.cycle + ':' + c.scoring.avgScore).join(' → '));
  const finalZero = CATS.canonical.filter(c => !finalDist[c]);
  if (finalZero.length > 0) console.log('⚠ 仍有0覆盖分类: ' + finalZero.join(', '));
  else console.log('✓ 全部' + CATS.canonical.length + '个分类已覆盖!');
}

main().catch(e => { console.error('FATAL: ' + e.message + '\n' + e.stack); process.exit(1); });
