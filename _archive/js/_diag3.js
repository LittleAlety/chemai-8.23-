const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const faq = parseFAQ(readHTML());
const newEntries = faq.slice(1055);
console.log('新增条目数:', newEntries.length);
newEntries.slice(0, 3).forEach(e => console.log('  [' + e.title.slice(0, 24) + '] keys:', (e.keys || []).slice(0, 8).join('、')));
// 用 local_answer 的 matchFAQ 逻辑复现 Q001 的最佳匹配
const la = require('./训练管道/local_answer.js');
la.init();
// local_answer 未导出 matchFAQ；直接看 answer 命中的标题
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n20_final.json', 'utf8'));
const q1 = qs[0];
const r = la.answer(q1.question);
console.log('\nQ001 题目:', q1.question.slice(0, 50));
console.log('Q001 命中:', r.matchedFAQ ? r.matchedFAQ.title : null);
// 该命中是否在新增条目中
const hitIsNew = newEntries.some(e => e.title === r.matchedFAQ && r.matchedFAQ);
console.log('命中是否新条目:', hitIsNew);
// 看 Q001 对应的新增条目 keys 是否匹配题目
const norm = s => String(s || '').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)]).replace(/\s+/g, '');
const nq1 = norm(q1.question);
const q1Entry = newEntries.find(e => e.q === q1.question);
if (q1Entry) {
  const hits = (q1Entry.keys || []).filter(k => nq1.includes(norm(k)));
  console.log('Q001 新条目 keys 命中数:', hits.length, hits.slice(0, 5));
} else {
  console.log('Q001 无对应新条目（可能被去重/过滤）');
}
