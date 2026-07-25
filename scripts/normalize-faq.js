/**
 * 一次性脚本：归一化 faq_unified.json 的所有 subfield 值
 */
const { normalize, getCanonicalList } = require('./category-utils');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'faq_unified.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

let changed = 0;
const changes = [];
data.forEach((entry, i) => {
  const old = entry.subfield;
  const val = normalize(entry.subfield);
  if (val !== old) {
    changed++;
    changes.push({ i, q: entry.q, from: old, to: val });
    entry.subfield = val;
  }
});

console.log('Total entries:', data.length);
console.log('Changed:', changed);
if (changes.length > 0) {
  console.log('Changes:');
  changes.forEach(c => console.log('  [' + c.i + '] ' + JSON.stringify(c.q) + ': ' + c.from + ' -> ' + c.to));
}

// Count canonical distribution
const dist = {};
data.forEach(e => { dist[e.subfield] = (dist[e.subfield] || 0) + 1; });
console.log('\nFinal distribution:');
Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k + ': ' + v));

// Verify all values in canonical set
const canonSet = new Set(getCanonicalList());
const invalid = data.filter(e => !canonSet.has(e.subfield));
if (invalid.length > 0) {
  console.log('\nWARNING: ' + invalid.length + ' entries still have non-canonical subfield:');
  invalid.slice(0, 10).forEach(e => console.log('  ' + JSON.stringify(e.q) + ': ' + e.subfield));
} else {
  console.log('\nAll entries now use canonical subfield values!');
}

fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
console.log('\nWritten normalized faq_unified.json');
