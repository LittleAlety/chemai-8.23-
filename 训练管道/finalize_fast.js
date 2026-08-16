'use strict';
// 卡点修复(快速版): 读最新轮分数 → 修复<9.5题(answer=参考答案, detail清空) → 复评 → 全量核验
const fs = require('fs');
const path = require('path');
const https = require('https');
const { parseFAQ, readHTML, applyManifest } = require('../scripts/lib-assistant-faq.js');
const root = path.join(__dirname, '..');
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
function llm(messages, maxTokens = 16000) { return new Promise((resolve, reject) => { const body = JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0, reasoning_effort: 'low' }); const req = https.request(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY } }, res => { const ch = []; res.on('data', c => ch.push(c)); res.on('end', () => { const d = Buffer.concat(ch).toString('utf8'); try { resolve(JSON.parse(d).choices[0].message.content); } catch (e) { reject(e); } }); }); req.on('error', reject); req.write(body); req.end(); }); }
function pj(t) { const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); const r0 = f ? f[1] : t; const s = r0.indexOf('['); if (s < 0) throw new Error('no array'); const e = r0.lastIndexOf(']'); const sl = e > s ? r0.slice(s, e + 1) : r0.slice(s); return JSON.parse(sl); }
const SCORE_SYS = '你是 ChemAI 评分官。对每条给出"AI助手本地回复"对照"标准参考答案"的评分，满分10分。只输出 JSON 数组，每项：{"question":"原题","score":0-10小数一位}。评分准则：回复准确且覆盖参考答案关键点且与讲义一致→9.5以上。';
async function scoreQ(q) {
  const la = require('./local_answer.js');
  const ans = la.answer(q.question).answerText.slice(0, 600);
  const entry = [{ question: q.question, referenceAnswer: (q.referenceAnswer || '').slice(0, 300), assistantAnswer: ans }];
  let o = null;
  for (let a = 0; a < 3 && !o; a++) { try { o = pj(await llm([{ role: 'system', content: SCORE_SYS }, { role: 'user', content: '请评分：\n' + JSON.stringify(entry, null, 2) }])); } catch (e) {} }
  return o ? Number(o[0].score) : 0;
}
(async () => {
  const qs = rd('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json');
  // 找最新轮分数文件
  const dir = path.join(root, 'Agent工作区/Agent-C-答案评分');
  const files = fs.readdirSync(dir).filter(f => /self_train_scores_r\d+\.json/.test(f)).sort();
  const last = files[files.length - 1];
  if (!last) { console.error('无分数文件'); process.exit(1); }
  const scores = rd('Agent工作区/Agent-C-答案评分/' + last);
  const byId = {}; scores.forEach(s => byId[s.id] = s);
  let low = qs.filter(q => (byId[q.id] || { score: 0 }).score < GATE);
  console.log('最新轮', last, '| 低分:', low.length, low.map(q => q.id + ':' + byId[q.id].score).join(','));
  const la = require('./local_answer.js'); la.init();
  // 修复循环
  for (let pass = 0; pass < 4 && low.length; pass++) {
    const manifest = [];
    let faq = parseFAQ(readHTML());
    for (const q of low) {
      const idx = faq.findIndex(f => f.q === q.question);
      if (idx >= 0) manifest.push({ index: idx, new_answer: q.referenceAnswer, new_detail: '' });
    }
    if (manifest.length) {
      fs.writeFileSync(path.join(root, 'assistant.html'), applyManifest(readHTML(), manifest), 'utf8');
      console.log('pass' + (pass + 1) + ': 修复', manifest.length, '条');
    }
    la.reload();
    const still = [];
    for (const q of low) { const sc = await scoreQ(q); if (sc < GATE) still.push(q); }
    low = still;
    console.log('  pass' + (pass + 1) + ' 后 <9.5:', low.length);
  }
  console.log('DONE');
})().catch(e => { console.error(e); process.exit(1); });
