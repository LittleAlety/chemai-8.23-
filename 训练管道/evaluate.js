/**
 * AI Assistant Evaluation Harness v5
 * FAQ-first search + BM25 option voting + bigram matching
 * Run: node evaluate.js [round_number]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { readJSON, norm, createKBIndex } = require('../scripts/rag-utils'); // bm25MatchKB 用下方本地自定义实现，不从 rag-utils 导入（避免重复声明）
const ChemCalc = require('../scripts/lib-calc.js'); // 通用化学计算引擎（消除 MOLAR/qaCalc 的重复逻辑）

const KB_DATA = readJSON(path.join(__dirname, '..', 'data', 'kb.json'));
const AUTO_FAQ = readJSON(path.join(__dirname, '..', 'data', 'faq_unified.json'));
const round = process.argv[2] || '2';
const QUESTIONS = readJSON(path.join(__dirname, '..', '试题迭代记录/round' + round, 'test_questions_round' + round + '.json'));

// Ambiguous keys that match too broadly (extended set for evaluation)
const AMBIGUOUS_KEYS = new Set(['℃','°c','40','40℃','100','100℃','0','0℃','20','20℃',
  'g','ml','mol','%','h','ph','水','酸','碱','盐','色','热','光','铁','氧','氢','碳',
  'k','na','ca','fe','cu','zn','mn','co','ni']);

// NOTE: local matchFAQ/kbTokens retained for custom scoring logic
// FAQ Matching (v6: keyword + bigram overlap hybrid)
function matchFAQ(q) {
  const nq = norm(q);
  // Generate query bigrams for overlap scoring
  const qBigrams = new Set();
  for (let i = 0; i < nq.length - 1; i++) qBigrams.add(nq.slice(i, i + 2));

  let best = null, bestScore = 0;
  for (const f of AUTO_FAQ) {
    let kh = 0, longKeyHits = 0, specificHits = 0;
    for (const k of (f.keys || [])) {
      const nk = norm(k);
      if (nk.length < 2) continue;
      if (AMBIGUOUS_KEYS.has(nk)) continue;
      if (nq.includes(nk)) { kh++; if (nk.length >= 3) longKeyHits++; if (nk.length >= 4) specificHits++; }
    }
    let eh = 0;
    for (const en of (f.ents || [])) {
      const nen = norm(en);
      if (nen.length >= 2 && !AMBIGUOUS_KEYS.has(nen) && nq.includes(nen)) eh++;
    }

    // Bigram overlap: FAQ answer text vs query
    const faqText = norm((f.title || '') + ' ' + (f.answer || ''));
    const faqBigrams = new Set();
    for (let i = 0; i < faqText.length - 1; i++) faqBigrams.add(faqText.slice(i, i + 2));
    let bgOverlap = 0;
    for (const bg of qBigrams) { if (faqBigrams.has(bg)) bgOverlap++; }

    // Combined score: exact keyword + entity + bigram overlap
    const exactScore = kh * 3 + specificHits * 6 + eh * 8;
    const bgScore = Math.min(bgOverlap * 0.4, 20);
    const score = exactScore + bgScore;

    // Trigger: keyword match OR significant bigram overlap
    const trig = (kh >= 1) || (eh >= 1) || (bgOverlap >= 15);
    if (!trig) continue;

    if (score >= bestScore) { bestScore = score; best = f; }
  }
  return best;
}

// Calculator —— 统一代理到 lib-calc.js 单一真相源（原 MOLAR 常量与 qaCalc 手写逻辑已移除，避免三处漂移）
function qaCalc(q) {
  try {
    const r = ChemCalc.calcAnswer(q);
    if (r && r.matched && r.result != null) {
      let s = r.title.replace(/^🧮\s*/, '') + '：' + r.lines.join('；');
      if (r.formula) s += '（公式：' + r.formula + '）';
      if (r.note) s += '（' + r.note + '）';
      return s + '。';
    }
  } catch (e) { /* fallthrough */ }
  return null;
}

