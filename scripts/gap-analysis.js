'use strict';
/**
 * v43 缺口 gap 分析（只读）
 *
 * 从 assistant.html 各 FAQ 的 answer/detail 提取语料引用 ID，与 corpus.json 对比，
 * 找出未被引用/未覆盖的知识点，输出选题清单。
 *
 * 输出: Agent工作区/Agent-报告/gap_analysis_v43.json
 */

const fs = require('fs');
const path = require('path');
const { readFAQRuntime } = require('./lib-assistant-faq.js');
const OUT = path.join(__dirname, '..', 'Agent工作区', 'Agent-报告', 'gap_analysis_v43.json');

function readJson(fp) {
  let r = fs.readFileSync(fp, 'utf8');
  if (r.charCodeAt(0) === 0xFEFF) r = r.slice(1);
  return JSON.parse(r);
}

function main() {
  const faq = readFAQRuntime();
  const corpus = readJson(path.join(__dirname, '..', 'data', 'corpus.json'));
  const entries = corpus.entries;

  // 1. 收集引用 ID（限定 corpus NNN 格式）
  const refRe = /\bcorpus\s*#?\s*(\d{1,4})\b/gi;
  const referenced = new Set();
  const invalidRefs = [];
  const refByEntry = [];
  faq.forEach((f, i) => {
    const text = (f.answer || '') + '\n' + (f.detail || '');
    const ids = [];
    let m;
    refRe.lastIndex = 0;
    while ((m = refRe.exec(text)) !== null) {
      const id = parseInt(m[1], 10);
      if (id >= 1 && id <= entries.length) { referenced.add(id); if (!ids.includes(id)) ids.push(id); }
      else invalidRefs.push({ index: i, title: f.title, ref: id });
    }
    if (ids.length) refByEntry.push({ index: i, title: f.title, ids });
  });

  // 2. 未被引用语料
  const unreferenced = entries
    .filter(e => !referenced.has(e.id))
    .map(e => ({ id: e.id, title: e.title, subfield: e.subfield, doctype: e.doctype, difficulty: e.difficulty }));

  // 排序：doctype 优先级 + 难度
  const prio = { '实验研究': 0, '实验教学': 1, '实验讲义': 2, '教案': 3, '教学研究': 4, '期刊论文': 5, '学生报告': 6, '竞赛试题': 6, '综述': 7, '科普/讲义': 8 };
  const diffPrio = { '进阶级': 0, '核心级': 0, '基础级': 1, '拓展级': 2 };
  unreferenced.sort((a, b) => {
    const pa = prio[a.doctype] !== undefined ? prio[a.doctype] : 9;
    const pb = prio[b.doctype] !== undefined ? prio[b.doctype] : 9;
    if (pa !== pb) return pa - pb;
    return (diffPrio[a.difficulty] || 3) - (diffPrio[b.difficulty] || 3);
  });

  // 3. 子领域覆盖
  const corpusBySub = {};
  entries.forEach(e => { corpusBySub[e.subfield] = (corpusBySub[e.subfield] || 0) + 1; });
  const faqBySub = {};
  faq.forEach(f => { const s = f.subfield || '(未分类)'; faqBySub[s] = (faqBySub[s] || 0) + 1; });
  const citedBySub = {};
  unreferenced.forEach(e => { /* not cited */ });
  const referencedEntries = entries.filter(e => referenced.has(e.id));
  referencedEntries.forEach(e => { citedBySub[e.subfield] = (citedBySub[e.subfield] || 0) + 1; });

  const subfieldCoverage = Object.keys(corpusBySub).map(sf => ({
    subfield: sf,
    corpus_count: corpusBySub[sf],
    faq_count: faqBySub[sf] || 0,
    cited_count: citedBySub[sf] || 0,
    gap: Math.max(0, (corpusBySub[sf] || 0) - (faqBySub[sf] || 0))
  })).sort((a, b) => b.gap - a.gap);

  const result = {
    generated_at: '2026-08-14',
    total_faq: faq.length,
    corpus_total: entries.length,
    referenced_ids: [...referenced].sort((a, b) => a - b),
    invalid_refs: invalidRefs,
    referenced_entries_count: refByEntry.length,
    unreferenced_total: unreferenced.length,
    unreferenced_corpus: unreferenced,
    subfield_coverage: subfieldCoverage
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8');

  console.log('=== v43 gap 分析 ===');
  console.log('FAQ: ' + faq.length + ' | 语料: ' + entries.length + ' | 引用条目: ' + refByEntry.length + ' | 引用 ID 数: ' + referenced.size);
  console.log('越界引用: ' + invalidRefs.length + (invalidRefs.length ? ' ' + JSON.stringify(invalidRefs) : ''));
  console.log('未被引用语料: ' + unreferenced.length);
  console.log('--- 子领域覆盖（按缺口排序）---');
  subfieldCoverage.slice(0, 12).forEach(s => console.log('  ' + s.subfield.padEnd(8) + ' corpus=' + s.corpus_count + ' faq=' + s.faq_count + ' cited=' + s.cited_count + ' gap=' + s.gap));
  console.log('--- 高价值未引用语料 Top 25 ---');
  unreferenced.slice(0, 25).forEach(e => console.log('  ' + e.id + '|' + e.subfield + '|' + e.doctype + '|' + e.difficulty + '|' + e.title.slice(0, 55)));
  console.log('输出: ' + OUT);
}

main();
