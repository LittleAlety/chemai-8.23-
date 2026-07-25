/**
 * 验证脚本：确认所有文件的分类值都在 categories.json canonical 列表中
 */
const { normalize, getCanonicalList, CATEGORIES } = require('./category-utils');
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const canonSet = new Set(getCanonicalList());
let allPassed = true;

function checkFile(filename, field, getEntries) {
  const filePath = path.join(BASE, filename);
  if (!fs.existsSync(filePath)) {
    console.log('  SKIP (not found): ' + filename);
    return;
  }

  let raw = fs.readFileSync(filePath, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const data = JSON.parse(raw);
  const entries = getEntries(data);

  const invalid = [];
  entries.forEach((entry, i) => {
    const val = entry[field];
    if (val && typeof val === 'string' && !canonSet.has(val)) {
      invalid.push({ i, q: entry.q || entry.title || entry.topic || entry.id, val });
    }
  });

  if (invalid.length > 0) {
    console.log('  FAIL: ' + filename + ' - ' + invalid.length + ' non-canonical ' + field + ' values:');
    invalid.slice(0, 10).forEach(v => console.log('    [' + v.i + '] ' + JSON.stringify(v.q) + ': ' + v.val));
    allPassed = false;
  } else {
    console.log('  PASS: ' + filename + ' (' + entries.length + ' entries, all ' + field + ' values canonical)');
  }
}

console.log('=== Category Verification ===\n');
console.log('Canonical categories: ' + JSON.stringify(getCanonicalList()));
console.log('');

// Data files
console.log('--- Data Files ---');
checkFile('data/faq_unified.json', 'subfield', d => d);
checkFile('data/corpus.json', 'subfield', d => d.entries);

// Question files (统一使用总集)
console.log('\n--- Question Files ---');
const qFiles = [
  'data/questions_master.json',
];

qFiles.forEach(f => {
  checkFile(f, 'category', d => {
    if (Array.isArray(d)) return d;
    if (d.questions) return d.questions;
    if (d.entries) return d.entries;
    return [];
  });
});

// Check category-utils.js itself works correctly
console.log('\n--- Normalizer Self-Test ---');
const tests = [
  ['合成制备', '合成制备'],
  ['安全废物', '安全与废物处理'],
  ['配位理论', '配位化学理论'],
  ['热化学分析', '热分析'],
  ['情景分析', '综合研究'],
  ['比较分析', '综合研究'],
  ['计算应用', '高等理论'],
  ['其他', '综合研究'],
  ['分析表征', '分析测定'],
  [null, '综合研究'],
  [undefined, '综合研究'],
  ['', '综合研究'],
  [true, '综合研究'],
];
let normOk = true;
tests.forEach(([input, expected]) => {
  const result = normalize(input);
  if (result !== expected) {
    console.log('  FAIL: normalize(' + JSON.stringify(input) + ') = ' + JSON.stringify(result) + ' (expected ' + JSON.stringify(expected) + ')');
    normOk = false;
    allPassed = false;
  }
});
if (normOk) console.log('  PASS: All normalizer tests passed');

// Summary
console.log('\n=== ' + (allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED') + ' ===');
process.exit(allPassed ? 0 : 1);
