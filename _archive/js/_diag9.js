const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const faq = parseFAQ(readHTML());
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const q = qs.find(x => x.id === 'Q008');
const norm = s => String(s || '').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)]).replace(/\s+/g, '');
const nq = norm(q.question);
const tailored = faq.find(f => f.q === q.question);
console.log('题目(norm) 长度:', nq.length);
if (tailored) console.log('针对性条目 q===题目:', norm(tailored.q) === nq, '| q长度:', norm(tailored.q).length, '| q前30:', tailored.q.slice(0, 30));
const generic = faq.find(f => f.title.includes('第二步：H₂O₂氧化'));
if (generic) {
  const fq = norm(generic.q || '');
  console.log('通用条目 q长度:', fq.length, '| fq===nq:', fq === nq, '| nq含fq:', nq.indexOf(fq) >= 0, '| fq含nq:', fq.indexOf(nq) >= 0);
  console.log('通用 q 前30:', (generic.q || '').slice(0, 30));
}
// 针对性条目 keys 命中数
if (tailored) {
  const hits = (tailored.keys || []).filter(k => nq.includes(norm(k)));
  console.log('针对性条目 keys 命中:', hits.length, hits.slice(0, 6));
}
