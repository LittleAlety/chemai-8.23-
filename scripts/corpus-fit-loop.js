/* 语料-文献贴合度评分 loop（v61.2）
 * 对题集每题: local_answer 作答 → LLM 双维评分(accuracy 0-10 / corpusFit 0-10)
 * corpusFit: 答案内容是否由语料库(文献)充分支撑、语料是否覆盖该题主题
 * 用法: node scripts/corpus-fit-loop.js <round>
 *   round=1  → 写 Agent工作区/corpus_fit_r1.json
 *   round=2  → 写 Agent工作区/corpus_fit_r2.json (验证)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const W = p => path.join(root, p);
const readJson = fp => JSON.parse(fs.readFileSync(W(fp), 'utf8').replace(/^﻿/, ''));
const writeJson = (fp, d) => fs.writeFileSync(W(fp), JSON.stringify(d, null, 2), 'utf8');
const round = process.argv[2] || '1';

// LLM（DeepSeek，dotenv key）
const homeDir = process.env.USERPROFILE || process.env.HOME || '';
const envPath = path.join(homeDir, '.codex/skills/claude-vision/.env');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = key => { const m = env.match(new RegExp('^' + key + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const API_KEY = process.env.DEEPSEEK_KEY || getEnv('DEEPSEEK_KEY');
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-v4-flash';
if (!API_KEY) { console.error('缺 DEEPSEEK_KEY'); process.exit(1); }
function llmJSON(system, user, maxTok = 6000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTok, temperature: 0 });
    const req = https.request(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' ' + data.slice(0, 200)));
        const content = JSON.parse(data).choices[0].message.content;
        const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const raw = fence ? fence[1] : content;
        const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
        if (s < 0 || e <= s) return reject(new Error('JSON 解析失败'));
        try { resolve(JSON.parse(raw.slice(s, e + 1))); } catch (er) { reject(er); }
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

const JUDGE_SYSTEM = '你是 ChemAI 语料贴合度评审官。依据武汉大学实验讲义与语料库(文献)，对 AI 助手的答案做双维度 0-10 评分。只输出 JSON 对象：' +
  '{"accuracy":0-10,"corpusFit":0-10,"why":"一句话理由"}。' +
  'accuracy=答案化学正确性与完整性(对照讲义)；corpusFit=答案内容是否由所给语料库文献充分支撑、语料是否覆盖该题主题(若语料对本题支撑弱或无相关文献则低分)。' +
  '数值以讲义为准(6%H₂O₂=8mL、失水100℃、50℃烘干)。';

// 语料检索：关键词重叠找相关条目
const corpus = readJson('data/corpus.json');
const entries = corpus.entries || corpus;
function norm(s) { return String(s || '').toLowerCase().replace(/[\s_]/g, ''); }
function relatedEntries(q, n = 2) {
  const nq = norm(q);
  // 提取有区分度的中文片段（2-4字词）
  const terms = (nq.match(/[一-鿿]{2,4}/g) || []).slice(0, 12);
  const scored = entries.map(e => {
    const hay = norm((e.title || '') + ' ' + (e.abstract || '') + ' ' + (e.objects || '') + ' ' + (e.methods || ''));
    let sc = 0;
    terms.forEach(t => { if (t.length >= 2 && hay.includes(t)) sc++; });
    return { sc, e };
  }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc);
  return scored.slice(0, n).map(x => ({ id: x.e.id, title: x.e.title, abstract: String(x.e.abstract || '').slice(0, 200) }));
}

// 题集
const qs = readJson('Agent工作区/Agent-B-问题生成/self_train_q_n30.json');
const arr = Array.isArray(qs) ? qs : (qs.questions || []);
console.log('题数:', arr.length, '| round', round);

const localAnswer = require('../训练管道/local_answer.js');
localAnswer.init();

(async () => {
  const results = [];
  for (let i = 0; i < arr.length; i++) {
    const q = arr[i];
    const question = q.question || q.q || '';
    const ref = (q.referenceAnswer || '').slice(0, 250);
    let answer = '';
    try { const r = localAnswer.answer(question); answer = String(r && (r.answerText || r.answer || '') || '').slice(0, 500); } catch (e) { answer = '(回答出错)'; }
    const rel = relatedEntries(question, 2);
    const user = '【题目】' + question + '\n【参考答案(讲义基准)】' + ref + '\n【AI助手答案】' + (answer || '(空)') +
      '\n【语料库相关文献】' + (rel.length ? rel.map(r => '#' + r.id + '《' + r.title + '》' + (r.abstract ? '：' + r.abstract : '') ).join('\n') : '(语料库未检索到相关文献)');
    let judge = null;
    try { judge = await llmJSON(JUDGE_SYSTEM, user); } catch (e) { console.log('评分失败', i, e.message.slice(0, 60)); }
    results.push({
      id: q.id, question: question.slice(0, 60),
      accuracy: judge ? Number(judge.accuracy) : -1,
      corpusFit: judge ? Number(judge.corpusFit) : -1,
      why: judge ? (judge.why || '').slice(0, 80) : '评分失败',
      refHits: rel.map(r => r.id),
      corpusRel: rel.length,
      answerLen: answer.length
    });
    if ((i + 1) % 5 === 0) console.log('  ' + (i + 1) + '/' + arr.length);
  }
  writeJson('Agent工作区/corpus_fit_r' + round + '.json', results);
  const acc = results.filter(r => r.accuracy >= 0);
  const avg = (arr, key) => arr.length ? (arr.reduce((a, b) => a + b[key], 0) / arr.length).toFixed(2) : '-';
  console.log('\n===== Round ' + round + ' 报告 =====');
  console.log('accuracy avg=' + avg(acc, 'accuracy') + ' corpusFit avg=' + avg(acc, 'corpusFit'));
  console.log('corpusFit<6 (语料支撑弱):', acc.filter(r => r.corpusFit < 6).length + '/' + acc.length);
  acc.filter(r => r.corpusFit < 6).slice(0, 8).forEach(r => console.log('  ⚠ [' + r.id + '] fit=' + r.corpusFit + ' 题:' + r.question + (r.corpusRel ? ' | 相关文献:' + r.refHits.join(',') : ' | 无相关文献')));
  console.log('结果已写 Agent工作区/corpus_fit_r' + round + '.json');
})();
