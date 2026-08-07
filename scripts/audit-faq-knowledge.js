'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const FAQ = readJSON('data/faq_unified.json');
const MANUAL = readJSON('data/manual.json');
const CORPUS = readJSON('data/corpus.json');
const CORPUS_IDS = new Set((CORPUS.entries || []).map(e => String(e.id)));
const MANUAL_SECTIONS = new Set();
(MANUAL.chapters || []).forEach(ch => (ch.sections || []).forEach(s => MANUAL_SECTIONS.add(s.id)));

const report = {
  total: FAQ.length,
  categories: {},
  missingDetail: [],
  shortAnswers: [],
  missingKeys: [],
  missingEnts: [],
  missingQ: [],
  duplicateTitles: [],
  duplicateKeys: [],
  duplicateAnswers: [],
  invalidCorpusRefs: [],
  invalidManualRefs: [],
  noSourceRefs: [],
  operationIssues: [],
  mojibake: []
};

const seenTitles = new Map();
const seenKeys = new Map();
const seenAnswers = new Map();

FAQ.forEach(item => {
  const title = item.title || item.q || '(untitled)';
  report.categories[item.subfield || '(无分类)'] = (report.categories[item.subfield || '(无分类)'] || 0) + 1;

  if (!item.detail || String(item.detail).trim().length < 20) {
    report.missingDetail.push(title);
  }
  const answerLen = String(item.answer || '').trim().length;
  if (answerLen < 60) {
    report.shortAnswers.push({ title, len: answerLen });
  }
  if (!Array.isArray(item.keys) || !item.keys.length) report.missingKeys.push(title);
  if (!Array.isArray(item.ents) || !item.ents.length) report.missingEnts.push(title);
  if (!item.q || !String(item.q).trim()) report.missingQ.push(title);
  if (/\uFFFD/.test(JSON.stringify(item))) report.mojibake.push(title);

  const titleKey = String(title || '').replace(/\s+/g, '').toLowerCase();
  if (seenTitles.has(titleKey)) report.duplicateTitles.push({ title, other: seenTitles.get(titleKey) });
  else seenTitles.set(titleKey, title);

  const keyKey = JSON.stringify((item.keys || []).slice().sort());
  if (seenKeys.has(keyKey)) report.duplicateKeys.push({ title, other: seenKeys.get(keyKey) });
  else seenKeys.set(keyKey, title);

  const ansKey = String(item.answer || '').replace(/\s+/g, '').toLowerCase();
  if (seenAnswers.has(ansKey)) report.duplicateAnswers.push({ title, other: seenAnswers.get(ansKey) });
  else seenAnswers.set(ansKey, title);

  (item.corpus_refs || []).forEach(ref => {
    const refs = String(ref).match(/(?:语料|文献)?#\s*(\d{1,4})/g) || [];
    refs.forEach(raw => {
      const id = String(Number(raw.replace(/[^\d]/g, '')));
      if (!CORPUS_IDS.has(id)) report.invalidCorpusRefs.push({ title, ref });
    });
  });

  const text = [item.answer, item.detail].filter(Boolean).join('\n');
  const manualRefs = text.matchAll(/manual(?:\.json)?\s*(?:ch(?:apter)?)?\s*(\d+)(?:[-_ ]?\s*s(?:ec(?:tion)?)?\s*(\d+))?/gi);
  for (const m of manualRefs) {
    const key = 'ch' + m[1] + '-s' + (m[2] || '');
    if (!MANUAL_SECTIONS.has(key) && !MANUAL_SECTIONS.has('ch' + m[1])) {
      report.invalidManualRefs.push({ title, ref: m[0] });
    }
  }

  const hasCorpus = Array.isArray(item.corpus_refs) && item.corpus_refs.length;
  const hasManual = Array.isArray(item.manual_refs) && item.manual_refs.length;
  if (!hasCorpus && !hasManual && !/manual(?:\.json)?|语料#|文献#|corpus/i.test(text)) {
    report.noSourceRefs.push(title);
  }

  const opChecks = [
    /110\s*[℃°]\s*(?:烘干|干燥|烘箱|烘)/,
    /30\s*%\s*(?:H2O2|过氧化氢|双氧水)/i,
    /(?:母液|溶液)[^。\n]{0,12}(?:1\s*[:：]\s*1|1\s*[:：]\s*2)(?!\.5)/,
    /50\s*[℃°][^。\n]{0,20}(?:烘干|干燥)[^。\n]{0,20}(?:1\s*[-—–~]?\s*2|1[-—–~]2)\s*(?:小时|h)/i,
    /10\s*[-—–~]?\s*15\s*mL/,
    /(?:25|2[05])\s*mL\s*(?:95\s*%|乙醇)/
  ];
  opChecks.forEach((re, idx) => {
    if (!re.test(text)) return;
    if (idx === 0 && /严禁|K₂C₂O₄|草酸钾|TGA|热重|恒重法|失结晶水|失水温度/.test(text)) return;
    if (idx === 1 && /需稀释|>30%|危险|非30%/.test(text)) return;
    report.operationIssues.push({ title, check: idx });
  });
});

const summary = {
  missingDetail: report.missingDetail.length,
  shortAnswers: report.shortAnswers.length,
  missingKeys: report.missingKeys.length,
  missingEnts: report.missingEnts.length,
  missingQ: report.missingQ.length,
  duplicateTitles: report.duplicateTitles.length,
  duplicateKeys: report.duplicateKeys.length,
  duplicateAnswers: report.duplicateAnswers.length,
  invalidCorpusRefs: report.invalidCorpusRefs.length,
  invalidManualRefs: report.invalidManualRefs.length,
  noSourceRefs: report.noSourceRefs.length,
  operationIssues: report.operationIssues.length,
  mojibake: report.mojibake.length
};

console.log('知识审计摘要:');
console.log(JSON.stringify(summary, null, 2));
console.log('\n分类分布:');
Object.entries(report.categories).sort((a, b) => b[1] - a[1]).forEach(([cat, n]) => console.log(String(n).padStart(4), cat));

console.log('\n缺失 detail 数量:', report.missingDetail.length);
console.log('前 40 条:', report.missingDetail.slice(0, 40).join(' | '));
console.log('\n短答案数量:', report.shortAnswers.length);
console.log(report.shortAnswers.slice(0, 40).map(x => x.title + '(' + x.len + ')').join(' | '));

const outPath = path.join(root, 'knowledge_audit_report.json');
fs.writeFileSync(outPath, JSON.stringify({ summary, report }, null, 2), 'utf8');
console.log('\n已写入:', outPath);
