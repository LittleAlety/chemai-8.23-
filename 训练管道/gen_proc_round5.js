'use strict';
/**
 * Round5：实验步骤指导 200 题生成器（重点维度 = 实验步骤指导）。
 * 依据 data/manual.json 的 ch4（操作步骤/关键操作/常见错误/产率计算）+ ch11（故障排查）作 grounding，
 * 用 LLM 生成 200 道「实验步骤指导」题。凭证读取 .env（config-driven，不内联 key）。
 * 用法：node 训练管道/gen_proc_round5.js   （$env:PROC_N 可覆盖题数）
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const root = path.join(__dirname, '..');

const readJson = fp => JSON.parse(fs.readFileSync(path.join(root, fp), 'utf8').replace(/^﻿/, ''));
const writeJson = (fp, d) => { const abs = path.join(root, fp); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, JSON.stringify(d, null, 2), 'utf8'); };
const exists = fp => fs.existsSync(path.join(root, fp));

const N = Number(process.env.PROC_N || 200);
const LOT = Number(process.env.PROC_LOT || 10);   // 每批题数
const CONC = 4;

// ---- 凭证（config-driven）----
const homeDir = process.env.HOME || process.env.USERPROFILE || '';
const envPath = path.join(homeDir, '.codex/skills/claude-vision/.env');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = k => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const API_KEY = getEnv('DASHSCOPE_API_KEY') || process.env.DEEPSEEK_KEY || getEnv('DEEPSEEK_KEY');
const API_URL = (getEnv('DASHSCOPE_API_KEY') || getEnv('DASHSCOPE_BASE_URL'))
  ? (getEnv('DASHSCOPE_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '') + '/chat/completions'
  : 'https://api.deepseek.com/v1/chat/completions';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
if (!API_KEY) { console.error('缺少可用 key（.env 无 DEEPSEEK_KEY 等）'); process.exit(1); }

function llm(messages, maxTokens = 16000, temp = 0.4) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: temp, reasoning_effort: 'low' });
    const req = https.request(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY } }, res => {
      const c = []; res.on('data', x => c.push(x)); res.on('end', () => {
        const d = Buffer.concat(c).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' ' + d.slice(0, 200)));
        try { resolve(JSON.parse(d).choices[0].message.content); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}
function parseJSON(s) {
  const t = String(s || '').replace(/```/g, '').replace(/^\s*\[?/, '[').replace(/\]?\s*$/, ']');
  try { return JSON.parse(t); } catch (e) { try { return JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)); } catch (e2) { return null; } }
}
async function llmJSON(system, user, maxTokens, temp) {
  for (let a = 0; a < 3; a++) {
    try { const out = await llm([{ role: 'system', content: system }, { role: 'user', content: user }], maxTokens, temp); const it = parseJSON(out); if (Array.isArray(it)) return it; } catch (e) { console.log('  重试' + (a + 1) + ': ' + e.message.slice(0, 80)); }
  }
  return null;
}
async function runPool(items, worker, size) {
  const out = new Array(items.length); let idx = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (idx < items.length) { const i = idx++; out[i] = await worker(items[i], i); } }));
  return out;
}

// ---- 讲义 grounding：ch4 操作 + ch11 故障 ----
const MANUAL = readJson('data/manual.json');
function sec(id) { let r = ''; (MANUAL.chapters || []).forEach(ch => (ch.sections || []).forEach(s => { if (s.id === id) r = s.content; })); return String(r || '').replace(/\s+/g, ' '); }
const DIGEST =
  '核心操作步骤/用量/温度/时间（ch4-s1）：\n' + sec('ch4-s1').slice(0, 4400) +
  '\n\n关键操作要点（ch4-s2）：\n' + sec('ch4-s2').slice(0, 1600) +
  '\n\n常见错误与解决方案（ch4-s3）：\n' + sec('ch4-s3').slice(0, 2000) +
  '\n\n产率计算（ch4-s4）：\n' + sec('ch4-s4').slice(0, 700) +
  '\n\n故障排查（ch11）：\n' + sec('ch11').slice(0, 2000);

const GEN_SYS = '你是 ChemAI 实验课程高级出题官，专攻「实验步骤指导」维度，依据武汉大学实验讲义出题。' +
  '只输出 JSON 数组，不要 Markdown。每项：{"question":"题目","referenceAnswer":"以讲义为准的答案(≤150字)","category":"实验操作|合成制备|综合研究|安全与废物处理|反应原理","focusArea":"操作步骤|温度|时间|试剂用量|仪器操作|终点判断|故障排查|洗涤结晶|条件控制","difficulty":"易|中|较难","type":"fill|short|single|ordering"}。' +
  '题目聚焦实验步骤指导：步骤先后顺序、各步温度/时间/用量、仪器与操作手法、终点如何判断、洗涤/结晶/干燥要点、若某步异常如何诊断与补救、为何采用该操作。' +
  '考察「步骤怎么做、为什么这样做、异常怎么办、怎么判断到位」而非直接复述；题目差异化、不重复；答案严格贴合讲义数值(6%H₂O₂=8mL、烘干50℃、失水100℃、微沸4min、40℃水浴、乙醇10mL等)。';

const CAT_FOCUS = [  // 配额：步骤指导为主
  ['实验操作', 110], ['合成制备', 40], ['综合研究', 25], ['安全与废物处理', 15], ['反应原理', 10]
];

const OUT_RAW = '试题迭代记录/round5/agent_proc_200.json';
const OUT_LOOP = 'Agent工作区/Agent-B-问题生成/self_train_q_proc200_final.json';

(async () => {
  console.log('N=' + N + ' MODEL=' + MODEL + ' LOT=' + LOT + ' 凭证=' + (getEnv('DASHSCOPE_API_KEY') ? 'DashScope' : 'DeepSeek'));
  console.log('grounding digest 长度: ' + DIGEST.length);
  const batches = [];
  for (let i = 0; i < N; i += LOT) batches.push({ want: Math.min(LOT, N - i), i });
  const userFor = b => '请生成 ' + b.want + ' 道「实验步骤指导」题，覆盖下列分类配额：' +
    CAT_FOCUS.map(c => c[0] + ' 共' + c[1] + '题').join('、') + '（本批可任意搭配，但全库须接近该配额）。' +
    '题与题差异化，涉及温度/时间/用量时用讲义数值。\n\n讲义依据：\n' + DIGEST +
    '\n\n只输出 JSON 数组（不要 Markdown）。';
  const results = await runPool(batches, async b => { const it = await llmJSON(GEN_SYS, userFor(b), 16000); return it || []; }, CONC);
  const all = [];
  results.forEach(it => it.forEach(x => all.push(x)));
  console.log('已生成 ' + all.length + ' 题');
  // 补齐 category（LLM 若漏给则按 focusArea 映射）
  const byFocus = { '操作步骤': '实验操作', '温度': '实验操作', '时间': '实验操作', '试剂用量': '实验操作', '仪器操作': '实验操作', '终点判断': '实验操作', '洗涤结晶': '实验操作', '条件控制': '实验操作', '故障排查': '综合研究' };
  all.forEach(q => { if (!q.category) q.category = byFocus[q.focusArea] || '实验操作'; });

  // ① raw
  writeJson(OUT_RAW, { round: 5, focus: '实验步骤指导', total: all.length, generated_at: new Date().toISOString(), questions: all.slice(0, N) });
  console.log('① raw → ' + OUT_RAW + ' (' + all.slice(0, N).length + ' 题)');

  // ② 闭环 bank（loop-input schema：id/question/referenceAnswer/focusArea/subfield/difficulty）
  const loopQs = all.slice(0, N).map((q, i) => ({
    id: 'Q' + String(i + 1).padStart(3, '0'),
    question: q.question,
    referenceAnswer: q.referenceAnswer || q.answer || '',
    focusArea: q.focusArea || '操作步骤',
    subfield: q.category || '实验操作',
    difficulty: q.difficulty || '中'
  }));
  writeJson(OUT_LOOP, loopQs);
  console.log('② loop bank → ' + OUT_LOOP + ' (' + loopQs.length + ' 题)');
  const counts = {}; all.slice(0, N).forEach(q => { counts[q.category] = (counts[q.category] || 0) + 1; });
  console.log('category 分布: ' + JSON.stringify(counts));
  console.log('DONE');
})().catch(e => { console.error('生成失败:', e); process.exit(1); });
