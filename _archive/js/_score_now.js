// 用当前 FAQ（含全部针对性条目）重新评分 20 题
const https = require('https');
const fs = require('fs');
const la = require('./训练管道/local_answer.js');
la.init();
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n20_final.json', 'utf8'));
const KEY = process.env.DEEPSEEK_KEY;
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const SCORE_SYSTEM = '你是 ChemAI 评分官。对每条给出"AI助手本地回复"对照"标准参考答案"的评分，满分10分。只输出 JSON 数组，每项：{"question":"原题","score":0-10小数一位,"accuracy":0-10,"completeness":0-10,"manualCompliance":0-10,"why":"一句原因","missing":"缺漏要点(逗号分隔)"}。评分准则：回复准确且覆盖参考答案关键点(数值/步骤/机理)且与讲义一致→9.5以上；部分覆盖→6-9；答非所问/缺失关键→<6。严禁一律给满分或一律压分。';
function llm(messages, maxTokens = 16000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0, reasoning_effort: 'low' });
    const req = https.request('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY } }, res => {
      const ch = [];
      res.on('data', c => ch.push(c));
      res.on('end', () => {
        const data = Buffer.concat(ch).toString('utf8');
        try { resolve(JSON.parse(data).choices[0].message.content); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}
function parseJSON(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw0 = fence ? fence[1] : text;
  const s = raw0.indexOf('['); if (s < 0) throw new Error('no array');
  const e = raw0.lastIndexOf(']');
  const sl = e > s ? raw0.slice(s, e + 1) : raw0.slice(s);
  try { return JSON.parse(sl); } catch (err) { const last = sl.lastIndexOf('}'); return JSON.parse(sl.slice(0, last + 1) + ']'); }
}
(async () => {
  const scores = [];
  for (let i = 0; i < qs.length; i += 5) {
    const chunk = qs.slice(i, i + 5);
    const entries = chunk.map(q => ({ question: q.question, referenceAnswer: (q.referenceAnswer || '').slice(0, 300), assistantAnswer: la.answer(q.question).answerText.slice(0, 500) }));
    let items = null;
    for (let a = 0; a < 3 && !items; a++) { try { items = parseJSON(await llm([{ role: 'system', content: SCORE_SYSTEM }, { role: 'user', content: '请按标准参考答案给 AI 助手本地回复评分(0-10)：\n' + JSON.stringify(entries, null, 2) }])); } catch (e) {} }
    (items || []).forEach(v => scores.push(Number(v.score)));
    console.log('批次', i / 5 + 1, '完成, 累计', scores.length);
  }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  console.log('\navg=' + avg.toFixed(2) + ' min=' + Math.min(...scores) + ' max=' + Math.max(...scores));
  console.log('≥9.5: ' + scores.filter(s => s >= 9.5).length + '/' + scores.length);
  console.log('分布:', scores.join(','));
})().catch(e => { console.error(e); process.exit(1); });
