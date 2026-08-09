'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const writeJSON = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2), 'utf8');

let FAQ = readJSON('data/faq_unified.json');
const MANUAL = readJSON('data/manual.json');
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
const BATCH = 10;
const TARGET = 200;
const ROUNDS = Number(process.env.ROUNDS || 3);
const START_ROUND = Number(process.env.START_ROUND || 1);

const homeDir = process.env.HOME || process.env.USERPROFILE || '';
const envPath = path.join(homeDir, '.codex/skills/claude-vision/.env');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = key => {
  const m = env.match(new RegExp('^' + key + '=(.*)$', 'm'));
  return m ? m[1].trim() : '';
};
const API_KEY = process.env.DEEPSEEK_KEY || getEnv('DASHSCOPE_API_KEY');
const API_URL = process.env.DEEPSEEK_KEY
  ? 'https://api.deepseek.com/v1/chat/completions'
  : (getEnv('DASHSCOPE_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1') + '/chat/completions';

function llm(messages, maxTokens = 4000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0.3 });
    const req = https.request(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' ' + data.slice(0, 300)));
        try {
          const json = JSON.parse(data);
          resolve(json.choices[0].message.content);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseJSON(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('JSON array not found');
  return JSON.parse(raw.slice(start, end + 1));
}

const norm = s => String(s || '')
  .toLowerCase()
  .replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)])
  .replace(/\s+/g, '');

function localAnswer(question) {
  const nq = norm(question);
  let best = null, bestScore = 0;
  FAQ.forEach(f => {
    let kh = 0, longKey = 0;
    (f.keys || []).forEach(k => {
      const nk = norm(k);
      if (nk && nq.includes(nk)) { kh++; if (nk.length >= 3) longKey++; }
    });
    let eh = 0;
    (f.ents || []).forEach(en => { if (nq.includes(norm(en))) eh++; });
    const title = norm(f.title || '');
    const q = norm(f.q || f.title || '');
    const titleHit = title && (nq.includes(title) || title.includes(nq));
    const qHit = q && (nq.includes(q) || q.includes(nq));
    if (!((kh >= 2) || (kh >= 1 && eh >= 1) || (eh >= 2) || titleHit || qHit)) return;
    const diffBoost = (/区别|比较|对比|vs/.test(nq) && /vs|比较|区别|对比/.test(f.title || '')) ? 8 : 0;
    const intentBoost = (/为何|为什么|目的|作用/.test(nq) && /为何|为什么|目的|作用/.test(f.title || '')) ? 6 : 0;
    const score = kh * 2 + eh * 3 + longKey * 0.5 + (titleHit ? 10 : 0) + (qHit ? 6 : 0) + diffBoost + intentBoost;
    if (score > bestScore) { bestScore = score; best = f; }
  });
  if (!best) return '暂无本地FAQ命中，建议结合语料库与实验手册检索。';
  return (best.answer || '') + (best.detail ? '\n\n' + best.detail : '');
}

function manualDigest() {
  const chapters = (MANUAL.chapters || []).map(ch => {
    const secs = (ch.sections || []).map(s => '  - ' + s.id + ' ' + s.title).join('\n');
    return '第' + ch.number + '章 ' + ch.title + '\n' + secs;
  }).join('\n');
  const op = (MANUAL.chapters[3]?.sections?.[0]?.content || '').replace(/\s+/g, ' ').slice(0, 1200);
  return chapters + '\n\n核心操作摘录：\n' + op;
}

function agentA(round) {
  const cp = require('child_process');
  try {
    cp.execSync('node scripts/enrich-faq-knowledge.js', { cwd: root, stdio: 'inherit' });
  } catch (e) {
    console.log('Agent甲: 增强步骤未完全执行', e.message);
  }
  FAQ = readJSON('data/faq_unified.json');
  console.log('[Round ' + round + '] Agent甲: FAQ/HTML 数据增强完成，当前 FAQ ' + FAQ.length + ' 条');
}

async function agentB(round) {
  console.log('Agent乙: 生成 200 道题');
  const existing = 'Agent工作区/Agent-B-问题生成/agent_b_questions_r' + round + '.json';
  if (fs.existsSync(path.join(root, existing))) {
    const loaded = readJSON(existing);
    console.log('Agent乙: 复用已有题目', loaded.length);
    return loaded;
  }
  const all = [];
  const system = '你是 ChemAI 实验课程出题官。只输出 JSON 数组，不要输出 Markdown。每项结构：{"question":"题目","referenceAnswer":"简要参考答案","category":"17分类之一","chapterHint":"对应manual章节"}';
  for (let i = 0; i < TARGET / BATCH; i++) {
    const user = '请严格基于以下武汉大学互动讲义生成 ' + BATCH + ' 道题，覆盖不同章节与分类，不要重复。\n\n' + manualDigest();
    let items = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = await llm([
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]);
        items = parseJSON(out);
        if (Array.isArray(items) && items.length) break;
      } catch (e) {
        console.log('  重试', i + 1, e.message);
      }
    }
    if (!items || !items.length) {
      console.log('  批次失败', i + 1);
      continue;
    }
    all.push(...items.map((q, j) => ({ ...q, batch: i + 1, seq: i * BATCH + j + 1 })));
    console.log('  已生成', all.length);
  }
  writeJSON('Agent工作区/Agent-B-问题生成/agent_b_questions_r' + round + '.json', all);
  return all;
}

