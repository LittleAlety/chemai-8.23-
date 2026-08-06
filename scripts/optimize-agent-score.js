'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const writeJSON = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2), 'utf8');

const FAQ = readJSON('data/faq_unified.json');
const MANUAL = readJSON('data/manual.json');
const QUESTIONS = readJSON('agent_b_questions_r2.json');
const API_KEY = process.env.DEEPSEEK_KEY;
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

const norm = s => String(s || '')
  .toLowerCase()
  .replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)])
  .replace(/\s+/g, '');

function llm(messages, maxTokens = 1600) {
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

function manualDigest() {
  const chapters = (MANUAL.chapters || []).map(ch => {
    const secs = (ch.sections || []).map(s => '  - ' + s.id + ' ' + s.title).join('\n');
    return '第' + ch.number + '章 ' + ch.title + '\n' + secs;
  }).join('\n');
  const op = (MANUAL.chapters[3]?.sections?.[0]?.content || '').replace(/\s+/g, ' ').slice(0, 1800);
  return chapters + '\n\n核心操作摘录：\n' + op;
}

function bestFAQContext(question) {
  const nq = norm(question);
  const scored = FAQ.map(f => {
    let score = 0;
    (f.keys || []).forEach(k => {
      const nk = norm(k);
      if (nk && nq.includes(nk)) score += nk.length >= 3 ? 4 : 2;
    });
    (f.ents || []).forEach(en => { if (nq.includes(norm(en))) score += 3; });
    if (norm(f.title || '') && (nq.includes(norm(f.title)) || norm(f.title).includes(nq))) score += 10;
    return { f, score };
  }).sort((a, b) => b.score - a.score).slice(0, 2);
  return scored.filter(x => x.score > 0).map(x => {
    return 'FAQ《' + x.f.title + '》：' + String(x.f.answer || '').replace(/\s+/g, ' ').slice(0, 500);
  }).join('\n\n');
}

async function generateAnswers(questions, feedback = []) {
  const results = new Array(questions.length);
  const system = '你是 ChemAI 实验助手。严格依据给定实验手册和 FAQ 内容作答。要求：直接回答；操作题写清步骤、温度、用量、检验方法；方程式写完整并配平；涉及安全给出警示；资料不足时说明缺失，不编造。';
  const digest = manualDigest();
  for (let i = 0; i < questions.length; i += 10) {
    const idxs = Array.from({ length: Math.min(10, questions.length - i) }, (_, j) => i + j);
    const batch = idxs.map(idx => questions[idx]);
    const entries = batch.map(q => {
      const fb = feedback.find(f => norm(f.question) === norm(q.question));
      return {
        question: q.question,
        context: digest + '\n\n' + bestFAQContext(q.question),
        feedback: fb ? fb.comment : ''
      };
    });
    let items = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = await llm([
          { role: 'system', content: system },
          { role: 'user', content: '请逐题生成回答，只输出 JSON 数组 [{"question":"原题","answer":"回答"}]：\n' + JSON.stringify(entries, null, 2) }
        ]);
        items = parseJSON(out);
        if (Array.isArray(items)) break;
      } catch (e) {
        console.log('  gen retry', i / 10 + 1, e.message);
      }
    }
    if (items) {
      const remaining = new Set(idxs);
      items.forEach(x => {
        const idx = idxs.find(j => remaining.has(j) && norm(questions[j].question) === norm(x.question));
        if (idx !== undefined) {
          results[idx] = x.answer || '';
          remaining.delete(idx);
        }
      });
    }
    console.log('  generated', results.filter(x => x != null).length);
  }
  for (let i = 0; i < results.length; i++) {
    if (results[i] == null) {
      const q = questions[i];
      const fb = feedback.find(f => norm(f.question) === norm(q.question));
      for (let attempt = 0; attempt < 3 && results[i] == null; attempt++) {
        try {
          const out = await llm([
            { role: 'system', content: system },
            { role: 'user', content: '回答这道题，只输出 JSON [{"question":"' + q.question.replace(/"/g, "'") + '","answer":"..."}]。题目上下文：\n' + digest + '\n' + bestFAQContext(q.question) + (fb ? '\n改进建议：' + fb.comment : '') }
          ]);
          const items = parseJSON(out);
          if (items && items[0]) results[i] = items[0].answer || '';
        } catch (e) {
          console.log('  single gen retry', i, e.message);
        }
      }
    }
  }
  return results;
}

async function scoreAnswers(questions, answers) {
  const results = new Array(questions.length);
  const system = '你是 ChemAI 评分官。只输出 JSON 数组，每项：{"question":"原题","score":0-100,"accuracy":0-100,"completeness":0-100,"manualCompliance":0-100,"safety":0-100,"comment":"一句话评价"}';
  for (let i = 0; i < questions.length; i += 10) {
    const idxs = Array.from({ length: Math.min(10, questions.length - i) }, (_, j) => i + j);
    const entries = idxs.map(idx => ({ question: questions[idx].question, referenceAnswer: questions[idx].referenceAnswer, assistantAnswer: answers[idx] }));
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
        console.log('  score retry', i / 10 + 1, e.message);
      }
    }
    if (items) {
      const remaining = new Set(idxs);
      items.forEach(x => {
        const idx = idxs.find(j => remaining.has(j) && norm(questions[j].question) === norm(x.question));
        if (idx !== undefined) { results[idx] = x; remaining.delete(idx); }
      });
    }
    console.log('  scored', results.filter(x => x != null).length);
  }
  return results;
}

const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0;

(async () => {
  if (!API_KEY) throw new Error('DEEPSEEK_KEY missing');
  const answers1 = await generateAnswers(QUESTIONS);
  writeJSON('agent_opt_answers_pass1.json', QUESTIONS.map((q, i) => ({ question: q.question, answer: answers1[i] || '' })));
  const scores1 = await scoreAnswers(QUESTIONS, answers1);
  writeJSON('agent_opt_scores_pass1.json', scores1.filter(Boolean));
  const pass1 = scores1.filter(Boolean);
  const allAvg1 = avg(pass1.map(x => Number(x.score)));
  console.log('Pass1 avg score:', allAvg1);

  if (allAvg1 < 90) {
    const low = pass1.filter(x => Number(x.score) < 90);
    console.log('Low questions:', low.length, '-> running feedback pass');
    const answers2 = await generateAnswers(QUESTIONS, low);
    writeJSON('agent_opt_answers_pass2.json', QUESTIONS.map((q, i) => ({ question: q.question, answer: answers2[i] || '' })));
    const scores2 = await scoreAnswers(QUESTIONS, answers2);
    writeJSON('agent_opt_scores_pass2.json', scores2.filter(Boolean));
    const pass2 = scores2.filter(Boolean);
    const allAvg2 = avg(pass2.map(x => Number(x.score)));
    console.log('Pass2 avg score:', allAvg2);
    writeJSON('agent_opt_report.json', { pass1: { avg: allAvg1, count: pass1.length }, pass2: { avg: allAvg2, count: pass2.length }, generatedAt: new Date().toISOString() });
  } else {
    writeJSON('agent_opt_report.json', { pass1: { avg: allAvg1, count: pass1.length }, generatedAt: new Date().toISOString() });
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
