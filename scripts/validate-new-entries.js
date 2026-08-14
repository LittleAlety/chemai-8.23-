'use strict';
/**
 * v43 新条目校验：词表白名单 / subfield 规范 / corpus 引用有效 / 答案长度
 * 用法: node scripts/validate-new-entries.js
 */

const fs = require('fs');
const path = require('path');
const { CANONICAL_CATS } = require('./validate-faq.js');

function readJson(fp) {
  let r = fs.readFileSync(fp, 'utf8');
  if (r.charCodeAt(0) === 0xFEFF) r = r.slice(1);
  return JSON.parse(r);
}

const entries = readJson(path.join(__dirname, '..', 'Agent工作区', 'Agent-报告', 'v43_new_entries.json'));
const lex = readJson(path.join(__dirname, '..', 'data', 'academic_lexicon.json'));
const corpus = readJson(path.join(__dirname, '..', 'data', 'corpus.json'));

const canonSet = new Set(lex.flat.canonical_terms.map(s => s.toLowerCase()));
const entitySet = new Set(lex.flat.entity_terms.map(s => s.toLowerCase()));
const lexUnion = new Set([...canonSet, ...entitySet]);
const subSet = new Set(CANONICAL_CATS);
const corpusIds = new Set(corpus.entries.map(e => e.id));

let problems = 0;
entries.forEach((e, i) => {
  const tag = '[' + i + '] ' + (e.title || e.q || '?');
  // keys 必须在词表（canonical ∪ entity）
  const badKeys = (e.keys || []).filter(k => !lexUnion.has(k.toLowerCase()));
  if (badKeys.length) { problems++; console.log('❌ ' + tag + ' keys 不在词表: ' + JSON.stringify(badKeys)); }
  // ents 必须在 entity_terms
  const badEnts = (e.ents || []).filter(k => !entitySet.has(k.toLowerCase()));
  if (badEnts.length) { problems++; console.log('❌ ' + tag + ' ents 不在 entity_terms: ' + JSON.stringify(badEnts)); }
  // subfield
  if (!subSet.has(e.subfield)) { problems++; console.log('❌ ' + tag + ' subfield 非法: ' + e.subfield); }
  // corpus 引用
  const refs = (e.detail || '').match(/corpus\s*(\d+)/g) || [];
  for (const r of refs) {
    const id = parseInt(r.match(/\d+/)[0], 10);
    if (!corpusIds.has(id)) { problems++; console.log('❌ ' + tag + ' 越界 corpus 引用: ' + id); }
  }
  // 答案长度
  if (!e.answer || e.answer.length < 60) { problems++; console.log('❌ ' + tag + ' answer 过短 (' + (e.answer || '').length + '字)'); }
  if (!e.detail || e.detail.length < 30) { problems++; console.log('❌ ' + tag + ' detail 缺失'); }
  // keys 数量
  if (!e.keys || e.keys.length < 5) { problems++; console.log('❌ ' + tag + ' keys <5: ' + (e.keys || []).length); }
});

console.log('=== 新条目校验 ===');
console.log('条目数: ' + entries.length + ' | 问题数: ' + problems);
if (problems === 0) console.log('✓ 全部通过');
else process.exit(1);
