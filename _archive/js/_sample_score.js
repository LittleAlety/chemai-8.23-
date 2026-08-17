// 抽样: 10 道已命中新条目的题, 逐题隔离评分
const https = require('https');
const fs = require('fs');
const la = require('./训练管道/local_answer.js');
la.init();
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const newTitleSet = new Set(parseFAQ(readHTML()).slice(1055).map(f => f.title));
const matched = qs.filter(q => { const m = la.answer(q.question).matchedFAQ; return m && newTitleSet.has(m.title); });
const sample = matched.slice(0, 10);
const KEY = process.env.DEEPSEEK_KEY, MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const SYS = '你是 ChemAI 评分官。对每条给出"AI助手本地回复"对照"标准参考答案"的评分，满分10分。只输出 JSON 数组，每项：{"question":"原题","score":0-10小数一位,"accuracy":0-10,"completeness":0-10,"manualCompliance":0-10,"why":"一句原因","missing":"缺漏要点(逗号分隔)"}。评分准则：回复准确且覆盖参考答案关键点(数值/步骤/机理)且与讲义一致→9.5以上；部分覆盖→6-9；答非所问/缺失关键→<6。严禁一律给满分或一律压分。';
function llm(messages, maxTokens = 16000) { return new Promise((resolve, reject) => { const body = JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0, reasoning_effort: 'low' }); const req = https.request('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY } }, res => { const ch = []; res.on('data', c => ch.push(c)); res.on('end', () => { const d = Buffer.concat(ch).toString('utf8'); try { resolve(JSON.parse(d).choices[0].message.content); } catch (e) { reject(e); } }); }); req.on('error', reject); req.write(body); req.end(); }); }
function pj(t) { const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); const r0 = f ? f[1] : t; const s = r0.indexOf('['); const e = r0.lastIndexOf(']'); const sl = e > s ? r0.slice(s, e + 1) : r0.slice(s); return JSON.parse(sl); }
(async () => {
  const scores = [];
  for (const q of sample) {
    const ans = la.answer(q.question).answerText.slice(0, 500);
    const entry = [{ question: q.question, referenceAnswer: (q.referenceAnswer || '').slice(0, 300), assistantAnswer: ans }];
    let out = null;
    for (let a = 0; a < 3 && !out; a++) { try { out = pj(await llm([{ role: 'system', content: SYS }, { role: 'user', content: '请评分：\n' + JSON.stringify(entry, null, 2) }])); } catch (e) {} }
    const sc = out ? Number(out[0].score) : 0;
    scores.push(sc);
    console.log(q.id, '→', sc);
  }
  console.log('\navg=' + (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2), '| ≥9.5:', scores.filter(s => s >= 9.5).length + '/' + scores.length);
})();
