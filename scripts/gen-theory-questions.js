/* 理论/主题类题目生成（针对新增 89 篇文献覆盖的领域）
 * 用法: node scripts/gen-theory-questions.js [N] */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const N = Number(process.argv[2] || 40);
const root = path.join(__dirname, '..');
const W = p => path.join(root, p);
const homeDir = process.env.USERPROFILE || process.env.HOME || '';
const envPath = path.join(homeDir, '.codex/skills/claude-vision/.env');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = k => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const API_KEY = process.env.DEEPSEEK_KEY || getEnv('DEEPSEEK_KEY');
const MODEL = 'deepseek-v4-flash';
if (!API_KEY) { console.error('缺 DEEPSEEK_KEY'); process.exit(1); }
function llmJSON(system, user) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 6000, temperature: 0.3 });
    const req = https.request('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' ' + data.slice(0, 200)));
        const content = JSON.parse(data).choices[0].message.content;
        const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const raw = (fence ? fence[1] : content).trim();
        const s = raw.indexOf('[');
        if (s < 0) return reject(new Error('JSON array 未找到'));
        const slice = raw.slice(s);
        try { return resolve(JSON.parse(slice)); } catch (e) {}
        const last = slice.lastIndexOf('}');
        if (last > 0) { try { return resolve(JSON.parse(slice.slice(0, last + 1) + ']')); } catch (e2) {} }
        const objs = []; const re = /\{[^{}]*\}/g; let m;
        while ((m = re.exec(slice)) !== null) { try { objs.push(JSON.parse(m[0])); } catch (e3) {} }
        if (objs.length) return resolve(objs);
        return reject(new Error('JSON 解析失败'));
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('超时')));
    req.write(body); req.end();
  });
}
const GEN_SYSTEM = '你是 ChemAI 化学理论出题官，依据语料库收录的文献（配位化学理论/光化学机理/热分析/磁性/结构表征/电化学/安全）出题。只输出 JSON 数组。' +
  '每项：{"question":"题目","referenceAnswer":"简要参考答案(≤120字)","focusArea":"配位理论/光化学/热分析/磁性/结构表征/电化学/安全/合成优化 之一","subfield":"配位化学理论/光化学应用/热分析/磁性研究/结构表征/分析测定/安全与废物处理/合成制备 之一"}。' +
  '要求：题目有深度、可被语料库中对应主题文献支撑；聚焦三草酸合铁酸钾相关理论（草酸根双齿螯合/晶体场与高自旋/ferrioxalate光量计与LMCT/草酸盐热分解动力学/磁化率与Gouy法/晶体结构与XRD/草酸铁电化学/含铁草酸盐废液处置）；多出"解释/为什么/如何/从…角度"类。';

(async () => {
  const BATCH = 5;
  let all = [];
  for (let i = 0; i < Math.ceil(N / BATCH); i++) {
    const per = Math.min(BATCH, N - all.length);
    console.log('生成第', i + 1, '批', per, '题...');
    try { all = all.concat(await llmJSON(GEN_SYSTEM, '请生成 ' + per + ' 道高深度、差异化题目，覆盖不同 focusArea，与前几批不重复。')); }
    catch (e) { console.log('批失败重试:', e.message.slice(0, 40)); i--; }
  }
  const seen = new Set();
  const out = all.filter(q => { const k = (q.question || '').slice(0, 20); if (seen.has(k) || !k) return false; seen.add(k); return true; })
    .slice(0, N).map((q, i) => ({ id: 'Q' + String(i + 1).padStart(3, '0'), question: q.question, referenceAnswer: q.referenceAnswer || '', focusArea: q.focusArea || '', subfield: q.subfield || '' }));
  const fp = 'Agent工作区/Agent-B-问题生成/self_train_q_n' + N + '_theory.json';
  fs.writeFileSync(W(fp), JSON.stringify(out, null, 2), 'utf8');
  console.log('生成', out.length, '题 →', fp);
  const fa = {}; out.forEach(q => { fa[q.focusArea] = (fa[q.focusArea] || 0) + 1; });
  console.log('focusArea:', JSON.stringify(fa));
})().catch(e => { console.error('✗', e.message.slice(0, 150)); process.exit(1); });
