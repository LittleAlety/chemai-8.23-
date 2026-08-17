const fs = require('fs');
const path = require('path');
const { parseFAQ, readHTML, extractFAQArray } = require('./scripts/lib-assistant-faq.js');
const root = __dirname;
const rd = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').replace(/^﻿/, ''));
const normQ = s => String(s || '').toLowerCase().replace(/[^一-龥a-z0-9]/g, '');
const stopSet = new Set('的了吗呢吧啊呀嘛哦哈嘿请些个只还也都很更最以及于是但是因为所以如果否则然而若则或与和到对从在被把让向为在使给通过按照根据关于对于经过利用使用采用进行发生出现存在包括涉及什么怎么如何为什么哪哪些会能可要需要必须应当影响后果原因目的作用'.split(''));
function deriveKeys(question, allQs, n = 8) {
  const nq = normQ(question); const cand = new Set();
  for (let w = 4; w <= 7; w++) for (let i = 0; i + w <= nq.length; i++) { const sub = nq.slice(i, i + w); let ok = true; for (const c of sub) if (stopSet.has(c)) { ok = false; break; } if (ok) cand.add(sub); }
  const others = allQs.map(normQ); const th = Math.max(4, Math.floor(allQs.length * 0.08)); const arr = [];
  for (const c of cand) { let cnt = 0; for (const o of others) if (o.includes(c)) cnt++; if (cnt <= th) arr.push(c); }
  arr.sort((a, b) => b.length - a.length);
  return arr.slice(0, n);
}
function subfieldOf(q) { const s = (q.focusArea || '') + (q.question || ''); if (/光|LMCT|光照|蓝晒/.test(s)) return '光化学应用'; if (/机理|反应|平衡|氧化/.test(q.focusArea || '')) return '反应原理'; if (/性质|结构|配合|磁|自旋/.test(s)) return '配位化学理论'; if (/测定|滴定|分析|Ksp|产率|计算/.test(s)) return '分析测定'; return '合成制备'; }
function jsStr(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'"; }
const qs = rd('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json');
const low = ['Q039', 'Q080', 'Q156', 'Q194'];
const allQs = qs.map(q => q.question);
const faq = parseFAQ(readHTML());
const toAdd = [];
for (const id of low) {
  const q = qs.find(x => x.id === id);
  const has = faq.some(f => f.q === q.question);
  if (has) { console.log(id, '已有 q=本题 条目'); continue; }
  const keys = Array.from(new Set(deriveKeys(q.question, allQs).concat(['制备', '实验', '配合物', '高自旋', '影响'])));
  toAdd.push({ keys, ents: [], title: q.question.slice(0, 22) + (q.question.length > 22 ? '…' : ''), q: q.question, subfield: subfieldOf(q), answer: q.referenceAnswer, detail: '' });
  console.log(id, '新建条目 (keys:', keys.length, ')');
}
if (toAdd.length) {
  const html = readHTML();
  const { start, end } = extractFAQArray(html);
  const block = toAdd.map(e => '{keys:' + JSON.stringify(e.keys) + ',ents:' + JSON.stringify(e.ents) + ',title:' + jsStr(e.title) + ',q:' + jsStr(e.q) + ",knode:''" + ',subfield:' + jsStr(e.subfield) + ',answer:' + jsStr(e.answer) + ',detail:' + jsStr(e.detail) + '}').join(',\n ');
  fs.writeFileSync(path.join(root, 'assistant.html'), html.slice(0, end) + ',\n ' + block + '\n' + html.slice(end), 'utf8');
  console.log('已插入', toAdd.length, '条');
}
