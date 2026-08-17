const https = require('https');
const fs = require('fs');
const la = require('./训练管道/local_answer.js');
la.init();
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const KEY = process.env.DEEPSEEK_KEY, MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const SYS = '你是 ChemAI 评分官。对每条给出"AI助手本地回复"对照"标准参考答案"的评分，满分10分。只输出 JSON 数组，每项：{"question":"原题","score":0-10小数一位}。评分准则：回复准确且覆盖参考答案关键点且与讲义一致→9.5以上；部分覆盖→6-9；答非所问→<6。';
function llm(messages, maxTokens = 16000) { return new Promise((resolve, reject) => { const body = JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0, reasoning_effort: 'low' }); const req = https.request('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY } }, res => { const ch = []; res.on('data', c => ch.push(c)); res.on('end', () => { const d = Buffer.concat(ch).toString('utf8'); try { resolve(JSON.parse(d).choices[0].message.content); } catch (e) { reject(e); } }); }); req.on('error', reject); req.write(body); req.end(); }); }
function pj(t) { const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); const r0 = f ? f[1] : t; const s = r0.indexOf('['); const e = r0.lastIndexOf(']'); const sl = e > s ? r0.slice(s, e + 1) : r0.slice(s); try { return JSON.parse(sl); } catch (err) { const last = sl.lastIndexOf('}'); return JSON.parse(sl.slice(0, last + 1) + ']'); } }
(async () => {
  const results = [];
  for (const q of qs) {
    const ans = la.answer(q.question).answerText.slice(0, 500);
    const entry = [{ question: q.question, referenceAnswer: (q.referenceAnswer || '').slice(0, 300), assistantAnswer: ans }];
    let out = null;
    for (let a = 0; a < 3 && !out; a++) { try { out = pj(await llm([{ role: 'system', content: SYS }, { role: 'user', content: '请评分：\n' + JSON.stringify(entry, null, 2) }])); } catch (e) {} }
    results.push({ id: q.id, score: out ? Number(out[0].score) : 0 });
    if (results.length % 20 === 0) console.log('已评', results.length);
  }
  const n = results.map(r => r.score);
  console.log('\n===== Cycle 2 最终 === 全 199 题 =====');
  console.log('avg=' + (n.reduce((a, b) => a + b, 0) / n.length).toFixed(2) + ' min=' + Math.min(...n));
  console.log('≥9.5: ' + n.filter(s => s >= 9.5).length + '/199');
  results.filter(r => r.score < 9.5).forEach(r => console.log(' <9.5:', r.id, r.score));
  fs.writeFileSync('Agent工作区/Agent-C-答案评分/self_train_cycle2_final_scores.json', JSON.stringify(results, null, 2), 'utf8');
})();
