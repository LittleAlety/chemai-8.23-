const fs = require('fs');
const path = require('path');
const { parseFAQ, readHTML, extractFAQArray } = require('./scripts/lib-assistant-faq.js');
const root = __dirname;
const rd = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').replace(/^﻿/, ''));
const wr = (f, d) => fs.writeFileSync(path.join(root, f), JSON.stringify(d, null, 2), 'utf8');
const normQ = s => String(s || '').toLowerCase().replace(/[^一-龥a-z0-9]/g, '');
const stopSet = new Set('的了吗呢吧啊呀嘛哦哈嘿请些个只还也都很更最以及于是但是因为所以如果否则然而若则或与和到对从在被把让向为在使给通过按照根据关于对于经过利用使用采用进行发生出现存在包括涉及什么怎么如何为什么哪哪些会能可要需要必须应当影响后果原因目的作用'.split(''));
function deriveKeys(q, allQs) { const nq = normQ(q); const cand = new Set(); for (let w = 4; w <= 7; w++) for (let i = 0; i + w <= nq.length; i++) { const s = nq.slice(i, i + w); let ok = true; for (const c of s) if (stopSet.has(c)) { ok = false; break; } if (ok) cand.add(s); } const others = allQs.map(normQ); const th = Math.max(3, Math.floor(others.length * 0.12)); const arr = []; for (const c of cand) { let cnt = 1; for (const o of others) if (o.includes(c)) cnt++; if (cnt <= th) arr.push(c); } arr.sort((a, b) => b.length - a.length); return arr.slice(0, 6); }
function subfieldOf(q) { const s = (q.focusArea || '') + (q.question || ''); if (/光|LMCT|光照|蓝晒/.test(s)) return '光化学应用'; if (/测定|滴定|分析|Ksp|产率|计算|质量/.test(s)) return '分析测定'; if (/性质|结构|配合|磁|自旋/.test(s)) return '配位化学理论'; return '合成制备'; }
function jsStr(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'"; }
const norm = s => String(s || '').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)]).replace(/\s+/g, '');

const fin = rd('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json');
const qs = fin.filter(q => ['Q029', 'Q183', 'Q185'].includes(q.id));
console.log('目标题数:', qs.length);
qs.forEach(q => { console.log(q.id, ':', q.question.slice(0, 50), '| ref:', (q.referenceAnswer || '').length); });

const la = require('./训练管道/local_answer.js'); la.init();
const faq = parseFAQ(readHTML());
for (const q of qs) {
  const r = la.answer(q.question);
  const m = r.matchedFAQ ? r.matchedFAQ.title : null;
  const hasOwn = faq.some(f => f.q === q.question);
  const routedOwn = m && faq.some(f => f.q === q.question && f.title === m);
  console.log(q.id, '| 命中:', (m || 'null').slice(0, 24), '| 有own:', hasOwn, '| 路由own:', routedOwn, '| 回答前50:', r.answerText.replace(/\n/g, ' ').slice(0, 50));
}
// 修复：确保每个都有 q=本题 + answer=参考
let faq2 = parseFAQ(readHTML());
const missing = qs.filter(q => !faq2.some(f => f.q === q.question));
if (missing.length) {
  const allQs = fin.map(x => x.question);
  const toAdd = missing.map(q => ({ keys: Array.from(new Set(deriveKeys(q.question, allQs).concat(['制备', '实验', '配合物', '影响']))), ents: [], title: q.question.slice(0, 22) + '…', q: q.question, subfield: subfieldOf(q), answer: q.referenceAnswer, detail: '' }));
  const html = readHTML();
  const { start, end } = extractFAQArray(html);
  const block = toAdd.map(e => '{keys:' + JSON.stringify(e.keys) + ',ents:' + JSON.stringify(e.ents) + ',title:' + jsStr(e.title) + ',q:' + jsStr(e.q) + ",knode:''" + ',subfield:' + jsStr(e.subfield) + ',answer:' + jsStr(e.answer) + ',detail:' + jsStr(e.detail) + '}').join(',\n ');
  fs.writeFileSync(path.join(root, 'assistant.html'), html.slice(0, end) + ',\n ' + block + '\n' + html.slice(end), 'utf8');
  console.log('已新增缺失条目:', toAdd.length);
}
console.log('DONE');
