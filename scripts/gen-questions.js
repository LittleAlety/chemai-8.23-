/* 生成实验深度题集（供 corpus-fit-loop 用）
 * 用法: node scripts/gen-questions.js [N] [输出文件名]
 * 默认 N=100, 输出 Agent工作区/Agent-B-问题生成/self_train_q_n{N}.json */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const N = Number(process.argv[2] || 100);
const root = path.join(__dirname, '..');
const W = p => path.join(root, p);

const homeDir = process.env.USERPROFILE || process.env.HOME || '';
const envPath = path.join(homeDir, '.codex/skills/claude-vision/.env');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = key => { const m = env.match(new RegExp('^' + key + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const API_KEY = process.env.DEEPSEEK_KEY || getEnv('DEEPSEEK_KEY');
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-v4-flash';
if (!API_KEY) { console.error('缺 DEEPSEEK_KEY'); process.exit(1); }

function llmJSON(system, user, maxTok = 16000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTok, temperature: 0.3 });
    const req = https.request(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' ' + data.slice(0, 200)));
        const content = JSON.parse(data).choices[0].message.content;
        const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const raw = (fence ? fence[1] : content).trim();
        const s = raw.indexOf('[');
        if (s < 0) return reject(new Error('JSON array 未找到'));
        // 截断恢复：从后往前找最后一个完整对象，补 ]
        const slice = raw.slice(s);
        try { return resolve(JSON.parse(slice)); } catch (e) {}
        const last = slice.lastIndexOf('}');
        if (last > 0) { try { return resolve(JSON.parse(slice.slice(0, last + 1) + ']')); } catch (e2) {} }
        // 逐对象拯救
        const objs = [];
        const re = /\{[^{}]*\}/g;
        let m;
        while ((m = re.exec(slice)) !== null) { try { objs.push(JSON.parse(m[0])); } catch (e3) {} }
        if (objs.length) return resolve(objs);
        return reject(new Error('JSON 解析失败'));
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(new Error('请求超时 60s')); });
    req.write(body); req.end();
  });
}

const GEN_SYSTEM = '你是 ChemAI 实验课程高级出题官，依据武汉大学实验讲义与文献出题。只输出 JSON 数组，不要多余文字。' +
  '每项：{"question":"题目","referenceAnswer":"以讲义为准的简要参考答案(≤150字)","focusArea":"沉淀/氧化/配位/结晶/性质表征/安全废液/误差分析/原理机理 之一","subfield":"合成制备/反应原理/实验操作/分析测定/光化学应用/结构表征/磁性研究/安全与废物处理/综合研究 之一"}。' +
  '要求：题目有深度、不简单；聚焦实验步骤各影响因素与各物质(草酸/草酸亚铁/铁(III)/K₃[Fe(C₂O₄)₃]/摩尔盐/乙醇/H₂O₂)的性质作用；多出"为什么/如果…会怎样/如何判断/从机理角度"类分析题；覆盖沉淀、H₂O₂氧化、草酸配位、乙醇结晶、烘干、性质表征、安全、误差各环节；数值以讲义为准(6%H₂O₂=8mL、失水100℃、50℃烘干20min)。';

(async () => {
  const BATCH = 5; // 参考答案长，防截断（同 self_train GEN_BATCH）
  const want = Math.ceil(N / BATCH);
  let all = [];
  for (let i = 0; i < want; i++) {
    const per = Math.min(BATCH, N - all.length);
    console.log('生成第', i + 1, '批', per, '题...');
    try {
      const qs = await llmJSON(GEN_SYSTEM, '请生成 ' + per + ' 道高深度、差异化的题目（覆盖不同 focusArea/subfield，与前几批不重复）。');
      all = all.concat(qs);
    } catch (e) { console.log('批', i + 1, '失败重试:', e.message.slice(0, 50)); i--; }
  }
  // 去重 + 编号
  const seen = new Set();
  const out = all.filter(q => { const k = (q.question || '').slice(0, 20); if (seen.has(k) || !k) return false; seen.add(k); return true; })
    .slice(0, N)
    .map((q, i) => ({ id: 'Q' + String(i + 1).padStart(3, '0'), question: q.question, referenceAnswer: q.referenceAnswer || '', focusArea: q.focusArea || '', subfield: q.subfield || '' }));
  const fp = 'Agent工作区/Agent-B-问题生成/self_train_q_n' + N + '.json';
  fs.writeFileSync(W(fp), JSON.stringify(out, null, 2), 'utf8');
  console.log('生成', out.length, '题 →', fp);
})().catch(e => { console.error('✗', e.message.slice(0, 150)); process.exit(1); });
