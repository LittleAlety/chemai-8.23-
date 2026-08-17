const https = require('https');
const fs = require('fs');
const { parseFAQ, readHTML, applyManifest } = require('./scripts/lib-assistant-faq.js');
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const q = qs.find(x => x.id === 'Q077');
const faq = parseFAQ(readHTML());
const idx = faq.findIndex(f => f.q === q.question);
const KEY = process.env.DEEPSEEK_KEY, MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const SYS = '你是 ChemAI 答案精修官。根据标准参考答案重写答案，要求：准确、完整、规范、不附加无关参考信息，10分制可达9.5+。只输出 JSON 数组，每项：{"question":"原题","answer":"重写后的答案(120~200字, 以武汉大学讲义为准: 6%H₂O₂=8mL, Ksp(FeC₂O₄)=3.2×10⁻⁷等)"}。';
function llm(messages, maxTokens = 16000) { return new Promise((resolve, reject) => { const body = JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0.3, reasoning_effort: 'low' }); const req = https.request('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY } }, res => { const ch = []; res.on('data', c => ch.push(c)); res.on('end', () => { const d = Buffer.concat(ch).toString('utf8'); try { resolve(JSON.parse(d).choices[0].message.content); } catch (e) { reject(e); } }); }); req.on('error', reject); req.write(body); req.end(); }); }
function pj(t) { const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); const r0 = f ? f[1] : t; const s = r0.indexOf('['); const e = r0.lastIndexOf(']'); const sl = e > s ? r0.slice(s, e + 1) : r0.slice(s); return JSON.parse(sl); }
(async () => {
  const entry = [{ question: q.question, referenceAnswer: q.referenceAnswer, currentAnswer: faq[idx].answer, feedback: '末尾附加无关参考信息略影响规范性，请删除无关内容，聚焦题目要点' }];
  let out = null;
  for (let a = 0; a < 3 && !out; a++) { try { out = pj(await llm([{ role: 'system', content: SYS }, { role: 'user', content: '请重写：\n' + JSON.stringify(entry, null, 2) }])); } catch (e) {} }
  const newAns = out && out[0] && out[0].answer;
  if (newAns && newAns.length >= 60) {
    const html = applyManifest(readHTML(), [{ index: idx, new_answer: newAns }]);
    fs.writeFileSync('assistant.html', html, 'utf8');
    console.log('Q077 已重写:', newAns.length, '字');
  } else console.log('重写失败');
})();
