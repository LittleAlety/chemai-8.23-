/**
 * 一次性脚本：归一化 corpus.json 的 subfield 值和 subfields 数组
 */
const { normalize, getCanonicalList } = require('./category-utils');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'corpus.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

let changed = 0;
const changes = [];

// 归一化每个 entry 的 subfield
data.entries.forEach((entry, i) => {
  const old = entry.subfield;
  const val = normalize(entry.subfield);
  if (val !== old) {
    changed++;
    changes.push({ i, title: entry.title, from: old, to: val });
    entry.subfield = val;
  }
});

// 归一化顶部 subfields 数组
const oldSubfields = data.subfields ? data.subfields.slice() : [];
const newSubfieldsSet = new Set();
data.entries.forEach(e => { if (e.subfield) newSubfieldsSet.add(e.subfield); });
const newSubfields = Array.from(newSubfieldsSet).sort();
data.subfields = newSubfields;

console.log('Total entries:', data.entries.length);
console.log('Changed entries:', changed);
if (changes.length > 0) {
  console.log('Changes:');
  changes.forEach(c => console.log('  [' + c.i + '] ' + JSON.stringify(c.title) + ': ' + c.from + ' -> ' + c.to));
}

console.log('\nOld subfields array:', JSON.stringify(oldSubfields));
console.log('New subfields array:', JSON.stringify(newSubfields));

// Verify all values in canonical set
const canonSet = new Set(getCanonicalList());
const invalid = data.entries.filter(e => !canonSet.has(e.subfield));
if (invalid.length > 0) {
  console.log('\nWARNING: ' + invalid.length + ' entries still have non-canonical subfield:');
  invalid.slice(0, 10).forEach(e => console.log('  ' + JSON.stringify(e.title) + ': ' + e.subfield));
} else {
  console.log('\nAll entries now use canonical subfield values!');
}

fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
console.log('\nWritten normalized corpus.json');
