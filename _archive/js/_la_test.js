const la = require('./训练管道/local_answer.js');
la.init();
console.log('FAQ:', la.faqCount, 'Corpus:', la.corpusCount);
for (const q of ['三草酸合铁酸钾的理论产量怎么计算', '为什么用50℃烘干而不是更高温度', '为什么要在暗处结晶', '加多少6%的过氧化氢']) {
  const r = la.answer(q);
  console.log('Q:', q);
  console.log('  matched:', r.matchedFAQ ? r.matchedFAQ.title : null, '| conf:', r.confidence && r.confidence.level);
  console.log('  text:', (r.answerText || '').replace(/\n/g, ' ').slice(0, 130));
}
