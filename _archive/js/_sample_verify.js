const https = require('https');
const fs = require('fs');
const la = require('./训练管道/local_answer.js');
la.reload();
const allQs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_all_599.json', 'utf8'));
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const faq = parseFAQ(readHTML());
const genTitles = new Set(faq.filter(f => (f.q || '') === '').map(f => f.title));
const sample = allQs.slice(0, 15);
const KEY = process.env.DEEPSEEK_KEY, MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const SYS = '你是 ChemAI 评分官。对每条给出AI助手本地回复对照标准参考答案的评分，满分10分。只输出 JSON 数组，每项：{"question":"原题","score":0-10小数一位}。回复准确且覆盖参考答案关键点且与讲义一致→9.5以上。';
function llm(messages) { return new Promise((resolve, reject) => { const body = JSON.stringify({ model: MODEL, messages, max_tokens: 16000, temperature: 0, reasoning_effort: 'low' }); const req = https.request('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY } }, res => { const ch = []; res.on('data', c => ch.push(c)); res.on('end', () => { const d = Buffer.concat(ch).toString('utf8'); try { resolve(JSON.parse(d).choices[0].message.content); } catch (e) { reject(e); } }); }); req.on('error', reject); req.write(body); req.end(); }); }
function pj(t) { const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); const r0 = f ? f[1] : t; const s = r0.indexOf('['); const e = r0.lastIndexOf(']'); const sl = e > s ? r0.slice(s, e + 1) : r0.slice(s); return JSON.parse(sl); }
(async () => {
  let hitGen = 0, pass = 0;
  for (const q of sample) {
    const r = la.answer(q.question);
    const m = r.matchedFAQ ? r.matchedFAQ.title : null;
    const isGen = m && genTitles.has(m);
    if (isGen) hitGen++;
    const entry = [{ question: q.question, referenceAnswer: (q.referenceAnswer || '').slice(0, 300), assistantAnswer: r.answerText.slice(0, 600) }];
    let o = null;
    for (let a = 0; a < 3 && !o; a++) { try { o = pj(await llm([{ role: 'system', content: SYS }, { role: 'user', content: '请评分：\n' + JSON.stringify(entry, null, 2) }])); } catch (e) {} }
    const sc = o ? Number(o[0].score) : 0;
    if (sc >= 9.5) pass++;
    console.log(q.id, sc, (isGen ? '✓通用' : '·'), '|', (m || 'null').slice(0, 24));
  }
  console.log('\n命中通用条目:', hitGen + '/15 | ≥9.5:', pass + '/15');
})();
