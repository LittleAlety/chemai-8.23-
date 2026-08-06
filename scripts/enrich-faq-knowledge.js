'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const FAQ_PATH = path.join(root, 'data', 'faq_unified.json');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const FAQ = readJSON('data/faq_unified.json');
const MANUAL = readJSON('data/manual.json');
const CORPUS = readJSON('data/corpus.json');

const terms = value => {
  const s = String(value || '').toLowerCase();
  const out = new Set();
  for (const m of s.matchAll(/[\u4e00-\u9fa5]{2,4}/g)) out.add(m[0]);
  for (const m of s.matchAll(/[a-z0-9]{2,}/g)) out.add(m[0]);
  return Array.from(out);
};

const scoreText = (haystack, queryTerms) => {
  const s = String(haystack || '').toLowerCase();
  let score = 0;
  queryTerms.forEach(t => {
    if (s.includes(t)) score += t.length >= 3 ? 3 : 1;
  });
  return score;
};

const corpusEntries = CORPUS.entries || [];
const manualSections = [];
(MANUAL.chapters || []).forEach(ch => (ch.sections || []).forEach(s => manualSections.push({ id: s.id, title: s.title, content: s.content })));

function bestCorpus(item) {
  const qTerms = terms(item.title + ' ' + item.q);
  let best = null;
  corpusEntries.forEach(e => {
    const score = scoreText([e.title, e.abstract, e.objects, e.methods, e.content, (e.questions || []).join(' ')].join(' '), qTerms);
    if (score > (best ? best.score : 0)) best = { score, entry: e };
  });
  return best && best.score >= 3 ? best.entry : null;
}

function bestManual(item) {
  const qTerms = terms(item.title + ' ' + item.q);
  let best = null;
  manualSections.forEach(s => {
    const score = scoreText(s.title + ' ' + s.content, qTerms);
    if (score > (best ? best.score : 0)) best = { score, section: s };
  });
  return best && best.score >= 3 ? best.section : null;
}

const snippet = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 220);

let entsFixed = 0;
let detailFixed = 0;
let corpusRefsFixed = 0;
let manualRefsFixed = 0;
let dupKeysFixed = 0;

FAQ.forEach(item => {
  if (!Array.isArray(item.ents) || !item.ents.length) {
    const derived = terms(item.title || '').filter(t => /[\u4e00-\u9fa5]/.test(t)).slice(0, 3);
    if (derived.length) {
      item.ents = derived;
      entsFixed++;
    }
  }

  const needDetail = !item.detail || String(item.detail).trim().length < 20 || String(item.answer || '').trim().length < 60;
  const corpus = bestCorpus(item);
  const manual = bestManual(item);

  if (needDetail) {
    if (corpus) {
      item.detail = '文献补充：' + snippet(corpus.abstract || corpus.content || corpus.objects || corpus.methods) +
        '（来源：语料#' + corpus.id + '《' + corpus.title + '》）';
      detailFixed++;
    } else if (manual) {
      item.detail = '手册补充：' + snippet(manual.content) + '（来源：' + manual.id + '）';
      detailFixed++;
    }
  }

  if (!Array.isArray(item.corpus_refs) || !item.corpus_refs.length) {
    if (corpus) {
      item.corpus_refs = ['语料#' + corpus.id + ': ' + corpus.title];
      corpusRefsFixed++;
    }
  }

  if (!Array.isArray(item.manual_refs)) item.manual_refs = [];
  if (manual && !item.manual_refs.includes(manual.id)) {
    item.manual_refs.push(manual.id);
    manualRefsFixed++;
  }

  if (item.title === '蓝晒法的化学原理') {
    const add = ['化学原理', '感光原理', '反应机理', '为什么能成像'];
    add.forEach(k => { if (!(item.keys || []).includes(k)) { item.keys.push(k); dupKeysFixed++; } });
  }
  if (item.title === '蓝晒法的主要试剂') {
    const add = ['主要试剂', '感光液配方', '试剂配比', '铁氰化钾'];
    add.forEach(k => { if (!(item.keys || []).includes(k)) { item.keys.push(k); dupKeysFixed++; } });
  }
});

fs.writeFileSync(FAQ_PATH, JSON.stringify(FAQ, null, 2), 'utf8');
console.log('entsFixed', entsFixed);
console.log('detailFixed', detailFixed);
console.log('corpusRefsFixed', corpusRefsFixed);
console.log('manualRefsFixed', manualRefsFixed);
console.log('dupKeysFixed', dupKeysFixed);
