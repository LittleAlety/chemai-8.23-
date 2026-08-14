'use strict';
/**
 * 补全 academic_lexicon.json 的 flat（去重全量）与 stats 字段。
 * 用法: node scripts/lexicon-finalize.js
 */

const fs = require('fs');
const path = require('path');
const FP = path.join(__dirname, '..', 'data', 'academic_lexicon.json');
let raw = fs.readFileSync(FP, 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
const lex = JSON.parse(raw);

const canon = [];
const entity = [];
const seenC = new Set();
const seenE = new Set();
const perSub = {};
for (const sf of Object.keys(lex.subfields)) {
  const b = lex.subfields[sf];
  const cs = b.canonical_terms || [];
  const es = b.entity_terms || [];
  perSub[sf] = { canonical: cs.length, entity: es.length };
  for (const t of cs) {
    const k = t.toLowerCase();
    if (!seenC.has(k)) { seenC.add(k); canon.push(t); }
  }
  for (const t of es) {
    const k = t.toLowerCase();
    if (!seenE.has(k)) { seenE.add(k); entity.push(t); }
  }
}

lex.flat = { canonical_terms: canon, entity_terms: entity };
lex.stats = {
  total_canonical: canon.length,
  total_entity: entity.length,
  per_subfield: perSub,
  subfield_count: Object.keys(lex.subfields).length
};

fs.writeFileSync(FP, JSON.stringify(lex, null, 2), 'utf8');

console.log('canonical_terms 总数: ' + canon.length);
console.log('entity_terms 总数: ' + entity.length);
console.log('覆盖子领域: ' + Object.keys(lex.subfields).length);
console.log('每子领域: ' + Object.entries(perSub).map(([k, v]) => k + '(' + v.canonical + 'c/' + v.entity + 'e)').join(' '));
