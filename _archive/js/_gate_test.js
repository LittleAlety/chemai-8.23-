const la = require('./训练管道/local_answer.js');
la.init();
for (const q of ['为什么用50℃烘干而不是更高温度', '温度对产率有什么影响', '若草酸过量太多会怎样', '光照下产物为什么变色']) {
  const r = la.answer(q);
  console.log('Q:', q);
  console.log('  matched:', r.matchedFAQ ? r.matchedFAQ.title : null, '| conf:', r.confidence && r.confidence.level);
}
