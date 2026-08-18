'use strict';
/** v45 轮次处理：读条目→并入词表→校验→插入 assistant.html
 *  用法: node scripts/v45-round.js <entries.json>
 */
const fs = require('fs');
const path = require('path');
const { readFAQRuntime, writeFAQRuntime } = require('./lib-assistant-faq.js');
const { CANONICAL_CATS } = require('./validate-faq.js');

const ENTRY = process.argv[2];
if (!ENTRY) { console.error('用法: node scripts/v45-round.js <entries.json>'); process.exit(1); }

function readJson(fp) {
  let r = fs.readFileSync(fp, 'utf8');
  if (r.charCodeAt(0) === 0xFEFF) r = r.slice(1);
  return JSON.parse(r);
}

const entries = readJson(ENTRY);
const lexFile = path.join(__dirname, '..', 'data', 'academic_lexicon.json');
const lex = readJson(lexFile);
const corpus = readJson(path.join(__dirname, '..', 'data', 'corpus.json'));
const corpusIds = new Set(corpus.entries.map(e => e.id));
const subSet = new Set(CANONICAL_CATS);

// 1. 并入词表（缺失词自动加入对应 subfield）
let added = 0;
for (const e of entries) {
  const b = lex.subfields[e.subfield];
  if (!b) { console.error('❌ 无 subfield 词表: ' + e.subfield); process.exit(1); }
  for (const k of e.keys || []) if (!b.canonical_terms.includes(k)) { b.canonical_terms.push(k); added++; }
  for (const k of e.ents || []) if (!b.entity_terms.includes(k)) { b.entity_terms.push(k); added++; }
}
// 重新计算 flat/stats
const canon = [], entity = [];
const seenC = new Set(), seenE = new Set();
const perSub = {};
for (const sf of Object.keys(lex.subfields)) {
  const b = lex.subfields[sf];
  perSub[sf] = { canonical: b.canonical_terms.length, entity: b.entity_terms.length };
  for (const t of b.canonical_terms) { const d = t.toLowerCase(); if (!seenC.has(d)) { seenC.add(d); canon.push(t); } }
  for (const t of b.entity_terms) { const d = t.toLowerCase(); if (!seenE.has(d)) { seenE.add(d); entity.push(t); } }
}
lex.flat = { canonical_terms: canon, entity_terms: entity };
lex.stats = { total_canonical: canon.length, total_entity: entity.length, per_subfield: perSub, subfield_count: Object.keys(lex.subfields).length };
fs.writeFileSync(lexFile, JSON.stringify(lex, null, 2), 'utf8');

// 2. 校验
const canonSet = new Set(canon.map(s => s.toLowerCase()));
const entitySet = new Set(entity.map(s => s.toLowerCase()));
const lexUnion = new Set([...canonSet, ...entitySet]);
let problems = 0;
entries.forEach((e, i) => {
  const tag = '[' + i + '] ' + (e.title || '?');
  const badKeys = (e.keys || []).filter(k => !lexUnion.has(k.toLowerCase()));
  if (badKeys.length) { problems++; console.log('❌ ' + tag + ' keys: ' + JSON.stringify(badKeys)); }
  const badEnts = (e.ents || []).filter(k => !entitySet.has(k.toLowerCase()));
  if (badEnts.length) { problems++; console.log('❌ ' + tag + ' ents: ' + JSON.stringify(badEnts)); }
  if (!subSet.has(e.subfield)) { problems++; console.log('❌ ' + tag + ' subfield: ' + e.subfield); }
  const refs = (e.detail || '').match(/corpus\s*(\d+)/g) || [];
  for (const r of refs) { const id = parseInt(r.match(/\d+/)[0], 10); if (!corpusIds.has(id)) { problems++; console.log('❌ ' + tag + ' 越界引用 ' + id); } }
  if (!e.answer || e.answer.length < 60) { problems++; console.log('❌ ' + tag + ' answer 过短'); }
  if (!e.keys || e.keys.length < 5) { problems++; console.log('❌ ' + tag + ' keys<5'); }
});
if (problems) { console.error('校验失败 ' + problems + ' 处'); process.exit(1); }

// 3. 插入 data/faq_runtime.js（v37.6+ 运行时唯一真相源）
const before = readFAQRuntime();
const insertEntries = entries.map(e => ({
  keys: e.keys, ents: e.ents, title: e.title, q: e.q, knode: '', subfield: e.subfield, answer: e.answer, detail: e.detail
}));
const after = before.concat(insertEntries);
if (after.length !== before.length + entries.length) { console.error('条目数不符'); process.exit(1); }
writeFAQRuntime(after);

console.log('=== v45 round ===');
console.log('词表新增: ' + added + ' (canonical=' + canon.length + ' entity=' + entity.length + ')');
console.log('插入条目: ' + entries.length + ' | FAQ: ' + before.length + ' → ' + after.length);
const bySub = {};
entries.forEach(e => { bySub[e.subfield] = (bySub[e.subfield] || 0) + 1; });
console.log('子领域: ' + JSON.stringify(bySub));
