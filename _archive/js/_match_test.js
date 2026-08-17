// 验证: 针对性条目能否靠独有 keys 胜过通用条目
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const faq = parseFAQ(readHTML());
const norm = s => String(s || '').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)]).replace(/\s+/g, '');
const IDF = { '实验': 0.4, '制备': 0.5, '化学': 0.5, '操作': 0.6, '步骤': 0.6, '原理': 0.5, '方法': 0.6, '分析': 0.6, '测定': 0.6, '研究': 0.7, '反应': 0.5, '产物': 0.6, '合成': 0.5, '配合物': 0.6 };
function scoreOf(f, q) {
  const nq = norm(q); let kh = 0, lk = 0, ks = 0, eh = 0, es = 0;
  (f.keys || []).forEach(k => { const nk = norm(k); if (nq.indexOf(nk) >= 0) { kh++; if (nk.length >= 3) lk++; ks += 2 * (IDF[k] || 1.0); } });
  (f.ents || []).forEach(en => { if (nq.indexOf(norm(en)) >= 0) { eh++; es += 3; } });
  const trig = (kh >= 2) || (kh >= 1 && eh >= 1) || (eh >= 2);
  const lenB = Math.min(2, ((f.answer || '').length + (f.detail || '').length) / 800);
  return { trig, score: trig ? ks + es + lk * 0.5 + lenB : 0, kh, eh };
}
const Q = '若第二步氧化反应中，H₂O₂滴加完后未进行沸腾2分钟除过量H₂O₂，而是直接进入第三步配位，可能带来哪些不利后果？';
// 通用条目（现有匹配）
const generic = faq.find(f => f.title.includes('第二步'));
// 针对性条目（模拟 Opt3 输出）
const tailored = { keys: ['未沸腾除H₂O₂', '过量H₂O₂残留', 'H₂O₂未分解', '配位干扰', 'Fe(OH)₃夹带', '产率下降'], ents: ['H₂O₂', 'Fe(OH)₃'], title: '未除过量H₂O₂的后果', q: Q, answer: '未沸腾除过量H₂O₂会使残留H₂O₂继续氧化草酸根与产物，Fe(OH)₃无法被配位溶解，产物夹带红褐色Fe(OH)₃，产率下降。按讲义应加热至沸保持2分钟分解过量H₂O₂。', detail: '' };
console.log('通用条目:', generic && generic.title);
console.log('  得分:', generic && scoreOf(generic, Q));
console.log('针对性条目: 得分', scoreOf(tailored, Q));
const gs = generic ? scoreOf(generic, Q).score : 0, ts = scoreOf(tailored, Q).score;
console.log('\n针对性条目是否胜出:', ts > gs, `(${ts} vs ${gs})`);
