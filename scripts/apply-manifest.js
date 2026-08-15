'use strict';
/**
 * v43 通用 manifest 应用脚本（配合 lib-assistant-faq.applyManifest）
 * 用法:
 *   node scripts/apply-manifest.js <manifest.json> [--dry-run]
 * manifest 条目格式: {index, new_keys?, new_ents?}
 */

const fs = require('fs');
const path = require('path');
const { readHTML, parseFAQ, applyManifest } = require('./lib-assistant-faq.js');

const MANIFEST = process.argv[2];
const DRY = process.argv.includes('--dry-run');
if (!MANIFEST) { console.error('用法: node scripts/apply-manifest.js <manifest.json> [--dry-run]'); process.exit(1); }

function readJson(fp) {
  let r = fs.readFileSync(fp, 'utf8');
  if (r.charCodeAt(0) === 0xFEFF) r = r.slice(1);
  return JSON.parse(r);
}

function main() {
  const changes = readJson(MANIFEST);
  const html = readHTML();
  const before = parseFAQ(html);
  const projChanges = changes.map(c => {
    const m = { index: c.index };
    if (c.new_keys !== undefined) m.new_keys = c.new_keys;
    if (c.new_ents !== undefined) m.new_ents = c.new_ents;
    if (c.new_answer !== undefined) m.new_answer = c.new_answer;
    if (c.new_detail !== undefined) m.new_detail = c.new_detail;
    return m;
  });
  const projected = applyManifest(html, projChanges);
  const after = parseFAQ(projected);

  // 校验
  const errors = [];
  if (after.length !== before.length) errors.push('条目总数变化: ' + before.length + ' → ' + after.length);
  const low = after.filter(f => (f.keys || []).length < 3).length;
  if (low > 0) errors.push('存在 keys<3 条目: ' + low);
  const dups = [];
  after.forEach((f, i) => {
    const seen = new Set();
    for (const k of f.keys || []) { const d = k.toLowerCase(); if (seen.has(d)) dups.push(i); seen.add(d); }
  });
  if (dups.length) errors.push('存在重复 key 条目: ' + dups.join(','));

  // diff 摘要
  let keyDelta = 0, entDelta = 0;
  changes.forEach(c => {
    const b = before[c.index] || {};
    const a = after[c.index] || {};
    keyDelta += (a.keys || []).length - (b.keys || []).length;
    entDelta += (a.ents || []).length - (b.ents || []).length;
  });

  console.log('=== apply-manifest ===');
  console.log('manifest: ' + path.basename(MANIFEST) + ' | 条目: ' + changes.length);
  console.log('FAQ: ' + before.length + ' → ' + after.length + ' (稳定=' + (after.length === before.length) + ')');
  console.log('keys 净变化: ' + keyDelta + ' | ents 净变化: ' + entDelta);
  console.log('keys<3 剩余: ' + low + ' | 重复 key 条目: ' + dups.length);
  if (errors.length) { console.log('❌ 校验失败:'); errors.forEach(e => console.log('  - ' + e)); process.exit(1); }

  if (DRY) { console.log('（dry-run，未写回）'); return; }
  fs.writeFileSync(path.join(__dirname, '..', 'assistant.html'), projected, 'utf8');
  console.log('✓ 已写回 assistant.html');
}

main();
