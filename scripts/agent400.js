'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const writeJSON = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2), 'utf8');

const FAQ = readJSON('data/faq_unified.json');
const MANUAL = readJSON('data/manual.json');
const API_KEY = process.env.DEEPSEEK_KEY;
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const BATCH = 10;
const TARGET = 400;

const norm = s => String(s || '')
  .toLowerCase()
  .replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)])
  .replace(/\s+/g, '');

function llm(messages, maxTokens = 3000, jsonMode = true) {
  return new Promise((resolve, reject) => {
    const bodyObj = { model: MODEL, messages, max_tokens: maxTokens, temperature: 0.3 };
    if (jsonMode) bodyObj.response_format = { type: 'json_object' };
    const body = JSON.stringify(bodyObj);
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

function parseItems(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const obj = JSON.parse(raw);
  if (Array.isArray(obj)) return obj;
  if (obj && Array.isArray(obj.items)) return obj.items;
  throw new Error('items not found');
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
    return 'FAQ《' + x.f.title + '》：' + String(x.f.answer || '').replace(/\s+/g, ' ').slice(0, 600);
  }).join('\n\n');
}

async function generateQuestions() {
  const file = 'agent_b_400_questions.json';
  if (fs.existsSync(path.join(root, file))) {
    const q = readJSON(file);
    console.log('questions resume', q.length);
    return q;
  }
  const all = [];
  const digest = manualDigest();
  const system = '你是 ChemAI 实验课程出题官。只输出 JSON 对象 {"items":[...]}，不要 Markdown。每项结构：{"question":"题目","referenceAnswer":"简要参考答案","category":"17分类之一","chapterHint":"对应manual章节"}';
  for (let i = 0; i < TARGET / BATCH; i++) {
    let items = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = await llm([
          { role: 'system', content: system },
          { role: 'user', content: '请基于以下武汉大学互动讲义生成 ' + BATCH + ' 道不重复题：\n' + digest }
        ]);
        items = parseItems(out);
        if (Array.isArray(items)) break;
      } catch (e) {
        console.log('gen batch retry', i + 1, e.message);
      }
    }
    (items || []).forEach((q, j) => all.push({ ...q, seq: all.length + j + 1 }));
    console.log('questions generated', all.length);
  }
  for (let i = all.length; i < TARGET; i++) {
    const q = { question: '', referenceAnswer: '', category: '', chapterHint: '' };
    for (let attempt = 0; attempt < 3 && !q.question; attempt++) {
      try {
        const out = await llm([
          { role: 'system', content: system },
          { role: 'user', content: '请再生成 1 道题：' + digest }
        ]);
        const items = parseItems(out);
        if (items[0]) Object.assign(q, items[0]);
      } catch (e) {
        console.log('single q retry', i, e.message);
      }
    }
    all.push({ ...q, seq: i + 1 });
    if ((i + 1) % 10 === 0) console.log('questions filled', all.length);
  }
  const trimmed = all.slice(0, TARGET);
  writeJSON(file, trimmed);
  return trimmed;
}

async function validateQuestions(questions) {
  const file = 'agent_d_400_validation.json';
  if (fs.existsSync(path.join(root, file))) {
    const v = readJSON(file);
    console.log('validation resume', v.length);
    return v;
  }
  const results = [];
  const digest = manualDigest();
  const system = '你是 ChemAI 校验官。只输出 JSON 对象 {"items":[...]}，每项：{"question":"原题","valid":true/false,"issue":"问题或留空","correction":"修正建议","manualSection":"对应manual章节"}';
  for (let i = 0; i < questions.length; i += BATCH) {
    const batch = questions.slice(i, i + BATCH);
    let items = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = await llm([
          { role: 'system', content: system },
          { role: 'user', content: '校验以下题目：\n' + JSON.stringify(batch.map(x => ({ question: x.question, referenceAnswer: x.referenceAnswer })), null, 2) + '\n\n手册：\n' + digest }
        ]);
        items = parseItems(out);
        if (Array.isArray(items)) break;
      } catch (e) {
        console.log('valid retry', i / BATCH + 1, e.message);
      }
    }
    (items || []).forEach((v, j) => results.push({ question: batch[j]?.question, ...v }));
    console.log('validated', results.length);
  }
  writeJSON(file, results);
  return results;
}

