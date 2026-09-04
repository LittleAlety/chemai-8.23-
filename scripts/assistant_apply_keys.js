'use strict';
/**
 * 安全地把"比对"建议的 key 合并进指定 FAQ 条目的 keys（entry 级，安全；不涉及 scorer-base）。
 * 精准度绝对优先：只加"查询原文里出现、非歧义、非已有、长度足够"的 key，绝不删、绝不改 answer。
 * 输入 <fixes.json> = [{qid, entryIndex, addKeys:[...]}, ...]
 * 用法: node scripts/assistant_apply_keys.js <fixes.json> [--dry-run]
 * 输出: 校验摘要；校验通过且非 dry-run 时写回 data/faq_runtime.js。
 */
const fs = require('fs');
const { readFAQRuntime, writeFAQRuntime, applyManifestToArray } = require('./lib-assistant-faq.js');

const AMB = new Set(['℃','°c','40','40℃','100','100℃','0','0℃','20','20℃','g','ml','mol','%','h','ph','水','酸','碱','盐','色','热','光','铁','氧','氢','碳']);
const SUBMAP = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','⁻':'-','⁺':'+' };
const norm = s => String(s || '').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => SUBMAP[c] || c).replace(/\s+/g, '');

function readJson(fp) {
  let r = fs.readFileSync(fp, 'utf8');
  if (r.charCodeAt(0) === 0xFEFF) r = r.slice(1);
  return JSON.parse(r);
}

function main() {
  const fp = process.argv[2];
  const DRY = process.argv.includes('--dry-run');
  if (!fp) { console.error('用法: node assistant_apply_keys.js <fixes.json> [--dry-run]'); process.exit(1); }
  const fixes = readJson(fp);
  const base = readFAQRuntime();
  const changes = [];
  let added = 0, skipped = 0;
  const log = [];

  for (const f of fixes) {
    const e = base[f.entryIndex];
    if (!e) { log.push('  ⚠ skip entryIndex 越界 ' + f.entryIndex); skipped++; continue; }
    const existing = new Set((e.keys || []).map(k => norm(k)));
    const merged = (e.keys || []).slice();
    let localAdd = 0;
    for (const k of (f.addKeys || [])) {
      const nk = norm(k);
      if (nk.length < 2) { skipped++; continue; }        // 太短，易歧义
      if (AMB.has(nk)) { skipped++; continue; }          // 歧义词
      if (existing.has(nk)) { continue; }                // 已有
      merged.push(k); existing.add(nk); added++; localAdd++;
    }
    if (localAdd > 0) changes.push({ index: f.entryIndex, new_keys: merged });
    log.push('  ' + (f.qid || '?') + ' (entry#' + f.entryIndex + '「' + String(e.title || '').slice(0, 18) + '」) +' + localAdd + ' keys');
  }

  const after = applyManifestToArray(base, changes);
  const errors = [];
  if (after.length !== base.length) errors.push('条目总数变化');
  // 本操作只加 key 不减，keys<3 的条目数只会持平或减少；只有"比操作前变多"才算回归。
  const lowBase = base.filter(f => (f.keys || []).length < 3).length;
  const low = after.filter(f => (f.keys || []).length < 3).length;
  if (low > lowBase) errors.push('新增 keys<3 条目: ' + (low - lowBase));
  after.forEach((f, i) => { const seen = new Set(); for (const k of f.keys || []) { const d = k.toLowerCase(); if (seen.has(d)) errors.push('dup key @' + i); seen.add(d); } });

  console.log('=== assistant_apply_keys ===');
  console.log('fixes: ' + fixes.length + ' | 应用到条目: ' + changes.length + ' | 新增 keys: ' + added + ' | 跳过: ' + skipped);
  log.slice(0, 12).forEach(l => console.log(l));
  if (errors.length) { console.log('❌ 校验失败:'); errors.slice(0, 8).forEach(e => console.log('  - ' + e)); process.exit(1); }
  if (DRY) { console.log('（dry-run，未写回）'); return; }
  if (changes.length) { writeFAQRuntime(after); console.log('✓ 已写回 data/faq_runtime.js（' + changes.length + ' 条目）'); }
  else console.log('（无改动）');
}
main();