async function agentD(questions, round) {
  console.log('Agent丁: 逐题校验');
  const existing = 'Agent工作区/Agent-D-验证/agent_d_validation_r' + round + '.json';
  if (fs.existsSync(path.join(root, existing))) {
    const loaded = readJSON(existing);
    console.log('Agent丁: 复用已有校验', loaded.length);
    return loaded;
  }
  const results = [];
  const digest = manualDigest();
  const system = '你是 ChemAI 校验官。只输出 JSON 数组，每项：{"question":"原题","valid":true/false,"issue":"问题或留空","correction":"修正建议","manualSection":"对应manual章节"}';
  for (let i = 0; i < questions.length; i += BATCH) {
    const batch = questions.slice(i, i + BATCH);
    const user = '校验以下题目是否严格对应实验手册且无科学性错误：\n' + JSON.stringify(batch.map(x => ({ question: x.question, referenceAnswer: x.referenceAnswer })), null, 2) + '\n\n手册：\n' + digest;
    let items = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = await llm([{ role: 'system', content: system }, { role: 'user', content: user }]);
        items = parseJSON(out);
        if (Array.isArray(items)) break;
      } catch (e) {
        console.log('  校验重试', i / BATCH + 1, e.message);
      }
    }
    (items || []).forEach((v, j) => results.push({ question: batch[j]?.question, ...v }));
    console.log('  已校验', results.length);
  }
  writeJSON('Agent工作区/Agent-D-验证/agent_d_validation_r' + round + '.json', results);
  return results;
}

async function agentC(questions, round) {
  console.log('Agent丙: LLM 评分');
  const existing = 'Agent工作区/Agent-C-答案评分/agent_c_scores_r' + round + '.json';
  if (fs.existsSync(path.join(root, existing))) {
    const loaded = readJSON(existing);
    console.log('Agent丙: 复用已有评分', loaded.length);
    return loaded;
  }
  const scores = [];
  const system = '你是 ChemAI 评分官。只输出 JSON 数组，每项：{"question":"原题","score":0-100,"accuracy":0-100,"completeness":0-100,"manualCompliance":0-100,"safety":0-100,"comment":"一句话评价"}';
  for (let i = 0; i < questions.length; i += BATCH) {
    const batch = questions.slice(i, i + BATCH);
    const entries = batch.map(q => ({
      question: q.question,
      referenceAnswer: q.referenceAnswer,
      assistantAnswer: localAnswer(q.question)
    }));
    let items = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = await llm([
          { role: 'system', content: system },
          { role: 'user', content: '请按参考答案给 AI 助手回答评分：\n' + JSON.stringify(entries, null, 2) }
        ]);
        items = parseJSON(out);
        if (Array.isArray(items)) break;
      } catch (e) {
        console.log('  评分重试', i / BATCH + 1, e.message);
      }
    }
    (items || []).forEach(v => scores.push(v));
    console.log('  已评分', scores.length);
  }
  writeJSON('Agent工作区/Agent-C-答案评分/agent_c_scores_r' + round + '.json', scores);
  return scores;
}

(async () => {
  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0;
  const reports = [];
  for (let round = START_ROUND; round <= ROUNDS; round++) {
    console.log('\n===== Agent Loop Round ' + round + ' =====');
    agentA(round);
    const questions = await agentB(round);
    const validation = await agentD(questions, round);
    const scores = await agentC(questions, round);
    const report = {
      round,
      generated: questions.length,
      valid: validation.filter(v => v.valid !== false).length,
      invalid: validation.filter(v => v.valid === false).length,
      avgScore: avg(scores.map(s => Number(s.score))),
      avgAccuracy: avg(scores.map(s => Number(s.accuracy))),
      avgCompleteness: avg(scores.map(s => Number(s.completeness))),
      avgManualCompliance: avg(scores.map(s => Number(s.manualCompliance))),
      avgSafety: avg(scores.map(s => Number(s.safety))),
      generatedAt: new Date().toISOString()
    };
    reports.push(report);
    writeJSON('Agent工作区/Agent-报告/agent_loop_round' + round + '_report.json', report);
    console.log('Round ' + round + ' 报告:');
    console.log(JSON.stringify(report, null, 2));
  }
  const allReports = [];
  for (let r = 1; r <= Math.max(ROUNDS, START_ROUND); r++) {
    const fp = path.join(root, 'Agent工作区/Agent-报告/agent_loop_round' + r + '_report.json');
    if (fs.existsSync(fp)) allReports.push(readJSON('Agent工作区/Agent-报告/agent_loop_round' + r + '_report.json'));
  }
  const finalReport = { rounds: allReports, generatedAt: new Date().toISOString() };
  writeJSON('Agent工作区/Agent-报告/agent_loop_report.json', finalReport);
  console.log('\nAgent Loop 最终报告:');
  console.log(JSON.stringify(finalReport, null, 2));
})().catch(e => {
  console.error('Agent Loop 失败:', e.message);
  process.exit(1);
});
