const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const faq = parseFAQ(readHTML());
const norm = s => String(s || '').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)]).replace(/\s+/g, '');
const normQ = s => String(s || '').toLowerCase().replace(/[^一-龥a-z0-9]/g, '');
const IDF = { '实验': 0.4, '制备': 0.5, '化学': 0.5, '操作': 0.6, '步骤': 0.6, '原理': 0.5, '方法': 0.6, '分析': 0.6, '测定': 0.6, '研究': 0.7, '反应': 0.5, '产物': 0.6, '合成': 0.5, '配合物': 0.6 };
function scoreOf(f, q) {
  const nq = norm(q); let kh = 0, lk = 0, ks = 0, eh = 0, es = 0;
  (f.keys || []).forEach(k => { const nk = norm(k); if (nk && nq.indexOf(nk) >= 0) { kh++; if (nk.length >= 3) lk++; ks += 2 * (IDF[k] || 1.0); } });
  (f.ents || []).forEach(en => { if (nq.indexOf(norm(en)) >= 0) { eh++; es += 3; } });
  const trig = (kh >= 2) || (kh >= 1 && eh >= 1) || (eh >= 2);
  const lenB = Math.min(2, ((f.answer || '').length + (f.detail || '').length) / 800);
  return { trig, score: trig ? ks + es + lk * 0.5 + lenB : 0, kh, eh };
}
const Q = '若第二步氧化反应中，H₂O₂滴加完后未进行沸腾2分钟除过量H₂O₂，而是直接进入第三步配位，可能带来哪些不利后果？';
const stopSet = new Set('的了吗呢吧啊呀嘛哦哈嘿请些个只还也都很更最以及于是但是因为所以如果否则然而若则或与和到对从在被把让向为在使给通过按照根据关于对于经过利用使用采用进行发生出现存在包括涉及什么怎么如何为什么哪哪些会能可要需要必须应当'.split(''));
function derive(q, others) {
  const nq = normQ(q); const cand = new Set();
  for (let w = 4; w <= 7; w++) for (let i = 0; i + w <= nq.length; i++) {
    const sub = nq.slice(i, i + w); let ok = true;
    for (const c of sub) if (stopSet.has(c)) { ok = false; break; }
    if (ok) cand.add(sub);
  }
  const th = 3; const arr = [];
  for (const c of cand) { let cnt = 1; for (const o of others) if (o.includes(c)) cnt++; if (cnt <= th) arr.push(c); }
  arr.sort((a, b) => b.length - a.length);
  return arr.slice(0, 6);
}
// 用前 20 题作为 otherQs
const others = ['假设第一步洗涤不彻底，产物中夹带SO₄²⁻，后续烘干会有什么后果？', '为什么第三步要用0.5mol/L草酸逐滴滴加？', '第四步结晶为何必须在暗处进行？', '氧化阶段40℃水浴的作用是什么？'];
const keys = derive(Q, others);
console.log('派生keys:', keys);
const generic = faq.find(f => f.title.includes('第二步'));
const tailored = { keys: keys.concat(['过量H2O2', '沸腾']), ents: ['H₂O₂', 'Fe(OH)₃'], title: '未除过量H2O2的后果', q: Q, answer: '未沸腾除过量H₂O₂会使残留H₂O₂继续氧化草酸根，Fe(OH)₃无法配位溶解，产物夹带红褐色Fe(OH)₃，产率下降。按讲义加热至沸2分钟分解过量H₂O₂。', detail: '' };
console.log('通用得分:', generic && scoreOf(generic, Q));
console.log('针对性得分:', scoreOf(tailored, Q));
console.log('针对性是否胜出:', scoreOf(tailored, Q).score > (generic ? scoreOf(generic, Q).score : 0));
