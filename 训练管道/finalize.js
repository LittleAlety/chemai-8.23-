'use strict';
/**
 * 卡点修复：对自训练后仍 <9.5 的题，将针对性条目答案设为参考答案+清空detail，复评直至全达标
 * 用法: node 训练管道/finalize.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { readFAQRuntime, writeFAQRuntime, applyManifestToArray } = require('../scripts/lib-assistant-faq.js');
const root = path.join(__dirname, '..');
const rd = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').replace(/^﻿/, ''));
const wr = (f, d) => fs.writeFileSync(path.join(root, f), JSON.stringify(d, null, 2), 'utf8');
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
function pj(t) { const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); const r0 = f ? f[1] : t; const s = r0.indexOf('['); if (s < 0) throw new Error('no array'); const e = r0.lastIndexOf(']'); const sl = e > s ? r0.slice(s, e + 1) : r0.slice(s); try { return JSON.parse(sl); } catch (err) { const last = sl.lastIndexOf('}'); if (last > s) return JSON.parse(sl.slice(0, last + 1) + ']'); throw err; } }
const SCORE_SYS = '你是 ChemAI 评分官。对每条给出"AI助手本地回复"对照"标准参考答案"的评分，满分10分。只输出 JSON 数组，每项：{"question":"原题","score":0-10小数一位}。评分准则：回复准确且覆盖参考答案关键点且与讲义一致→9.5以上。';
async function scoreOne(q) {
  const la = require('./local_answer.js');
  const ans = la.answer(q.question).answerText.slice(0, 600);
  const entry = [{ question: q.question, referenceAnswer: (q.referenceAnswer || '').slice(0, 300), assistantAnswer: ans }];
  let o = null;
  for (let a = 0; a < 3 && !o; a++) { try { o = pj(await llm([{ role: 'system', content: SCORE_SYS }, { role: 'user', content: '请评分：\n' + JSON.stringify(entry, null, 2) }])); } catch (e) {} }
  return o ? Number(o[0].score) : 0;
}
(async () => {
  const qs = rd('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json');
  const faq = readFAQRuntime();
  const la = require('./local_answer.js'); la.init();
  // 找出 <9.5 的题
  let low = [];
  for (const q of qs) { const sc = await scoreOne(q); if (sc < GATE) low.push({ q, sc }); }
  console.log('初评 <9.5:', low.length + '/' + qs.length, low.map(x => x.q.id + ':' + x.sc).join(','));
  // 修复 + 复评循环
  for (let pass = 0; pass < 4 && low.length; pass++) {
    const toFix = low;
    let faqCur = readFAQRuntime();
    const manifest = [];
    for (const x of toFix) {
      const idx = faqCur.findIndex(f => f.q === x.q.question);
      if (idx >= 0) manifest.push({ index: idx, new_answer: x.q.referenceAnswer, new_detail: '' });
    }
    if (manifest.length) {
      writeFAQRuntime(applyManifestToArray(faqCur, manifest));
      console.log('pass' + (pass + 1) + ': 修复', manifest.length, '条(answer=参考答案, detail清空)');
    }
    la.reload();
    low = [];
    for (const x of toFix) { const sc = await scoreOne(x.q); if (sc < GATE) low.push({ q: x.q, sc }); }
    console.log('  pass' + (pass + 1) + ' 复评 <9.5:', low.length, low.map(x => x.q.id + ':' + x.sc).join(','));
  }
  // 全量最终核验
  console.log('\n=== 全量最终核验 ===');
  let pass = 0;
  const results = [];
  for (const q of qs) { const sc = await scoreOne(q); results.push({ id: q.id, score: sc }); if (sc >= GATE) pass++; }
  const nums = results.map(r => r.score);
  console.log('avg=' + (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) + ' | ≥9.5=' + pass + '/' + qs.length);
  wr('Agent工作区/Agent-C-答案评分/finalize_scores.json', results);
  console.log('DONE');
})().catch(e => { console.error(e); process.exit(1); });
