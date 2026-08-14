'use strict';
/**
 * v43 新 FAQ 条目插入：把新条目数组写入 assistant.html 的 FAQ 数组末尾。
 * 用法: node scripts/insert-faq-entries.js <entries.json> [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { readHTML, extractFAQArray, parseFAQ } = require('./lib-assistant-faq.js');

const ENTRIES = process.argv[2];
const DRY = process.argv.includes('--dry-run');
if (!ENTRIES) { console.error('用法: node scripts/insert-faq-entries.js <entries.json> [--dry-run]'); process.exit(1); }

function readJson(fp) {
  let r = fs.readFileSync(fp, 'utf8');
  if (r.charCodeAt(0) === 0xFEFF) r = r.slice(1);
  return JSON.parse(r);
}

function jsStr(s) {
  return "'" + String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r') + "'";
}

function serialize(entries) {
  return entries.map(e => {
    const keys = JSON.stringify(e.keys || []);
    const ents = JSON.stringify(e.ents || []);
    return '{keys:' + keys + ',ents:' + ents +
      ',title:' + jsStr(e.title) + ',q:' + jsStr(e.q) +
      ",knode:''" + ',subfield:' + jsStr(e.subfield) +
      ',answer:' + jsStr(e.answer) + ',detail:' + jsStr(e.detail) + '}';
  }).join(',\n ');
}

function main() {
  const entries = readJson(ENTRIES);
  const html = readHTML();
  const before = parseFAQ(html);
  const { start, end } = extractFAQArray(html);
  const insertPos = end; // 在 ']' 前插入
  const block = ',\n ' + serialize(entries) + '\n';
  const newHtml = html.slice(0, insertPos) + block + html.slice(insertPos);

  const after = parseFAQ(newHtml);
  if (after.length !== before.length + entries.length) {
    console.error('条目数不符: ' + before.length + ' + ' + entries.length + ' != ' + after.length);
    process.exit(1);
  }

  console.log('=== insert-faq-entries ===');
  console.log('插入条目: ' + entries.length + ' | FAQ: ' + before.length + ' → ' + after.length);
  console.log('subfield 分布: ' + JSON.stringify(entries.reduce((a, e) => { a[e.subfield] = (a[e.subfield] || 0) + 1; return a; }, {})));

  if (DRY) { console.log('（dry-run，未写回）'); return; }
  fs.writeFileSync(path.join(__dirname, '..', 'assistant.html'), newHtml, 'utf8');
  console.log('✓ 已写回 assistant.html');
}

main();