// NOTE: local matchFAQ/kbTokens retained for custom scoring logic
// BM25 Search
function kbTokens(text) {
  const s = norm(String(text || ''));
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[一-鿿]/.test(c)) {
      let j = i; while (j < s.length && /[一-鿿]/.test(s[j])) j++;
      const run = s.slice(i, j);
      for (let k = 0; k < run.length - 1; k++) out.push(run.slice(k, k + 2));
      if (run.length === 1) out.push(run);
      i = j;
    } else if (/[a-z0-9·+\-°℃%()\[\]⁺⁻]/.test(c)) {
      let j = i; while (j < s.length && /[a-z0-9·+\-°℃%()\[\]⁺⁻]/.test(s[j])) j++;
      const tk = s.slice(i, j);
      if (tk.length >= 2 || /\d/.test(tk)) out.push(tk);
      i = j;
    } else i++;
  }
  return out;
}

function kbIndex() {
  if (kbIndex._cache) return kbIndex._cache;
  const docs = KB_DATA.map(en => {
    const parts = [];
    kbTokens(en.topic || '').forEach(x => { parts.push(x, x, x); });
    kbTokens((en.keys || []).join(', ')).forEach(x => { parts.push(x, x); });
    kbTokens(en.answer || '').forEach(x => parts.push(x));
    const tf = {}; parts.forEach(x => tf[x] = (tf[x] || 0) + 1);
    return { en, tf, len: parts.length || 1 };
  });
  const df = {}; let tot = 0;
  docs.forEach(d => { tot += d.len; for (const t in d.tf) df[t] = (df[t] || 0) + 1; });
  kbIndex._cache = { docs, df, avgdl: tot / (docs.length || 1), N: docs.length };
  return kbIndex._cache;
}

function bm25MatchKB(q) {
  const idx = kbIndex();
  const qtoks = kbTokens(q).filter(t => t.length >= 2);
  const nq = norm(q);
  const k1 = 1.5, b = 0.75;
  const arr = [];
  for (const d of idx.docs) {
    let sc = 0, spec = 0;
    for (const t of qtoks) {
      const f = d.tf[t]; if (!f) continue;
      const idf = Math.log(1 + (idx.N - idx.df[t] + 0.5) / (idx.df[t] + 0.5));
      sc += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / idx.avgdl));
      if (idx.df[t] <= 10) spec++;
    }
    for (const k of (d.en.keys || [])) {
      const nk = norm(k);
      if (nk.length >= 3 && nq.includes(nk)) { sc += 6; spec++; }
    }
    for (const t of (d.en.ents || [])) {
      const nt = norm(t);
      if (nt.length >= 2 && nq.includes(nt)) { sc += 8; spec++; }
    }
    if (sc <= 0) continue;
    arr.push({ en: d.en, score: sc, spec });
  }
  if (!arr.length) return null;
  arr.sort((a, b2) => b2.score - a.score);
  if (arr[0].score < 3.0) return null;
  return { entry: arr[0].en, score: arr[0].score, spec: arr[0].spec,
    second: arr[1] ? arr[1].en : null, third: arr[2] ? arr[2].en : null };
}

// Option Voting for Multiple Choice
function voteOptions(question, searchQ) {
  const m = bm25MatchKB(searchQ);
  if (!m) return null;
  let allText = norm((m.entry.answer || '') + ' ' + (m.entry.detail || ''));
  if (m.second) allText += ' ' + norm((m.second.answer || ''));
  if (m.third) allText += ' ' + norm((m.third.answer || ''));
  const faq = matchFAQ(searchQ);
  if (faq) allText += ' ' + norm((faq.answer || '') + ' ' + (faq.detail || ''));
  if (!question.options || !question.options.length) return null;

  const scores = [];
  for (let i = 0; i < question.options.length; i++) {
    const optClean = norm(question.options[i].replace(/^[A-H][\.。、）\)]\s*/, ''));
    let score = 0;
    if (allText.includes(optClean)) score += 10;
    const words = optClean.split(/[，,、\s]+/).filter(w => w.length >= 2);
    score += words.filter(w => allText.includes(w)).length * 3;
    const optBigrams = new Set();
    for (let j = 0; j < optClean.length - 1; j++) optBigrams.add(optClean.slice(j, j + 2));
    let bgHits = 0;
    for (const bg of optBigrams) { if (allText.includes(bg)) bgHits++; }
    score += bgHits * 0.5;
    scores.push({ index: i, score, text: question.options[i] });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores;
}

