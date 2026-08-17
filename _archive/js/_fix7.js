const https = require('https');
const fs = require('fs');
const { parseFAQ, readHTML, applyManifest } = require('./scripts/lib-assistant-faq.js');
const la = require('./训练管道/local_answer.js');
la.init();
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const scores = JSON.parse(fs.readFileSync('Agent工作区/Agent-报告/self_train_final_scores.json', 'utf8'));
const byId = {}; scores.forEach(s => byId[s.id] = s);
const targets = qs.filter(q => byId[q.id].score < 9.5).map(q => ({ id: q.id, question: q.question, referenceAnswer: q.referenceAnswer, feedback: byId[q.id].why }));
const KEY = process.env.DEEPSEEK_KEY, MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const SYS = '你是 ChemAI 答案精修官。根据标准参考答案与评分反馈，重写一条FAQ条目的answer，使其在10分制评分中达到9.5以上。只输出 JSON 数组，每项：{"question":"原题","answer":"重写后的答案(120~200字, 覆盖参考答案全部要点, 修正反馈指出的问题, 以武汉大学讲义为准: 6%H₂O₂=8mL等)"}。';
function llm(messages, maxTokens = 16000) { return new Promise((resolve, reject) => { const body = JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0.3, reasoning_effort: 'low' }); const req = https.request('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY } }, res => { const ch = []; res.on('data', c => ch.push(c)); res.on('end', () => { const d = Buffer.concat(ch).toString('utf8'); try { resolve(JSON.parse(d).choices[0].message.content); } catch (e) { reject(e); } }); }); req.on('error', reject); req.write(body); req.end(); }); }
function pj(t) { const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); const r0 = f ? f[1] : t; const s = r0.indexOf('['); const e = r0.lastIndexOf(']'); const sl = e > s ? r0.slice(s, e + 1) : r0.slice(s); try { return JSON.parse(sl); } catch (err) { const last = sl.lastIndexOf('}'); return JSON.parse(sl.slice(0, last + 1) + ']'); } }
(async () => {
  let html = readHTML();
  let faq = parseFAQ(html);
  const manifest = [];
  for (const t of targets) {
    const idx = faq.findIndex(f => f.q === t.question);
    if (idx < 0) { console.log(t.id, '无针对性条目'); continue; }
    const entry = [{ question: t.question, referenceAnswer: t.referenceAnswer, feedback: t.feedback, currentAnswer: faq[idx].answer }];
    let out = null;
    for (let a = 0; a < 3 && !out; a++) { try { out = pj(await llm([{ role: 'system', content: SYS }, { role: 'user', content: '请重写：\n' + JSON.stringify(entry, null, 2) }])); } catch (e) { console.log('  重试', a + 1, e.message.slice(0, 60)); } }
    const newAns = out && out[0] && out[0].answer;
    if (newAns && newAns.length >= 60) { manifest.push({ index: idx, new_answer: newAns }); console.log(t.id, '已重写答案:', newAns.length, '字'); }
    else console.log(t.id, '重写失败');
  }
  if (manifest.length) {
    html = applyManifest(html, manifest);
    fs.writeFileSync('assistant.html', html, 'utf8');
    console.log('已更新', manifest.length, '条答案');
  }
  console.log('DONE-FIX7（复评请另跑）');
})();
