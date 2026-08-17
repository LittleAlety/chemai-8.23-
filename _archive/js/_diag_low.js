const https = require('https');
const fs = require('fs');
const path = require('path');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const la = require('./训练管道/local_answer.js');
la.init();
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const scores = JSON.parse(fs.readFileSync('Agent工作区/Agent-C-答案评分/self_train_scores_r5.json', 'utf8'));
const byId = {}; scores.forEach(s => byId[s.id] = s);
const low = qs.filter(q => byId[q.id] && byId[q.id].score < 9.5);
const faq = parseFAQ(readHTML());
const homeDir = process.env.HOME || process.env.USERPROFILE || '';
const envPath = path.join(homeDir, '.codex/skills/claude-vision/.env');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = k => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const KEY = process.env.DEEPSEEK_KEY || getEnv('DEEPSEEK_KEY') || getEnv('DASHSCOPE_API_KEY');
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
function llm(messages) { return new Promise((resolve, reject) => { const body = JSON.stringify({ model: MODEL, messages, max_tokens: 16000, temperature: 0, reasoning_effort: 'low' }); const req = https.request(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY } }, res => { const ch = []; res.on('data', c => ch.push(c)); res.on('end', () => { const d = Buffer.concat(ch).toString('utf8'); try { resolve(JSON.parse(d).choices[0].message.content); } catch (e) { reject(e); } }); }); req.on('error', reject); req.write(body); req.end(); }); }
function pj(t) { const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); const r0 = f ? f[1] : t; const s = r0.indexOf('['); const e = r0.lastIndexOf(']'); const sl = e > s ? r0.slice(s, e + 1) : r0.slice(s); return JSON.parse(sl); }
(async () => {
  const SYS = '你是 ChemAI 评分官。对每条给出AI助手本地回复对照标准参考答案的评分，满分10分。只输出 JSON 数组，每项：{"question":"原题","score":0-10小数一位,"why":"原因"}。回复准确且覆盖参考答案关键点→9.5以上。';
  for (const q of low) {
    const r = la.answer(q.question);
    const m = r.matchedFAQ ? r.matchedFAQ.title : null;
    const isRef = m && faq.some(f => f.q === q.question && f.title === m);
    const entry = [{ question: q.question, referenceAnswer: (q.referenceAnswer || '').slice(0, 300), assistantAnswer: r.answerText.slice(0, 600) }];
    let o = null;
    for (let a = 0; a < 3 && !o; a++) { try { o = pj(await llm([{ role: 'system', content: SYS }, { role: 'user', content: '请评分：\n' + JSON.stringify(entry, null, 2) }])); } catch (e) {} }
    const sc = o ? Number(o[0].score) : 0;
    console.log(q.id, '→', sc, sc < 9.5 ? '✗' : '✓', '| 命中自身条目:', isRef, '|', (m || 'null').slice(0, 22));
    if (sc < 9.5) { console.log('   原因:', o ? o[0].why.slice(0, 90) : ''); console.log('   回答前70字:', r.answerText.replace(/\n/g, ' ').slice(0, 70)); }
  }
})();
