'use strict';
/**
 * v43 关键词清洗 · A 档机械删除 + 清单输出
 *
 * 用法:
 *   node scripts/clean-faq-keys.js            # 只输出清单（不写回）
 *   node scripts/clean-faq-keys.js --apply    # 写回 assistant.html（写回前语法校验）
 *
 * 输出:
 *   Agent工作区/Agent-报告/clean_keys_changes.json   # 逐条 removed / new_keys
 *   Agent工作区/Agent-报告/clean_keys_report.json    # 汇总 + 待 LLM 审定清单
 */

const fs = require('fs');
const path = require('path');
const {
  readFAQRuntime, writeFAQRuntime, applyManifestToArray
} = require('./lib-assistant-faq.js');

const APPLY = process.argv.includes('--apply');
const OUT_DIR = path.join(__dirname, '..', 'Agent工作区', 'Agent-报告');

function readJson(fp) {
  let r = fs.readFileSync(fp, 'utf8');
  if (r.charCodeAt(0) === 0xFEFF) r = r.slice(1);
  return JSON.parse(r);
}

const blacklist = readJson(path.join(__dirname, '..', 'data', 'faq_key_blacklist.json'));
const tierA = blacklist.tierA_delete;
const tierBkeys = Object.keys(blacklist.tierB_conditional || {});
const aLower = new Set(tierA.map(s => s.toLowerCase()));
const bLower = new Set(tierBkeys.map(s => s.toLowerCase()));

function dedupe(arr) {
  const seen = new Set();
  return arr.filter(k => { const d = k.toLowerCase(); if (seen.has(d)) return false; seen.add(d); return true; });
}

function main() {
  const faq = readFAQRuntime();

  const changes = [];   // {index, title, subfield, removed, new_keys, new_ents}
  const skipped = [];   // 删除会导致 keys<3 而跳过
  const removedCount = {};

  for (let i = 0; i < faq.length; i++) {
    const f = faq[i];
    const keys = f.keys || [];
    const ents = f.ents || [];
    const removed = [];
    const kept = [];
    for (const k of keys) {
      if (aLower.has(k.toLowerCase())) removed.push(k);
      else kept.push(k);
    }
    // 全局去重（大小写不敏感）——重复 key 会让 matchFAQ 重复计分
    const deduped = dedupe(kept);
    const newEnts = dedupe(ents);
    const hasRemoved = removed.length > 0;
    const hasDupKeys = deduped.length !== kept.length;
    const hasDupEnts = newEnts.length !== ents.length;
    if (!hasRemoved && !hasDupKeys && !hasDupEnts) continue;
    if (deduped.length < 3 && hasRemoved) {
      skipped.push({ index: i, title: f.title, subfield: f.subfield, removed, kept: deduped });
      continue;
    }
    if (hasRemoved) removed.forEach(k => { removedCount[k] = (removedCount[k] || 0) + 1; });
    const ch = { index: i, title: f.title, subfield: f.subfield };
    if (hasRemoved) ch.removed = removed;
    if (hasRemoved || hasDupKeys) ch.new_keys = deduped;
    if (hasDupEnts) ch.new_ents = newEnts;
    changes.push(ch);
  }

  // ===== 待 LLM 审定清单 =====
  // 1) 含 tierB 条件词（颜色/温度/加热/水浴加热/原理/终点）
  const tierBEntries = [];
  // 2) 当前 keys<3（含被跳过删除的）
  const lowKeyEntries = [];
  // 3) 含问法子串的弱 key
  const subTerms = ['怎么', '如何', '怎样', '为什么', '为何', '是什么', '有哪些', '能否', '能不能', '多少'];
  const weakKeyEntries = [];

  for (let i = 0; i < faq.length; i++) {
    const f = faq[i];
    const keys = f.keys || [];
    const tb = keys.filter(k => bLower.has(k.toLowerCase()));
    if (tb.length) tierBEntries.push({ index: i, title: f.title, subfield: f.subfield, tierB_keys: tb });
    if (keys.length < 3) lowKeyEntries.push({ index: i, title: f.title, subfield: f.subfield, keys });
    const wk = keys.filter(k => subTerms.some(s => k.includes(s)));
    if (wk.length) weakKeyEntries.push({ index: i, title: f.title, subfield: f.subfield, weak_keys: wk });
  }

  const removedTotal = changes.reduce((a, c) => a + (c.removed ? c.removed.length : 0), 0);

  // ===== 投影校验 =====
  const projChanges = changes.map(c => {
    const m = { index: c.index };
    if (c.new_keys !== undefined) m.new_keys = c.new_keys;
    if (c.new_ents !== undefined) m.new_ents = c.new_ents;
    return m;
  });
  const projected = applyManifestToArray(faq, projChanges);
  const projFaq = projected;
  const projLow = projFaq.filter(f => (f.keys || []).length < 3).length;
  const dupeKeys = [];
  projFaq.forEach((f, i) => {
    const seen = new Set();
    for (const k of f.keys || []) {
      const d = k.toLowerCase();
      if (seen.has(d)) { dupeKeys.push({ index: i, title: f.title, dup: k }); }
      seen.add(d);
    }
  });

  const report = {
    generated_at: '2026-08-14',
    mode: APPLY ? 'applied' : 'preview',
    total_faq: faq.length,
    tierA_removed_total: removedTotal,
    entries_affected: changes.length,
    removed_per_key: removedCount,
    skipped_for_lowkey: skipped,
    needs_review: {
      tierB_conditional_entries: tierBEntries,
      low_key_entries: lowKeyEntries,
      weak_key_entries: weakKeyEntries
    },
    validation: {
      faq_count_stable: projFaq.length === faq.length,
      proj_low_key_count: projLow,
      proj_duplicate_keys: dupeKeys
    }
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'clean_keys_changes.json'), JSON.stringify(changes, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'clean_keys_report.json'), JSON.stringify(report, null, 2), 'utf8');

  // ===== 控制台摘要 =====
  console.log('=== 关键词清洗 (A 档) ' + (APPLY ? 'APPLY' : 'PREVIEW') + ' ===');
  console.log('FAQ 总数: ' + faq.length);
  console.log('A 档删除 key 总数: ' + removedTotal + ' | 涉及条目: ' + changes.length);
  console.log('removed_per_key: ' + JSON.stringify(removedCount));
  console.log('跳过(会 keys<3): ' + skipped.length + (skipped.length ? ' → ' + skipped.map(s => s.index).join(',') : ''));
  console.log('待 LLM 审定: tierB=' + tierBEntries.length + ' | keys<3=' + lowKeyEntries.length + ' | 弱key=' + weakKeyEntries.length);
  console.log('投影校验: 总数稳定=' + (projFaq.length === faq.length) +
    ' | 投影 keys<3=' + projLow + ' | 重复 key=' + dupeKeys.length);

  if (APPLY) {
    writeFAQRuntime(projFaq);
    console.log('✓ 已写回 data/faq_runtime.js');
  } else {
    console.log('（未写回；用 --apply 应用。清单见 clean_keys_changes.json）');
  }
}

main();
