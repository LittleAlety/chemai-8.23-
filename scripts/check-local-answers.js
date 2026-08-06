'use strict';
const fs = require('fs');
const path = require('path');

const FAQ = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'faq_unified.json'), 'utf8').replace(/^\uFEFF/, ''));
const norm = s => String(s || '')
  .toLowerCase()
  .replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)])
  .replace(/\s+/g, '');

function bestFAQ(q) {
  const nq = norm(q);
  let best = null, bestScore = 0;
  FAQ.forEach(f => {
    let kh = 0, longKey = 0;
    (f.keys || []).forEach(k => {
      const nk = norm(k);
      if (nk && nq.includes(nk)) { kh++; if (nk.length >= 3) longKey++; }
    });
    let eh = 0;
    (f.ents || []).forEach(en => { if (nq.includes(norm(en))) eh++; });
    const title = norm(f.title || '');
    const q = norm(f.q || f.title || '');
    const titleHit = title && (nq.includes(title) || title.includes(nq));
    const qHit = q && (nq.includes(q) || q.includes(nq));
    if (!((kh >= 2) || (kh >= 1 && eh >= 1) || (eh >= 2) || titleHit || qHit)) return;
    const diffBoost = (/区别|比较|对比|vs/.test(nq) && /vs|比较|区别|对比/.test(f.title || '')) ? 8 : 0;
    const intentBoost = (/为何|为什么|目的|作用/.test(nq) && /为何|为什么|目的|作用/.test(f.title || '')) ? 6 : 0;
    const score = kh * 2 + eh * 3 + longKey * 0.5 + (titleHit ? 10 : 0) + (qHit ? 6 : 0) + diffBoost + intentBoost;
    if (score > bestScore) { bestScore = score; best = f; }
  });
  return best ? best.title + ' (' + bestScore + ')' : '(无命中)';
}

const probes = [
  '如何检验沉淀已洗涤至无SO4²⁻？写出检验方法和判断标准',
  '第二步氧化反应中H2O2滴加完毕后为何加热至沸并保持2分钟？',
  '第一步为何在硫酸亚铁铵溶液中加入数滴3 mol/L硫酸？',
  '如何设计实验验证草酸根处于内界还是外界？',
  '最终产率明显偏低低于60%，列举三种可能原因及改进措施',
  '6% H2O2溅入眼中应如何紧急处理？'
];

probes.forEach(q => console.log(q + '\n -> ' + bestFAQ(q)));
