'use strict';
/**
 * v43 基线快照：记录清洗前 assistant.html 的 FAQ 关键词质量指标。
 * 输出: Agent工作区/Agent-报告/v43_baseline.json
 */

const fs = require('fs');
const path = require('path');
const { readHTML, parseFAQ } = require('./lib-assistant-faq.js');

const OUT_DIR = path.join(__dirname, '..', 'Agent工作区', 'Agent-报告');
const OUT_FILE = path.join(OUT_DIR, 'v43_baseline.json');

// 问法子串（用于统计弱 key 规模）
const SUB_TERMS = ['怎么', '如何', '怎样', '为什么', '为何', '是什么', '有哪些', '能否', '能不能', '多少'];
// 精确泛词（A 档，用于基线计数；最终黑名单以 faq_key_blacklist.json 为准）
const PRECISE_GENERIC = [
  '如何操作', '怎样操作', '怎么做', '怎么操作', '实验流程', '操作步骤',
  '数值是多少', '具体数值', '都有哪些', '定义是什么', '原理是什么', '原因是什么',
  '什么颜色', '温度控制', '水浴加热'
];

function main() {
  const html = readHTML();
  const faq = parseFAQ(html);

  // 1. 基础统计
  const keyCounts = faq.map(f => (f.keys || []).length);
  const min = Math.min(...keyCounts);
  const max = Math.max(...keyCounts);
  const mean = keyCounts.reduce((a, b) => a + b, 0) / keyCounts.length;

  // 2. keys<3 清单
  const lowKeys = [];
  faq.forEach((f, i) => {
    const n = (f.keys || []).length;
    if (n < 3) lowKeys.push({ index: i, title: f.title, subfield: f.subfield, keys: f.keys });
  });

  // 3. 含问法子串的条目
  const weakKey = [];
  faq.forEach((f, i) => {
    const keys = f.keys || [];
    const hit = keys.filter(k => SUB_TERMS.some(s => k.includes(s)));
    if (hit.length > 0) weakKey.push({ index: i, title: f.title, subfield: f.subfield, hitKeys: hit });
  });

  // 4. 精确泛词命中（子串命中 key 计数）
  const preciseHits = {};   // term -> count of keys
  const preciseEntries = [];
  faq.forEach((f, i) => {
    const keys = f.keys || [];
    const found = keys.filter(k => PRECISE_GENERIC.includes(k));
    if (found.length) {
      preciseEntries.push({ index: i, title: f.title, keys: found });
      found.forEach(k => { preciseHits[k] = (preciseHits[k] || 0) + 1; });
    }
  });

  // 5. 语料引用
  const refRe = /(?:corpus|语料|文献)\s*[#：:，、\s]*(\d+)/gi;
  const refsByEntry = [];
  const validRefs = new Set();
  const invalidRefs = [];
  faq.forEach((f, i) => {
    const text = (f.answer || '') + '\n' + (f.detail || '');
    const ids = [];
    let m;
    refRe.lastIndex = 0;
    while ((m = refRe.exec(text)) !== null) {
      const id = parseInt(m[1], 10);
      if (id >= 1 && id <= 355) { validRefs.add(id); ids.push(id); }
      else invalidRefs.push({ index: i, title: f.title, ref: id, snippet: m[0] });
    }
    if (ids.length) refsByEntry.push({ index: i, title: f.title, ids: [...new Set(ids)] });
  });

  // 6. subfield 分布（运行版实际分布，供词表/新条目参考）
  const catDist = {};
  faq.forEach(f => {
    const c = f.subfield || '(未分类)';
    catDist[c] = (catDist[c] || 0) + 1;
  });

  const baseline = {
    generated_at: '2026-08-14',
    version: 'v43-baseline',
    html_file: 'assistant.html',
    total_faq: faq.length,
    keys_stats: { min, max, mean: Math.round(mean * 100) / 100 },
    low_key_entries: lowKeys,               // keys<3
    weak_key_entries: weakKey,              // 含问法子串
    precise_generic_key_hits: preciseHits,  // 精确泛词 → 命中 key 数
    precise_generic_entries: preciseEntries,
    corpus_refs: {
      total_entries_with_refs: refsByEntry.length,
      referenced_ids: [...validRefs].sort((a, b) => a - b),
      invalid_refs: invalidRefs
    },
    subfield_distribution: catDist
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(baseline, null, 2), 'utf8');

  console.log('=== v43 基线快照 ===');
  console.log('FAQ 总数: ' + faq.length);
  console.log('keys 统计: min=' + min + ' max=' + max + ' mean=' + Math.round(mean * 100) / 100);
  console.log('keys<3 条目: ' + lowKeys.length);
  console.log('含问法子串条目: ' + weakKey.length);
  console.log('精确泛词命中 key 数: ' + Object.values(preciseHits).reduce((a, b) => a + b, 0) +
    ' 分布: ' + JSON.stringify(preciseHits));
  console.log('语料引用条目数: ' + refsByEntry.length +
    ' | 有效 ID 数: ' + validRefs.size +
    ' | 越界引用: ' + invalidRefs.length +
    (invalidRefs.length ? ' ' + JSON.stringify(invalidRefs.map(r => r.ref)) : ''));
  console.log('输出: ' + OUT_FILE);
}

main();