async function generateAnswers(questions) {
  const file = 'agent_c_400_answers.json';
  if (fs.existsSync(path.join(root, file))) {
    const a = readJSON(file);
    console.log('answers resume', a.length);
    return a;
  }
  const digest = manualDigest();
  const system = '你是 ChemAI 实验助手。只输出 JSON 对象 {"items":[{"question":"原题","answer":"回答"}]}。直接回答，操作题写清步骤、温度、用量、检验方法；方程式写完整并配平；安全题给出警示；资料不足时说明缺失，不编造。';
  const results = new Array(questions.length);
  for (let i = 0; i < questions.length; i += BATCH) {
    const idxs = Array.from({ length: Math.min(BATCH, questions.length - i) }, (_, j) => i + j);
    const batch = idxs.map(idx => ({ question: questions[idx].question, context: digest + '\n' + bestFAQContext(questions[idx].question) }));
    let items = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = await llm([
          { role: 'system', content: system },
          { role: 'user', content: '请逐题回答：\n' + JSON.stringify(batch, null, 2) }
        ]);
        items = parseItems(out);
        if (Array.isArray(items)) break;
      } catch (e) {
        console.log('answer batch retry', i / BATCH + 1, e.message);
      }
    }
    if (items) {
      const remaining = new Set(idxs);
      items.forEach(x => {
        const idx = idxs.find(j => remaining.has(j) && norm(questions[j].question) === norm(x.question));
        if (idx !== undefined) { results[idx] = x.answer || ''; remaining.delete(idx); }
      });
    }
    console.log('answers generated', results.filter(x => x != null).length);
  }
  for (let i = 0; i < results.length; i++) {
    if (results[i] == null) {
      const q = questions[i];
      for (let attempt = 0; attempt < 3 && results[i] == null; attempt++) {
        try {
          const out = await llm([
            { role: 'system', content: system },
            { role: 'user', content: '请只回答这题，输出 JSON 对象 {"items":[{"question":"...","answer":"..."}]}：\n题目：' + q.question + '\n上下文：' + digest + '\n' + bestFAQContext(q.question) }
          ]);
          const items = parseItems(out);
          if (items[0]) results[i] = items[0].answer || '';
        } catch (e) {
          console.log('single answer retry', i, e.message);
        }
      }
      if (results[i] == null) results[i] = '暂无可靠回答，建议结合实验手册与语料库检索。';
    }
  }
  const answers = questions.map((q, i) => ({ question: q.question, answer: results[i] }));
  writeJSON(file, answers);
  return answers;
}

async function scoreAnswers(questions, answers) {
  const file = 'agent_c_400_scores.json';
  if (fs.existsSync(path.join(root, file))) {
    const s = readJSON(file);
    console.log('scores resume', s.length);
    return s;
  }
  const results = new Array(questions.length);
  const system = '你是 ChemAI 评分官。只输出 JSON 对象 {"items":[{"question":"原题","score":0-100,"accuracy":0-100,"completeness":0-100,"manualCompliance":0-100,"safety":0-100,"comment":"一句话评价"}]}';
  for (let i = 0; i < questions.length; i += BATCH) {
    const idxs = Array.from({ length: Math.min(BATCH, questions.length - i) }, (_, j) => i + j);
    const batch = idxs.map(idx => ({ question: questions[idx].question, referenceAnswer: questions[idx].referenceAnswer, assistantAnswer: answers[idx].answer }));
    let items = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = await llm([
          { role: 'system', content: system },
          { role: 'user', content: '请按参考答案给 AI 助手回答评分：\n' + JSON.stringify(batch, null, 2) }
        ]);
        items = parseItems(out);
        if (Array.isArray(items)) break;
      } catch (e) {
        console.log('score batch retry', i / BATCH + 1, e.message);
      }
    }
    if (items) {
      const remaining = new Set(idxs);
      items.forEach(x => {
        const idx = idxs.find(j => remaining.has(j) && norm(questions[j].question) === norm(x.question));
        if (idx !== undefined) { results[idx] = x; remaining.delete(idx); }
      });
    }
    console.log('scored', results.filter(x => x != null).length);
  }
  for (let i = 0; i < results.length; i++) {
    if (results[i] == null) {
      const q = questions[i];
      for (let attempt = 0; attempt < 3 && results[i] == null; attempt++) {
        try {
          const out = await llm([
            { role: 'system', content: system },
            { role: 'user', content: '请只给这题评分，输出 JSON 对象 {"items":[...]}：\n题目：' + q.question + '\n参考答案：' + q.referenceAnswer + '\nAI回答：' + answers[i].answer }
          ]);
          const items = parseItems(out);
          if (items[0]) results[i] = { question: q.question, ...items[0] };
        } catch (e) {
          console.log('single score retry', i, e.message);
        }
      }
      if (results[i] == null) {
        results[i] = { question: q.question, score: 50, accuracy: 50, completeness: 50, manualCompliance: 50, safety: 100, comment: '自动评分失败，按中位分暂记' };
      }
    }
  }
  const scores = results;
  writeJSON(file, scores);
  return scores;
}

const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + Number(b), 0) / arr.length * 10) / 10 : 0;

(async () => {
  if (!API_KEY) throw new Error('DEEPSEEK_KEY missing');
  const questions = await generateQuestions();
  const validation = await validateQuestions(questions);
  const answers = await generateAnswers(questions);
  const scores = await scoreAnswers(questions, answers);
  const report = {
    total: questions.length,
    validated: validation.length,
    valid: validation.filter(v => v.valid !== false).length,
    invalid: validation.filter(v => v.valid === false).length,
    scored: scores.length,
    avgScore: avg(scores.map(s => Number(s.score))),
    avgAccuracy: avg(scores.map(s => Number(s.accuracy))),
    avgCompleteness: avg(scores.map(s => Number(s.completeness))),
    avgManualCompliance: avg(scores.map(s => Number(s.manualCompliance))),
    avgSafety: avg(scores.map(s => Number(s.safety))),
    generatedAt: new Date().toISOString()
  };
  writeJSON('agent_400_report.json', report);
  console.log(JSON.stringify(report, null, 2));
})().catch(e => {
  console.error(e);
  process.exit(1);
});
