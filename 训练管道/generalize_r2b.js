'use strict';
// Round 2b: 为通用条目设置"成员共享独有短语"作为 q（触发 matchFAQ 子串+50），实现可靠路由
const fs = require('fs');
const path = require('path');
const { parseFAQ, readHTML, extractFAQArray } = require('../scripts/lib-assistant-faq.js');
const root = path.join(__dirname, '..');
const rd = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').replace(/^﻿/, ''));
const normQ = s => String(s || '').toLowerCase().replace(/[^一-龥a-z0-9]/g, '');

const allQs = rd('Agent工作区/Agent-B-问题生成/self_train_all_599.json').map(q => q.question);
const clusters = rd('Agent工作区/Agent-优化/generalize_clusters_r1.json');
const spec = rd('Agent工作区/Agent-优化/generalize_spec_entries.json');
const qById = {}; spec.forEach((f, i) => qById['E' + i] = f.q);

// 为每个簇找一个"成员共享且较独有"的短语(≥15字)
function findAnchor(memberQs) {
  if (!memberQs.length) return '';
  const nqs = memberQs.map(normQ);
  const first = nqs[0];
  const others = allQs.filter(q => !memberQs.includes(q)).map(normQ);
  let best = '', bestScore = -1;
  for (let len = 40; len >= 15; len--) {
    for (let i = 0; i + len <= first.length; i++) {
      const sub = first.slice(i, i + len);
      if (sub.includes('的') && len > 25) continue;
      // 必须出现在所有成员题中
      let allHit = true;
      for (const nq of nqs) if (!nq.includes(sub)) { allHit = false; break; }
      if (!allHit) continue;
      // 独有性: 在其他题目中出现次数
      let cnt = 0;
      for (const o of others) if (o.includes(sub)) cnt++;
      const score = len * 1.0 - cnt * 3;
      if (score > bestScore) { bestScore = score; best = sub; }
    }
    if (best) break;   // 优先最长
  }
  return best;
}

const entries = rd('Agent工作区/Agent-优化/generalize_entries_r1.json');
let assigned = 0;
clusters.forEach((c, ci) => {
  const memberQs = (c.ids || []).map(id => qById[id]).filter(Boolean);
  const anchor = findAnchor(memberQs);
  if (anchor && entries[ci]) { entries[ci].q = anchor; assigned++; }
  else if (entries[ci]) entries[ci].q = '';
});
console.log('已设 q-anchor 的通用条目:', assigned, '/', entries.length);
// 检查 anchor 是否真的独有（抽样）
const norms = allQs.map(normQ);
let conflict = 0;
entries.forEach(e => {
  if (e.q && e.q.length >= 15) {
    const fq = normQ(e.q);
    let c = 0; for (const n of norms) if (n.includes(fq)) c++;
    if (c > 8) conflict++;
  }
});
console.log('anchor 命中>8题(可能冲突):', conflict);

// 重建 FAQ
function jsStr(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'"; }
const html = readHTML();
const faq = parseFAQ(html);
const normal = faq.filter(f => (f.q || '') !== '');
const { start, end } = extractFAQArray(html);
const block = normal.concat(entries).map(e =>
  '{keys:' + JSON.stringify(e.keys || []) + ',ents:' + JSON.stringify(e.ents || []) +
  ',title:' + jsStr(e.title) + ',q:' + jsStr(e.q || '') + ",knode:''" + ',subfield:' + jsStr(e.subfield) +
  ',answer:' + jsStr(e.answer) + ',detail:' + jsStr(e.detail || '') + '}').join(',\n ');
fs.writeFileSync(path.join(root, 'assistant.html'), html.slice(0, start) + '[' + block + ']' + html.slice(end + 1), 'utf8');
console.log('已写入 assistant.html（', normal.length + entries.length, '条）');
