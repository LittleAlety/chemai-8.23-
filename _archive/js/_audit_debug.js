const https = require('https');
const fs = require('fs');
const KEY = process.env.DEEPSEEK_KEY;
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const q = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n20.json', 'utf8'));
const sys = '你是 ChemAI 审核官，逐题核对题目与参考答案是否符合武汉大学实验讲义、有无科学性错误。只输出 JSON 数组，每项：{"question":"原题原文","valid":true/false,"issue":"问题简述或留空","correction":"修正后的题目(如不需要则留原题)","referenceCorrection":"修正后的参考答案(如不需要则留空)"}。数值冲突一律以讲义为准(6%H₂O₂=8mL)。';
const user = '逐题审核(数值以讲义为准, 6%H₂O₂=8mL)：\n' + JSON.stringify(q.slice(0, 2).map(x => ({ question: x.question, referenceAnswer: x.referenceAnswer })), null, 2);
function call(maxTokens, extra) {
  return new Promise((resolve) => {
    const bodyObj = { model: MODEL, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], max_tokens: maxTokens, temperature: 0.3, ...extra };
    const req = https.request('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const ch = j.choices && j.choices[0];
          resolve({ maxTokens, extra: JSON.stringify(extra), finish: ch && ch.finish_reason, usage: j.usage && JSON.stringify(j.usage), len: (ch && ch.message && ch.message.content || '').length, head: (ch && ch.message && ch.message.content || '').slice(0, 80) });
        } catch (e) { resolve({ maxTokens, error: e.message, raw: d.slice(0, 200) }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(JSON.stringify(bodyObj));
    req.end();
  });
}
(async () => {
  console.log('A) max_tokens=20000:');
  console.log(await call(20000, {}));
  console.log('B) max_tokens=20000 + reasoning_effort=low:');
  console.log(await call(20000, { reasoning_effort: 'low' }));
  console.log('C) max_tokens=8000:');
  console.log(await call(8000, {}));
})();
