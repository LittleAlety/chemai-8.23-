const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const q = qs.find(x => x.id === 'Q039');
const faq = parseFAQ(readHTML());
const norm = s => String(s || '').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)]).replace(/\s+/g, '');
const nq = norm(q.question);
const own = faq.find(f => f.q === q.question);
const gaos = faq.find(f => f.title && f.title.includes('高自旋'));
console.log('Q039 题目:', q.question.slice(0, 50));
console.log('own 条目 q===题目:', own ? norm(own.q) === nq : '无own条目');
console.log('own 条目 title:', own ? own.title.slice(0, 30) : '无');
console.log('own 条目 q:', own ? own.q.slice(0, 40) : '');
console.log('高自旋条目 q===题目:', gaos ? norm(gaos.q) === nq : '无');
console.log('高自旋条目 q:', gaos ? (gaos.q || '').slice(0, 40) : '');
// 高自旋 q 是否被题目包含(子串+50)
if (gaos && gaos.q) { const fq = norm(gaos.q); console.log('题目含高自旋q:', nq.includes(fq), '| fq长度:', fq.length); }
// 题目是否等于高自旋q 的变体
console.log('题目norm:', nq.slice(0, 40));
console.log('高自旋q norm:', gaos ? norm(gaos.q).slice(0, 40) : '');
