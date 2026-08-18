'use strict';
/** v43 matchFAQ 命中测试：验证新条目可被相关查询命中 */
const { readFAQRuntime } = require('./lib-assistant-faq.js');
const faq = readFAQRuntime();

const SUBMAP = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '⁻': '-', '⁺': '+' };
const norm = s => String(s || '').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => SUBMAP[c] || c).replace(/\s+/g, '');
const IDF = { '实验': 0.4, '制备': 0.5, '化学': 0.5, '操作': 0.6, '步骤': 0.6, '原理': 0.5, '方法': 0.6, '分析': 0.6, '测定': 0.6, '研究': 0.7, '反应': 0.5, '产物': 0.6, '合成': 0.5, '配合物': 0.6 };

function match(q) {
  const nq = norm(q);
  let best = null, bs = 0;
  for (const f of faq) {
    let kh = 0, cs = 0;
    for (const k of (f.keys || [])) {
      const nk = norm(k);
      if (nq.includes(nk)) { kh++; if (nk.length >= 3) cs += 0.5; cs += 2 * (IDF[k] || 1); }
    }
    let eh = 0, es = 0;
    for (const en of (f.ents || [])) { if (nq.includes(norm(en))) { eh++; es += 3; } }
    const trig = (kh >= 2) || (kh >= 1 && eh >= 1) || (eh >= 2);
    if (!trig) continue;
    const sc = cs + es + Math.min(2, ((f.answer || '').length + (f.detail || '').length) / 800);
    if (sc > bs) { bs = sc; best = f; }
  }
  return { title: best ? best.title : '(无命中)', score: bs };
}

const queries = [
  '草酸根是平面还是扭转', '铁草酸盐光解定量实验', '碘化钾光化学氧化', '闪光光解测动力学',
  '配离子激发态电子转移', '二草酸合铜化学式怎么写', '二草酸合铜组成测定', '高锰酸钾草酸化学发光',
  '草酸镉晶体结构', '铁铬草酸热分析', '镍配合物核磁共振', '过渡金属配合物综合实验',
  '双核铜配合物', '草酸铁制备', '配离子分布系数', '综合实验教学设计',
  '莫尔盐电导率', '莫尔盐标定高锰酸钾', '绿矾热分解动力学', '硫酸亚铁铵实验改进', '硫酸亚铁铵晶体结晶'
];
for (const q of queries) {
  const r = match(q);
  console.log((q + '    ').slice(0, 22), '=>', r.title, '(score ' + r.score + ')');
}
