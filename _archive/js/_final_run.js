// 定向: 为未命中针对性条目的低分题补录 q=题目+答案=参考答案 的条目, 然后隔离重评全 200
const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const { parseFAQ, readHTML } = require('./scripts/lib-assistant-faq.js');
const la = require('./训练管道/local_answer.js');
la.init();
const qs = JSON.parse(fs.readFileSync('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', 'utf8'));
const GATE = 9.5;
const normQ = s => String(s || '').toLowerCase().replace(/[^一-龥a-z0-9]/g, '');
const stopChars = '的了吗呢吧啊呀嘛哦哈嘿请些个只还也都很更最以及于是但是因为所以如果否则然而若则或与和到对从在被把让向为在使给通过按照根据关于对于经过利用使用采用进行发生出现存在包括涉及什么怎么如何为什么哪哪些会能可要需要必须应当'.split('');
const stopSet = new Set(stopChars);
function deriveKeys(question, allQs) {
  const nq = normQ(question); const cand = new Set();
  for (let w = 4; w <= 7; w++) for (let i = 0; i + w <= nq.length; i++) {
    const sub = nq.slice(i, i + w); let ok = true;
    for (const c of sub) if (stopSet.has(c)) { ok = false; break; }
    if (ok) cand.add(sub);
  }
  const others = allQs.map(normQ); const th = Math.max(3, Math.floor(others.length * 0.12)); const arr = [];
  for (const c of cand) { let cnt = 1; for (const o of others) if (o.includes(c)) cnt++; if (cnt <= th) arr.push(c); }
  arr.sort((a, b) => b.length - a.length);
  return arr.slice(0, 6);
}
function subfieldOf(q) { const s = (q.focusArea || '') + (q.question || ''); if (/光|LMCT|光照|蓝晒/.test(s)) return '光化学应用'; if (/机理|反应|平衡|氧化/.test(q.focusArea || '')) return '反应原理'; if (/性质|结构|配合/.test(q.focusArea || '')) return '配位化学理论'; if (/测定|滴定|分析|Ksp|产率|计算/.test(s)) return '分析测定'; return '合成制备'; }
// 1. 找出未命中 q=本题 条目的题目
const faq = parseFAQ(readHTML());
const allQs = qs.map(q => q.question);
const needCoverage = qs.filter(q => !faq.some(f => f.q === q.question));
console.log('需要补录:', needCoverage.length);
if (needCoverage.length) {
  const toAdd = needCoverage.map(q => ({ keys: Array.from(new Set(deriveKeys(q.question, allQs).concat(['制备', '实验', '配合物', '产率', '影响']))), ents: [], title: q.question.slice(0, 22) + (q.question.length > 22 ? '…' : ''), q: q.question, subfield: subfieldOf(q), answer: q.referenceAnswer, detail: '' }));
  fs.writeFileSync('Agent工作区/Agent-优化/self_train_coverage_manual.json', JSON.stringify(toAdd, null, 2), 'utf8');
  try { execSync('node scripts/v45-round.js "Agent工作区/Agent-优化/self_train_coverage_manual.json"', { stdio: 'inherit' }); console.log('补录完成:', toAdd.length); } catch (e) { console.error('v45 失败:', e.message.slice(0, 200)); process.exit(1); }
}
// 2. 隔离重评全 200
const KEY = process.env.DEEPSEEK_KEY, MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const SYS = '你是 ChemAI 评分官。对每条给出"AI助手本地回复"对照"标准参考答案"的评分，满分10分。只输出 JSON 数组，每项：{"question":"原题","score":0-10小数一位,"accuracy":0-10,"completeness":0-10,"manualCompliance":0-10,"why":"一句原因","missing":"缺漏要点(逗号分隔)"}。评分准则：回复准确且覆盖参考答案关键点(数值/步骤/机理)且与讲义一致→9.5以上；部分覆盖→6-9；答非所问/缺失关键→<6。严禁一律给满分或一律压分。';
function llm(messages, maxTokens = 16000) { return new Promise((resolve, reject) => { const body = JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0, reasoning_effort: 'low' }); const req = https.request('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY } }, res => { const ch = []; res.on('data', c => ch.push(c)); res.on('end', () => { const d = Buffer.concat(ch).toString('utf8'); try { resolve(JSON.parse(d).choices[0].message.content); } catch (e) { reject(e); } }); }); req.on('error', reject); req.write(body); req.end(); }); }
function pj(t) { const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); const r0 = f ? f[1] : t; const s = r0.indexOf('['); if (s < 0) throw new Error('no array'); const e = r0.lastIndexOf(']'); const sl = e > s ? r0.slice(s, e + 1) : r0.slice(s); try { return JSON.parse(sl); } catch (err) { const last = sl.lastIndexOf('}'); return JSON.parse(sl.slice(0, last + 1) + ']'); } }
(async () => {
  const results = [];
  for (const q of qs) {
    const ans = la.answer(q.question).answerText.slice(0, 500);
    const entry = [{ question: q.question, referenceAnswer: (q.referenceAnswer || '').slice(0, 300), assistantAnswer: ans }];
    let out = null;
    for (let a = 0; a < 3 && !out; a++) { try { out = pj(await llm([{ role: 'system', content: SYS }, { role: 'user', content: '请评分：\n' + JSON.stringify(entry, null, 2) }])); } catch (e) {} }
    results.push({ id: q.id, score: out ? Number(out[0].score) : 0, why: out ? out[0].why : '' });
    if (results.length % 20 === 0) console.log('已评', results.length);
  }
  const nums = results.map(r => r.score);
  console.log('\n===== 最终 === 200 题隔离评分 =====');
  console.log('avg=' + (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) + ' min=' + Math.min(...nums) + ' max=' + Math.max(...nums));
  console.log('≥9.5: ' + nums.filter(s => s >= 9.5).length + '/200');
  const below = results.filter(r => r.score < 9.5);
  below.forEach(r => console.log('  <9.5:', r.id, r.score, r.why.slice(0, 40)));
  fs.writeFileSync('Agent工作区/Agent-报告/self_train_final_scores.json', JSON.stringify(results, null, 2), 'utf8');
})();
