const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const fin = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8').replace(/^﻿/, ''));
for (const id of ['Q135', 'Q140']) {
  const q = fin.find(x => x.id === id);
  console.log(id, '题目 JSON:', JSON.stringify(q ? q.question : '无').slice(0, 60));
}
const faq = parseFAQ(readHTML());
const bad = faq.filter(f => /请保持原题/.test(f.q || ''));
console.log('含"请保持原题"的条目数:', bad.length);
bad.forEach(f => console.log('  q:', JSON.stringify(f.q).slice(0, 50), '| title:', f.title.slice(0, 20)));
// Q162 exactQ 打分
const norm = s => String(s || '').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)]).replace(/\s+/g, '');
const q162 = fin.find(x => x.id === 'Q162');
const nq = norm(q162.question);
const IDF = { '实验': 0.4, '制备': 0.5, '化学': 0.5, '操作': 0.6, '步骤': 0.6, '原理': 0.5, '方法': 0.6, '分析': 0.6, '测定': 0.6, '研究': 0.7, '反应': 0.5, '产物': 0.6, '合成': 0.5, '配合物': 0.6 };
const scored = [];
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
  scored.push({ score, exactQ, kh, eh, title: f.title.slice(0, 24) });
}
scored.sort((a, b) => b.score - a.score);
console.log('\nQ162 匹配 Top4:');
scored.slice(0, 4).forEach(s => console.log('  ', s.score.toFixed(1), 'exactQ=' + s.exactQ, 'kh=' + s.kh, 'eh=' + s.eh, '|', s.title));