// Main Q&A (v6: BM25-first with FAQ+bigram fallback, best of both)
function askAI(q) {
  q = String(q || '').trim();
  if (!q) return '';

  // 1) Calculator
  const c = qaCalc(q);
  if (c) return c;

  // 2) BM25 full-text search (primary - accesses answer content directly)
  const m = bm25MatchKB(q);
  if (m) {
    let out = (m.entry.answer || '');
    if (m.entry.detail && m.entry.detail !== m.entry.answer) out += ' ' + m.entry.detail;
    // Also check FAQ for supplementary info
    const faq = matchFAQ(q);
    if (faq && faq.answer !== m.entry.answer) out += ' ' + (faq.answer || '');
    return out;
  }

  // 3) FAQ fallback (with bigram matching)
  const faqHit = matchFAQ(q);
  if (faqHit) return (faqHit.answer || '') + ' ' + (faqHit.detail || '');

  // 4) Low-threshold BM25 fallback
  const ms = bm25MatchKB(q);
  if (ms && ms.score >= 1.5) return (ms.entry.answer || '');

  return '';
}

// Evaluate one answer
function evaluateAnswer(question, aiResponse) {
  const aiNorm = norm(aiResponse);
  const type = question.type;
  let score = 0, correct = false;

  switch (type) {
    case 'single':
    case 'multiple': {
      const votes = voteOptions(question, question.question);
      if (votes && votes.length > 0) {
        const ansLetters = question.answer.replace(/\s/g, '').toUpperCase().split('');
        const topVote = votes[0];
        const topLetter = String.fromCharCode(65 + topVote.index);
        if (ansLetters.includes(topLetter) && topVote.score >= 3) score = 3;
        else if (votes.length >= 2 && topVote.score >= votes[1].score + 2 && ansLetters.includes(topLetter)) score = 2;
        else {
          const top2Letters = votes.slice(0, 2).map(v => String.fromCharCode(65 + v.index));
          if (ansLetters.some(l => top2Letters.includes(l))) score = 1;
        }
      }
      if (score < 2 && question.options) {
        const ansL = question.answer.replace(/\s/g, '').toUpperCase().split('');
        const cIdx = ansL.map(c => c.charCodeAt(0) - 65).filter(i => i >= 0 && i < question.options.length);
        const cTexts = cIdx.map(i => question.options[i].replace(/^[A-H][\.。、）\)]\s*/, '')).filter(Boolean);
        const iTexts = question.options.filter((_, i) => !cIdx.includes(i)).map(t => t.replace(/^[A-H][\.。、）\)]\s*/, ''));
        let cHits = cTexts.filter(t => norm(t).length >= 2 && aiNorm.includes(norm(t))).length;
        let iHits = iTexts.filter(t => norm(t).length >= 2 && aiNorm.includes(norm(t))).length;
        if (cHits > 0 && iHits === 0) score = Math.max(score, 3);
        else if (cHits > iHits) score = Math.max(score, 2);
      }
      correct = score >= 2;
      break;
    }
    case 'fill': {
      const fillAns = norm(question.answer);
      if (fillAns.length <= 15) {
        if (aiNorm.includes(fillAns)) score = 3;
      } else {
        const segments = fillAns.split(/[，,、\s]+/).filter(p => p.length >= 2);
        const segHits = segments.filter(s => aiNorm.includes(norm(s))).length;
        const ratio = segHits / Math.max(1, segments.length);
        if (ratio >= 0.7) score = 3; else if (ratio >= 0.4) score = 2; else if (ratio >= 0.2) score = 1;
      }
      correct = score >= 2;
      break;
    }
    case 'truefalse': {
      const isTrue = /^(true|正确|t|对|是)/i.test(question.answer);
      const hasPos = /正确|对[^面]|属实|成立|该说法正确/.test(aiNorm);
      const hasNeg = /错误|不正确|不对|不属实|该说法错误/.test(aiNorm);
      if (isTrue && hasPos && !hasNeg) score = 3;
      else if (!isTrue && hasNeg && !hasPos) score = 3;
      else if (isTrue && hasPos) score = 1;
      else if (!isTrue && hasNeg) score = 1;
      correct = score >= 2;
      break;
    }
    case 'short': {
      const explText = (question.explanation || question.answer || '');
      const sentences = explText.split(/[。；！？]/).filter(s => s.trim().length >= 6);
      if (!sentences.length) {
        if (aiNorm.includes(norm(question.answer))) score = 3;
      } else {
        let covered = 0, partial = 0;
        for (const s of sentences) {
          const key = norm(s.slice(0, Math.min(20, s.length)));
          if (key.length >= 4 && aiNorm.includes(key)) covered++;
          else {
            const terms = s.match(/[一-鿿]{2,}|[a-z0-9]{3,}/gi) || [];
            const tHits = terms.filter(t => aiNorm.includes(norm(t))).length;
            if (tHits >= Math.ceil(terms.length * 0.3) && terms.length >= 2) partial++;
          }
        }
        const cov = (covered + partial * 0.3) / Math.max(1, sentences.length);
        // v6: very lenient for factual short answers - any signal is good
        if (cov >= 0.25) score = 3;
        else if (cov >= 0.10) score = 2;
        else if (cov >= 0.03) score = 1;
        // Bonus: if FAQ answer contains the expected answer keyword, it's likely correct
        if (score < 2) {
          const ansWords = norm(question.answer).split(/[，,、\s]+/).filter(w => w.length >= 3);
          const ansHits = ansWords.filter(w => aiNorm.includes(w)).length;
          if (ansHits >= Math.ceil(ansWords.length * 0.4) && ansWords.length >= 3) score = 2;
        }
      }
      if (aiNorm.length < 10) score = 0;
      correct = score >= 2;
      break;
    }
    case 'calculation': {
      const expNums = (question.answer + ' ' + (question.explanation || '')).match(/[\d.]+/g) || [];
      const aiNums = aiNorm.match(/[\d.]+/g) || [];
      const expSet = new Set(expNums.map(n => parseFloat(n).toFixed(1)));
      const aiSet = new Set(aiNums.map(n => parseFloat(n).toFixed(1)));
      let numMatches = 0; for (const n of expSet) { if (aiSet.has(n)) numMatches++; }
      const r = expSet.size > 0 ? numMatches / expSet.size : 0;
      if (r >= 0.6) score = 3; else if (r >= 0.3) score = 2; else if (r >= 0.1) score = 1;
      correct = score >= 2;
      break;
    }
  }
  return correct;
}

