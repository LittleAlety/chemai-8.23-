'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const writeJSON = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2), 'utf8');

const FAQ = readJSON('data/faq_unified.json');
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const API_KEY = process.env.DEEPSEEK_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

const norm = s => String(s || '')
  .toLowerCase()
  .replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)])
  .replace(/\s+/g, '');

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
        try { resolve(JSON.parse(data).choices[0].message.content); }
        catch (e) { reject(e); }
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
  return best ? (best.answer || '') + (best.detail ? '\n\n' + best.detail : '') : '暂无本地FAQ命中，建议结合语料库与实验手册检索。';
}

async function fillRound(round) {
  const questions = readJSON('agent_b_questions_r' + round + '.json');
  const existing = readJSON('agent_c_scores_r' + round + '.json');
  const available = existing.filter(Boolean).slice();
  const results = new Array(questions.length);
  const missingIndices = [];
  questions.forEach((q, i) => {
    const idx = available.findIndex(s => norm(s.question) === norm(q.question));
    if (idx >= 0) {
      results[i] = available.splice(idx, 1)[0];
    } else {
      missingIndices.push(i);
    }
  });
  console.log('Round', round, 'missing', missingIndices.length);

  if (missingIndices.length) {
    const system = '你是 ChemAI 评分官。只输出 JSON 数组，每项：{"question":"原题","score":0-100,"accuracy":0-100,"completeness":0-100,"manualCompliance":0-100,"safety":0-100,"comment":"一句话评价"}';
    for (let i = 0; i < missingIndices.length; i += 10) {
      const batchIndices = missingIndices.slice(i, i + 10);
      const batch = batchIndices.map(idx => questions[idx]);
      const entries = batch.map(q => ({ question: q.question, referenceAnswer: q.referenceAnswer, assistantAnswer: localAnswer(q.question) }));
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
          console.log('  retry', i / 10 + 1, e.message);
        }
      }
      if (items) {
        const remaining = new Set(batchIndices);
        items.forEach(s => {
          const idx = batchIndices.find(i => remaining.has(i) && norm(questions[i].question) === norm(s.question));
          if (idx !== undefined) {
            results[idx] = s;
            remaining.delete(idx);
          }
        });
      }
      console.log('  filled', results.filter(Boolean).length);
    }
  }

  const remaining = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i] == null) remaining.push(i);
  }
  const systemSingle = '你是 ChemAI 评分官。只输出 JSON 数组，每项：{"question":"原题","score":0-100,"accuracy":0-100,"completeness":0-100,"manualCompliance":0-100,"safety":0-100,"comment":"一句话评价"}';
  for (const idx of remaining) {
    const q = questions[idx];
    const entry = [{ question: q.question, referenceAnswer: q.referenceAnswer, assistantAnswer: localAnswer(q.question) }];
    for (let attempt = 0; attempt < 3 && !results[idx]; attempt++) {
      try {
        const out = await llm([
          { role: 'system', content: systemSingle },
          { role: 'user', content: '请按参考答案给 AI 助手回答评分：\n' + JSON.stringify(entry, null, 2) }
        ]);
        const items = parseJSON(out);
        if (Array.isArray(items) && items.length) {
          const match = items.find(s => norm(s.question) === norm(q.question));
          if (match || items[0]) results[idx] = { question: q.question, ...(match || items[0]) };
        }
      } catch (e) {
        console.log('  single retry', q.question.slice(0, 20), e.message);
      }
    }
  }

  let missing = 0;
  for (let i = 0; i < results.length; i++) {
    if (results[i] == null) missing++;
  }
  if (missing) {
    throw new Error('Round ' + round + ' still missing scores: ' + missing);
  }
  const full = results;
  writeJSON('agent_c_scores_r' + round + '.json', full);
  return full;
}

(async () => {
  if (!API_KEY) throw new Error('DEEPSEEK_KEY missing');
  const reports = [];
  for (let round = 1; round <= 3; round++) {
    const scores = await fillRound(round);
    const questions = readJSON('agent_b_questions_r' + round + '.json');
    const validation = readJSON('agent_d_validation_r' + round + '.json');
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0;
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
    writeJSON('agent_loop_round' + round + '_report.json', report);
    console.log('Round', round, report);
  }
  writeJSON('agent_loop_report.json', { rounds: reports, generatedAt: new Date().toISOString() });
})().catch(e => {
  console.error(e);
  process.exit(1);
});
