'use strict';
// 阶段四前置：对 round4 计算/步骤 200 题，用 local_answer.answer() 本地回复 → LLM-as-Judge 逐题评分（门禁 9.5）。
// 只评分，不写 FAQ、不触达生产库。运行：node _score_baseline.js   （LIMIT=N 可只评前 N 题做冒烟）
const fs = require('fs');
const path = require('path');
const https = require('https');
const R4 = path.join(__dirname, '..');
const la = require(path.join(R4, '训练管道/local_answer.js'));
la.init();

const BANK = process.env.BANK || 'Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json';
const qsAll = JSON.parse(fs.readFileSync(path.join(R4, BANK), 'utf8'));
const LIMIT = Number(process.env.LIMIT || qsAll.length);
const qs = qsAll.slice(0, LIMIT);
console.log('loaded questions:', qsAll.length, '→ 本批评分:', qs.length);

const homeDir = process.env.HOME || process.env.USERPROFILE || '';
const envPath = path.join(homeDir, '.codex/skills/claude-vision/.env');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = key => { const m = env.match(new RegExp('^' + key + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const API_KEY = getEnv('DASHSCOPE_API_KEY') || process.env.DEEPSEEK_KEY || getEnv('DEEPSEEK_KEY');
const API_URL = (getEnv('DASHSCOPE_API_KEY') || getEnv('DASHSCOPE_BASE_URL'))
  ? (getEnv('DASHSCOPE_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '') + '/chat/completions'
  : 'https://api.deepseek.com/v1/chat/completions';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
if (!API_KEY) { console.error('缺少 DEEPSEEK_KEY'); process.exit(1); }
function llm(messages, maxTokens, temp) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: temp, reasoning_effort: 'low' });
    const req = https.request(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' ' + data.slice(0, 200)));
        try { resolve(JSON.parse(data).choices[0].message.content); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}
function parseJSON(s) {
  const t = String(s || '').replace(/```/g, '');
  try { return JSON.parse(t); } catch (e) {}
  const sb = t.replace(/^\s*\[?/, '[').replace(/\]?\s*$/, ']');
  try { return JSON.parse(sb); } catch (e2) {}
  // 最后手段：正则抠 score（判分只需 score；why/missing 可空），避免 LLM 偶发非 JSON 输出导致稳评=0 噪声。
  const m = t.match(/"score"\s*:\s*([0-9]+(?:\.[0-9]+)?)/) || t.match(/score\s*[:：]?\s*([0-9]+(?:\.[0-9]+)?)/);
  if (m) return [{ score: Number(m[1]), why: '', missing: '', accuracy: 0, completeness: 0, manualCompliance: 0 }];
  return null;
}
async function llmJSON(system, user, maxTokens, temp) {
  for (let a = 0; a < 3; a++) {
    try { const out = await llm([{ role: 'system', content: system }, { role: 'user', content: user }], maxTokens, temp); const items = parseJSON(out); if (Array.isArray(items)) return items; else if (process.env.DEBUGRAW) console.log('  解析失败 out=…' + String(out).slice(-400)); } catch (e) { console.log('    LLM重试 ' + (a + 1) + ': ' + e.message.slice(0, 80)); }
  }
  return null;
}
const SCORE_SYSTEM = '你是 ChemAI 评分官。对每条给出"AI助手本地回复"对照"标准参考答案"的评分，满分10分。只输出 JSON 数组，' +
  '每项：{"question":"原题","score":0-10小数一位,"accuracy":0-10,"completeness":0-10,"manualCompliance":0-10,"why":"一句原因","missing":"缺漏要点(逗号分隔)"}。' +
  '评分准则：回复准确且覆盖参考答案关键点(数值/步骤/机理)且与讲义一致→9.5以上；部分覆盖→6-9；答非所问/缺失关键→<6。严禁一律给满分或一律压分。';

// ---- 本地回复（仅本地，无 LLM） ----
const replies = qs.map(q => { const r = la.answer(q.question); return { id: q.id, question: q.question, answerText: r.answerText || '' }; });
const rById = {}; replies.forEach(r => rById[r.id] = r);
console.log('本地回复完成', replies.length);
if (LIMIT <= 3) {
  const q = qs[0]; const r = la.answer(q.question);
  console.log('--- 样例 judge prompt (Q' + q.id + ') ---');
  console.log(JSON.stringify({ question: q.question, referenceAnswer: (q.referenceAnswer || '').slice(0, 300), assistantAnswer: (r.answerText || '').slice(0, 500) }, null, 2));
}

// ---- 逐题隔离评分 ----
function buildUser(q) {
  const e = { question: q.question, referenceAnswer: (q.referenceAnswer || '').slice(0, 300), assistantAnswer: (rById[q.id] || { answerText: '' }).answerText.slice(0, 500) };
  return '请按标准参考答案给 AI 助手本地回复评分(0-10)：\n' + JSON.stringify(e, null, 2);
}
async function runPool(items, worker, size) {
  const out = new Array(items.length); let idx = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (idx < items.length) { const i = idx++; out[i] = await worker(items[i], i); } }));
  return out;
}
const GATE = 9.5;
(async () => {
  console.log('开始评分 ' + qs.length + ' 题 (并发5, 逐题隔离)...');
  const raw = await runPool(qs, async (q) => {
    let items = await llmJSON(SCORE_SYSTEM, buildUser(q), 1200, 0);
    // 解析失败（LLM 偶发输出非 JSON 长文）：降 max_tokens 强制精炼 JSON 再试，避免判分=0 噪声。
    if (!items) items = await llmJSON(SCORE_SYSTEM + ' 输出必须为合法 JSON 数组，只输出数组，不要任何额外文字。', buildUser(q), 700, 0);
    return items && items[0] ? items[0] : null;
  }, 5);
  const results = qs.map((q, i) => { const v = raw[i]; return { id: q.id, score: v ? Number(v.score) : 0, why: v ? (v.why || '') : '', missing: v ? (v.missing || '') : '' }; });
  fs.writeFileSync(path.join(R4, 'Agent工作区/Agent-报告/self_train_baseline_scores.json'), JSON.stringify(results, null, 2), 'utf8');
  const nums = results.map(r => Number(r.score)).filter(n => !isNaN(n));
  const minScore = nums.length ? Math.min(...nums) : 0;
  const avgScore = Math.round(nums.reduce((x, y) => x + y, 0) / nums.length * 100) / 100;
  const low = results.filter(r => r.score < GATE);
  console.log('===== 基准评分 =====');
  console.log('总题数=' + qs.length + ' 已评=' + nums.length + ' avg=' + avgScore + ' min=' + minScore + ' 低分(<9.5)=' + low.length + (minScore >= GATE && nums.length === qs.length ? '  ✅全过门禁' : ''));
  if (low.length) {
    console.log('\n—— 低分题 ——');
    low.slice(0, 40).forEach(r => console.log('  ' + r.id + ' score=' + r.score + ' ' + (r.why || '').slice(0, 60)));
  }
})().catch(e => { console.error('基准评分失败:', e); process.exit(1); });
