const https = require('https');
const fs = require('fs');
const la = require('./训练管道/local_answer.js');
la.init();
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const q = qs.find(x => x.id === 'Q001');
const r = la.answer(q.question);
console.log('题目:', q.question.slice(0, 60));
console.log('命中:', (r.matchedFAQ || {}).title);
console.log('参考答案长度:', (q.referenceAnswer || '').length, '| 回答长度:', r.answerText.length);
const KEY = process.env.DEEPSEEK_KEY, MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const SCORE_SYSTEM = '你是 ChemAI 评分官。对每条给出"AI助手本地回复"对照"标准参考答案"的评分，满分10分。只输出 JSON 数组，每项：{"question":"原题","score":0-10小数一位,"accuracy":0-10,"completeness":0-10,"manualCompliance":0-10,"why":"一句原因","missing":"缺漏要点(逗号分隔)"}。评分准则：回复准确且覆盖参考答案关键点(数值/步骤/机理)且与讲义一致→9.5以上；部分覆盖→6-9；答非所问/缺失关键→<6。严禁一律给满分或一律压分。';
function llm(messages, maxTokens = 16000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0, reasoning_effort: 'low' });
    const req = https.request('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY } }, res => {
      const ch = []; res.on('data', c => ch.push(c));
      res.on('end', () => { const d = Buffer.concat(ch).toString('utf8'); try { resolve(JSON.parse(d).choices[0].message.content); } catch (e) { reject(e); } });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}
(async () => {
  const entries = [{ question: q.question, referenceAnswer: (q.referenceAnswer || '').slice(0, 300), assistantAnswer: r.answerText.slice(0, 500) }];
  const out = await llm([{ role: 'system', content: SCORE_SYSTEM }, { role: 'user', content: '请评分：\n' + JSON.stringify(entries, null, 2) }]);
  console.log('\n裁判返回:', out.slice(0, 600));
})();
