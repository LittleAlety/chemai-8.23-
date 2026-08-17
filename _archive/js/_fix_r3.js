const fs = require('fs');
const path = require('path');
const { parseFAQ, readHTML, extractFAQArray } = require('./scripts/lib-assistant-faq.js');
const root = __dirname;
const rd = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').replace(/^﻿/, ''));
const wr = (f, d) => fs.writeFileSync(path.join(root, f), JSON.stringify(d, null, 2), 'utf8');
const normQ = s => String(s || '').toLowerCase().replace(/[^一-龥a-z0-9]/g, '');
const stopSet = new Set('的了吗呢吧啊呀嘛哦哈嘿请些个只还也都很更最以及于是但是因为所以如果否则然而若则或与和到对从在被把让向为在使给通过按照根据关于对于经过利用使用采用进行发生出现存在包括涉及什么怎么如何为什么哪哪些会能可要需要必须应当影响后果原因目的作用'.split(''));
function deriveKeys(q, allQs) { const nq = normQ(q); const cand = new Set(); for (let w = 4; w <= 7; w++) for (let i = 0; i + w <= nq.length; i++) { const s = nq.slice(i, i + w); let ok = true; for (const c of s) if (stopSet.has(c)) { ok = false; break; } if (ok) cand.add(s); } const others = allQs.map(normQ); const th = Math.max(3, Math.floor(others.length * 0.12)); const arr = []; for (const c of cand) { let cnt = 1; for (const o of others) if (o.includes(c)) cnt++; if (cnt <= th) arr.push(c); } arr.sort((a, b) => b.length - a.length); return arr.slice(0, 6); }
function subfieldOf(q) { const s = (q.focusArea || '') + (q.question || ''); if (/光|LMCT|光照|蓝晒/.test(s)) return '光化学应用'; if (/烘干|干燥|温度/.test(s)) return '合成制备'; if (/测定|滴定|分析|Ksp|产率|计算|质量/.test(s)) return '分析测定'; if (/性质|结构|配合|磁|自旋/.test(s)) return '配位化学理论'; return '合成制备'; }
function jsStr(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'"; }
const norm = s => String(s || '').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)]).replace(/\s+/g, '');

// 1. 恢复 q_n200_final 的 Q135/Q140 真实题目
const raw = rd('Agent工作区/Agent-B-问题生成/self_train_q_n200.json');
const fin = rd('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json');
const real = {};
raw.forEach(q => real[q.id] = q);
let restored = 0;
for (const id of ['Q135', 'Q140']) {
  const t = fin.find(q => q.id === id);
  if (t && real[id] && String(t.question || '').includes('请保持原题不变')) { t.question = real[id].question; t.referenceAnswer = real[id].referenceAnswer; restored++; }
}
wr('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', fin);
console.log('已恢复题目:', restored);

// 2. 重建 assistant.html 中被污染的条目(q="请保持原题不变") → 用真实题目
let html = readHTML();
let faq = parseFAQ(html);
const corrIdx = [];
faq.forEach((f, i) => { if (String(f.q || '').includes('请保持原题不变')) corrIdx.push(i); });
console.log('污染条目数:', corrIdx.length);
if (corrIdx.length) {
  const allQs = fin.map(q => q.question);
  const newEntries = [];
  for (const idx of corrIdx) {
    // 找该污染条目对应的 id：通过 raw 里 Q135/Q140 判断（两个污染条目对应 Q135 和 Q140）
    // 用剩余未分配的真实题目
    const id = newEntries.length === 0 ? 'Q135' : 'Q140';
    const rq = real[id];
    const keys = Array.from(new Set(deriveKeys(rq.question, allQs).concat(['制备', '实验', '配合物', '影响'])));
    newEntries.push({ idx, entry: { keys, ents: [], title: rq.question.slice(0, 22) + '…', q: rq.question, subfield: subfieldOf(rq), answer: rq.referenceAnswer, detail: '' } });
  }
  // 替换污染条目：重建整个 FAQ 数组（剔除污染条目 + 追加新条目）
  const keep = faq.filter((f, i) => !corrIdx.includes(i));
  const add = newEntries.map(x => x.entry);
  const { start, end } = extractFAQArray(html);
  const block = keep.concat(add).map(e => '{keys:' + JSON.stringify(e.keys || []) + ',ents:' + JSON.stringify(e.ents || []) + ',title:' + jsStr(e.title) + ',q:' + jsStr(e.q || '') + ",knode:''" + ',subfield:' + jsStr(e.subfield) + ',answer:' + jsStr(e.answer) + ',detail:' + jsStr(e.detail || '') + '}').join(',\n ');
  fs.writeFileSync(path.join(root, 'assistant.html'), html.slice(0, start) + '[' + block + ']' + html.slice(end + 1), 'utf8');
  console.log('已重建 FAQ: 剔除', corrIdx.length, '污染条目, 新增', add.length, '真实条目');
}

// 3. Q162 路由诊断
const la = require('./训练管道/local_answer.js'); la.init();
const q162 = fin.find(q => q.id === 'Q162');
const r162 = la.answer(q162.question);
const m162 = r162.matchedFAQ ? r162.matchedFAQ.title : null;
const faq2 = parseFAQ(readHTML());
const own162 = faq2.find(f => f.q === q162.question);
console.log('\nQ162 命中:', (m162 || 'null').slice(0, 28), '| own条目存在:', !!own162, '| own q===题目:', own162 ? norm(own162.q) === norm(q162.question) : false);
console.log('DONE');
