const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const fin = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8').replace(/^﻿/, ''));
const q = fin.find(x => x.id === 'Q162');
const la = require('./训练管道/local_answer.js');
la.init();
const r = la.answer(q.question);
console.log('la.answer matchedFAQ:', r.matchedFAQ ? r.matchedFAQ.title.slice(0, 30) : 'null');

// 复刻 matchFAQ（含 fixTypos）
const faq = parseFAQ(readHTML());
const norm = s => String(s || '').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)]).replace(/\s+/g, '');
const typos = { '过氧化轻':'过氧化氢','草酸铁甲':'草酸铁钾','草酸铁钾钾':'草酸铁钾','三草酸合铁甲':'三草酸合铁钾','莫耳盐':'莫尔盐','摩尔塩':'莫尔盐','双氧水水':'双氧水','抽滤瓶':'抽滤','草酸根根':'草酸根','氢氧化铁铁':'氢氧化铁','络合物':'配合物','铁氰化钾':'铁氰化钾' };
const fixT = qx => { let f = qx; for (const k of Object.keys(typos)) if (f.indexOf(k) >= 0) f = f.split(k).join(typos[k]); return f; };
const nq = norm(fixT(q.question));
const IDF = { '实验': 0.4, '制备': 0.5, '化学': 0.5, '操作': 0.6, '步骤': 0.6, '原理': 0.5, '方法': 0.6, '分析': 0.6, '测定': 0.6, '研究': 0.7, '反应': 0.5, '产物': 0.6, '合成': 0.5, '配合物': 0.6 };
let best = null, bestScore = 0;
for (const f of faq) {
  let kh = 0, lk = 0, ks = 0, eh = 0, es = 0;
  (f.keys || []).forEach(k => { const nk = norm(k); if (nk && nq.includes(nk)) { kh++; if (nk.length >= 3) lk++; ks += 2 * (IDF[k] || 1); } });
  (f.ents || []).forEach(en => { if (nq.includes(norm(en))) { eh++; es += 3; } });
  const fq = norm(f.q || '');
  const exactQ = fq && fq === nq;
  const trig = (kh >= 2) || (kh >= 1 && eh >= 1) || (eh >= 2) || exactQ;
  if (!trig) continue;
  const lenB = Math.min(2, ((f.answer || '').length + (f.detail || '').length) / 800);
  let score = ks + es + lk * 0.5 + lenB;
  if (exactQ || (fq.length >= 15 && (nq.includes(fq) || fq.includes(nq)))) score += 200;
  if (score > bestScore) { bestScore = score; best = f; }
}
console.log('复刻 matchFAQ best:', best ? best.title.slice(0, 30) : 'null', '| score:', bestScore.toFixed(1));
// 检查 own 条目的 q 是否 = 题目（字符串级）
const own = faq.find(f => f.q === q.question);
console.log('own 条目存在(字符串匹配):', !!own);
console.log('own 条目 q 前40:', own ? own.q.slice(0, 40) : '');
console.log('题目 前40:', q.question.slice(0, 40));
// 详细: nq vs norm(own.q)
console.log('\n详细对比:');
console.log('fixT(题目) === 题目:', fixT(q.question) === q.question);
console.log('nq 长度:', nq.length, '| norm(own.q) 长度:', own ? norm(own.q).length : '-');
console.log('nq 前30:', nq.slice(0, 30));
console.log('norm(own.q) 前30:', own ? norm(own.q).slice(0, 30) : '');
console.log('nq === norm(own.q):', own ? nq === norm(own.q) : false);
// 找所有 q 含 "氧化完全" 的条目
const kf = faq.filter(f => (f.q || '').includes('氧化完全'));
console.log('\nq含"氧化完全"的条目:', kf.length);
kf.forEach(f => console.log('  title:', f.title.slice(0, 24), '| q===题目:', f.q === q.question, '| q前20:', f.q.slice(0, 20)));
