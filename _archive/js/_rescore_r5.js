'use strict';
// 全量隔离重评（并发8）：核验重复5最终状态
const fs = require('fs');
const path = require('path');
const https = require('https');
const root = __dirname;
const rd = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').replace(/^﻿/, ''));
const homeDir = process.env.HOME || process.env.USERPROFILE || '';
const envPath = path.join(homeDir, '.codex/skills/claude-vision/.env');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = k => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const KEY = process.env.DEEPSEEK_KEY || getEnv('DEEPSEEK_KEY') || getEnv('DASHSCOPE_API_KEY');
const API_URL = (process.env.DEEPSEEK_KEY || getEnv('DEEPSEEK_KEY')) ? 'https://api.deepseek.com/v1/chat/completions' : (getEnv('DASHSCOPE_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1') + '/chat/completions';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const GATE = 9.5;
if (!KEY) { console.error('缺 key'); process.exit(1); }
function llm(messages) { return new Promise((resolve, reject) => { const body = JSON.stringify({ model: MODEL, messages, max_tokens: 16000, temperature: 0, reasoning_effort: 'low' }); const req = https.request(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY } }, res => { const ch = []; res.on('data', c => ch.push(c)); res.on('end', () => { const d = Buffer.concat(ch).toString('utf8'); try { resolve(JSON.parse(d).choices[0].message.content); } catch (e) { reject(e); } }); }); req.on('error', reject); req.write(body); req.end(); }); }
function pj(t) { const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); const r0 = f ? f[1] : t; const s = r0.indexOf('['); if (s < 0) throw new Error('no array'); const e = r0.lastIndexOf(']'); const sl = e > s ? r0.slice(s, e + 1) : r0.slice(s); return JSON.parse(sl); }
const SCORE_SYS = '你是 ChemAI 评分官。对每条给出"AI助手本地回复"对照"标准参考答案"的评分，满分10分。只输出 JSON 数组，每项：{"question":"原题","score":0-10小数一位}。评分准则：回复准确且覆盖参考答案关键点且与讲义一致→9.5以上。';
async function scoreOne(q, la) {
  const ans = la.answer(q.question).answerText.slice(0, 600);
  const entry = [{ question: q.question, referenceAnswer: (q.referenceAnswer || '').slice(0, 300), assistantAnswer: ans }];
  let o = null;
  for (let a = 0; a < 3 && !o; a++) { try { o = pj(await llm([{ role: 'system', content: SCORE_SYS }, { role: 'user', content: '请评分：\n' + JSON.stringify(entry, null, 2) }])); } catch (e) {} }
  return o ? Number(o[0].score) : 0;
}
(async () => {
  const qs = rd('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json');
  const la = require('./训练管道/local_answer.js'); la.init();
  console.log('重评 ' + qs.length + ' 题（并发8）');
  const out = new Array(qs.length);
  let idx = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (idx < qs.length) { const i = idx++; out[i] = await scoreOne(qs[i], la); }
  }));
  const n = out.filter(x => x !== undefined);
  const nums = n;
  console.log('avg=' + (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) + ' min=' + Math.min(...nums));
  console.log('≥9.5: ' + nums.filter(s => s >= GATE).length + '/' + qs.length);
  const low = qs.filter((q, i) => nums[i] < GATE);
  low.forEach(q => console.log(' <9.5:', q.id, q.question.slice(0, 40)));
  fs.writeFileSync(path.join(root, 'Agent工作区/Agent-C-答案评分/final_r5_rescore.json'), JSON.stringify(qs.map((q, i) => ({ id: q.id, score: nums[i] })), null, 2), 'utf8');
  console.log('DONE');
})().catch(e => { console.error(e); process.exit(1); });