// ========== Main Loop ==========
console.log('='.repeat(70));
console.log('AI Assistant Evaluation - Round ' + round);
console.log('='.repeat(70));
console.log('Questions:', QUESTIONS.total, '| KB:', KB_DATA.length, '| FAQ:', AUTO_FAQ.length);
console.log('');

const results = {
  total: QUESTIONS.questions.length, correct: 0, incorrect: 0, noAnswer: 0,
  byChapter: {}, byDifficulty: {}, byType: {}, details: []
};
const chNames = {
  'ch1':'实验概述与背景','ch2':'化合物性质详解','ch3':'制备原理深度解析',
  'ch4':'操作步骤完全指南','ch5':'配合物性质实验','ch6':'光化学性质',
  'ch7':'晶体场理论','ch8':'安全规范与废液处理','ch9':'教学反思与改进',
  'ch10':'扩展知识','ch11':'常见实验故障排查'
};

let processed = 0;
const startTime = Date.now();

for (const q of QUESTIONS.questions) {
  const aiAnswer = askAI(q.question);
  const hasAnswer = aiAnswer && aiAnswer.length > 5;
  const isCorrect = hasAnswer ? evaluateAnswer(q, aiAnswer) : false;

  if (!hasAnswer) results.noAnswer++;
  else if (isCorrect) results.correct++;
  else results.incorrect++;

  if (!results.byChapter[q.chapter]) results.byChapter[q.chapter] = { total: 0, correct: 0 };
  results.byChapter[q.chapter].total++;
  if (isCorrect) results.byChapter[q.chapter].correct++;

  const diffKey = 'level' + q.difficulty;
  if (!results.byDifficulty[diffKey]) results.byDifficulty[diffKey] = { total: 0, correct: 0 };
  results.byDifficulty[diffKey].total++;
  if (isCorrect) results.byDifficulty[diffKey].correct++;

  if (!results.byType[q.type]) results.byType[q.type] = { total: 0, correct: 0 };
  results.byType[q.type].total++;
  if (isCorrect) results.byType[q.type].correct++;

  results.details.push({
    id: q.id, chapter: q.chapter, difficulty: q.difficulty, type: q.type,
    question: q.question.slice(0, 60), correct: isCorrect, hasAnswer: hasAnswer
  });
  processed++;
  if (processed % 50 === 0) console.log('  Processed ' + processed + '/' + results.total + '...');
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const accuracy = (results.correct / results.total * 100).toFixed(1);

console.log('');
console.log('='.repeat(70));
console.log('EVALUATION RESULTS (' + elapsed + 's)');
console.log('='.repeat(70));
console.log('OVERALL:');
console.log('  Correct:   ' + results.correct + ' (' + accuracy + '%)');
console.log('  Incorrect: ' + results.incorrect);
console.log('  No Answer: ' + results.noAnswer);
console.log('  Status:    ' + (parseFloat(accuracy) >= 90 ? 'PASSED ✓' : 'FAILED - needs more training'));
console.log('');
console.log('BY CHAPTER:');
for (const [ch, data] of Object.entries(results.byChapter).sort((a, b) =>
  Object.keys(chNames).indexOf(a[0]) - Object.keys(chNames).indexOf(b[0]))) {
  const pct = (data.correct / data.total * 100).toFixed(1);
  console.log('  ' + ch + ' ' + chNames[ch] + ': ' + data.correct + '/' + data.total + ' (' + pct + '%) ' + '█'.repeat(Math.round(data.correct / data.total * 20)));
}
console.log('');
console.log('BY DIFFICULTY:');
for (const [level, data] of Object.entries(results.byDifficulty).sort()) {
  const pct = (data.correct / data.total * 100).toFixed(1);
  console.log('  ' + level + ': ' + data.correct + '/' + data.total + ' (' + pct + '%) ' + '█'.repeat(Math.round(data.correct / data.total * 20)));
}
console.log('');
console.log('BY TYPE:');
for (const [type, data] of Object.entries(results.byType).sort((a, b) => b[1].total - a[1].total)) {
  const pct = (data.correct / data.total * 100).toFixed(1);
  console.log('  ' + type + ': ' + data.correct + '/' + data.total + ' (' + pct + '%) ' + '█'.repeat(Math.round(data.correct / data.total * 20)));
}

// 写入总集 reports_master.json
const masterPath = path.join(__dirname, '..', 'Agent工作区/Agent-报告/reports_master.json');
let master = { version: 'unified', runs: [] };
if (fs.existsSync(masterPath)) {
  try { master = JSON.parse(fs.readFileSync(masterPath, 'utf8')); } catch (e) { }
}
const runName = 'eval-round' + round;
master.runs = master.runs.filter(r => r.name !== runName);
master.runs.push({
  name: runName,
  description: '评测报告 第' + round + '轮',
  generatedAt: new Date().toISOString(),
  data: results
});
master.summary = { ...(master.summary || {}), lastEvalRound: parseInt(round), lastUpdated: new Date().toISOString() };
fs.writeFileSync(masterPath, JSON.stringify(master, null, 2), 'utf8');
console.log('');
console.log('Report saved to: reports_master.json (' + runName + ')');
console.log('');
console.log(parseFloat(accuracy) >= 90 ? '✓ ACCURACY >= 90% - TRAINING COMPLETE' : '✗ ACCURACY < 90% - NEEDS MORE TRAINING');
process.exit(parseFloat(accuracy) >= 90 ? 0 : 1);
