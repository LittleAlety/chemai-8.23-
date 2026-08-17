const fs = require('fs');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const faq = parseFAQ(readHTML());
console.log('FAQ 总数:', faq.length);
// 逐题专属条目: q 为长问题(>30字)
const spec = faq.filter(f => (f.q || '').length > 30);
console.log('逐题专属条目(q长>30):', spec.length);
// 常规条目
const normal = faq.length - spec.length;
console.log('常规条目:', normal);
// 逐题专属条目按主题前缀粗聚类(取 title 前若干词 or q 的独特段)
// 简化: 按 title 第一个"的关键词"段聚类
const topCount = {};
spec.forEach(f => {
  // 从 title 或 q 提取主题词(找"步骤/反应/氧化/结晶/配位/光解/洗涤/烘干/沉淀/酸/碱/温度"等)
  const s = (f.title || f.q || '');
  const m = s.match(/(第一步|第二步|第三步|第四步|氧化|结晶|配位|光解|洗涤|烘干|沉淀|酸化|草酸|H₂O₂|过氧化氢|Fe|Ksp|LMCT|pH|温度|乙醇|铁氰化钾|产率|溶解度)/);
  const key = m ? m[1] : (s.slice(0, 4));
  topCount[key] = (topCount[key] || 0) + 1;
});
console.log('\n逐题条目主题分布(粗):');
Object.entries(topCount).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(' ', k, ':', v));
// q 长度分布
const lens = spec.map(f => (f.q || '').length);
console.log('\n逐题条目 q 长度: min=' + Math.min(...lens) + ' avg=' + Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) + ' max=' + Math.max(...lens));
