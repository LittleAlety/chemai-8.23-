'use strict';
// Round 2: 为通用条目派生"独有"keys（来自簇成员题目原文），修复检索路由
const fs = require('fs');
const path = require('path');
const { parseFAQ, readHTML, extractFAQArray } = require('../scripts/lib-assistant-faq.js');
const root = path.join(__dirname, '..');
const rd = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').replace(/^﻿/, ''));
const normQ = s => String(s || '').toLowerCase().replace(/[^一-龥a-z0-9]/g, '');
const stopSet = new Set('的了吗呢吧啊呀嘛哦哈嘿请些个只还也都很更最以及于是但是因为所以如果否则然而若则或与和到对从在被把让向为在使给通过按照根据关于对于经过利用使用采用进行发生出现存在包括涉及什么怎么如何为什么哪哪些会能可要需要必须应当影响后果原因目的作用'.split(''));

function clusterKeys(memberQs, allQs, n = 8) {
  const others = allQs.map(normQ);
  const cand = new Set();
  for (const mq of memberQs) {
    const nq = normQ(mq);
    for (let w = 4; w <= 7; w++) for (let i = 0; i + w <= nq.length; i++) {
      const sub = nq.slice(i, i + w); let ok = true;
      for (const c of sub) if (stopSet.has(c)) { ok = false; break; }
      if (ok) cand.add(sub);
    }
  }
  const th = Math.max(4, Math.floor(allQs.length * 0.08));   // 出现在 ≤8% 题目中
  const arr = [];
  for (const c of cand) { let cnt = 0; for (const o of others) if (o.includes(c)) cnt++; if (cnt <= th) arr.push(c); }
  arr.sort((a, b) => b.length - a.length);
  return arr.slice(0, n);
}

const allQs = rd('Agent工作区/Agent-B-问题生成/self_train_all_599.json').map(q => q.question);
const clusters = rd('Agent工作区/Agent-优化/generalize_clusters_r1.json');
const spec = rd('Agent工作区/Agent-优化/generalize_spec_entries.json');
// E{i} → spec[i].q
const qById = {}; spec.forEach((f, i) => qById['E' + i] = f.q);

// 当前 FAQ: 784 常规 + 239 通用（q==='' 的即通用条目）
const html = readHTML();
const faq = parseFAQ(html);
const genIdx = [];
faq.forEach((f, i) => { if ((f.q || '') === '') genIdx.push(i); });
console.log('通用条目数:', genIdx.length, '| 聚类数:', clusters.length);

// 假设 entries 与 clusters 顺序对应（1:1），为每个通用条目补派生 keys
const entries = rd('Agent工作区/Agent-优化/generalize_entries_r1.json');
const newKeysByEntry = {};
if (genIdx.length === clusters.length && genIdx.length === entries.length) {
  clusters.forEach((c, ci) => {
    const memberQs = (c.ids || []).map(id => qById[id]).filter(Boolean);
    if (memberQs.length) {
      const keys = clusterKeys(memberQs, allQs);
      newKeysByEntry[ci] = keys;
    }
  });
} else {
  console.log('⚠ 数量不匹配: gen=' + genIdx.length + ' clusters=' + clusters.length + ' entries=' + entries.length);
}
console.log('已生成派生keys的簇:', Object.keys(newKeysByEntry).length);

// 应用：把派生 keys 并入对应通用条目的 keys
let mod = 0;
for (const ci of Object.keys(newKeysByEntry)) {
  const idx = genIdx[Number(ci)];
  const cur = faq[idx];
  const merged = Array.from(new Set((cur.keys || []).concat(newKeysByEntry[ci])));
  if (merged.length !== (cur.keys || []).length) mod++;
  // 记录到 entries 数组再重建
  entries[Number(ci)].keys = merged;
}
console.log('待更新 keys 的条目:', mod);

// 重建 assistant.html: 常规 + 更新后的通用条目
function jsStr(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'"; }
const normal = faq.filter(f => (f.q || '') !== '');
const { start, end } = extractFAQArray(html);
const block = normal.concat(entries).map(e =>
  '{keys:' + JSON.stringify(e.keys || []) + ',ents:' + JSON.stringify(e.ents || []) +
  ',title:' + jsStr(e.title) + ',q:' + jsStr(e.q || '') + ",knode:''" + ',subfield:' + jsStr(e.subfield) +
  ',answer:' + jsStr(e.answer) + ',detail:' + jsStr(e.detail || '') + '}').join(',\n ');
fs.writeFileSync(path.join(root, 'assistant.html'), html.slice(0, start) + '[' + block + ']' + html.slice(end + 1), 'utf8');
console.log('已写入 assistant.html（常规', normal.length, '+ 通用', entries.length, '= ', normal.length + entries.length, '）');
