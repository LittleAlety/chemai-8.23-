/**
 * 归一化脚本：归一化所有试题文件的 category 值
 * 统一使用总集: data/questions_master.json
 */
const { normalize } = require('./category-utils');
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');

// 试题总集（所有分集已归入此文件）
const questionFiles = [
  'data/questions_master.json',
];

let totalChanged = 0;

questionFiles.forEach(filename => {
  const filePath = path.join(BASE, filename);
  if (!fs.existsSync(filePath)) {
    console.log('SKIP (not found): ' + filename);
    return;
  }

  let raw = fs.readFileSync(filePath, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // strip BOM

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.log('SKIP (parse error): ' + filename + ' - ' + e.message);
    return;
  }

  let entries;
  if (Array.isArray(data)) {
    entries = data;
  } else if (data.questions && Array.isArray(data.questions)) {
    entries = data.questions;
  } else if (data.entries && Array.isArray(data.entries)) {
    entries = data.entries;
  } else {
    console.log('SKIP (unknown structure): ' + filename);
    return;
  }

  let changed = 0;
  entries.forEach((entry, i) => {
    if (entry.category && typeof entry.category === 'string') {
      const old = entry.category;
      entry.category = normalize(old);
      if (entry.category !== old) changed++;
    }
  });

  if (changed > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log('UPDATED: ' + filename + ' (' + changed + ' entries normalized, ' + entries.length + ' total)');
    totalChanged += changed;
  } else {
    console.log('OK: ' + filename + ' (' + entries.length + ' entries, no changes needed)');
  }
});

console.log('\nTotal files changed: ' + totalChanged + ' entries across all files');
