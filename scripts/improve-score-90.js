'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const writeJSON = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2), 'utf8');

const FAQ = readJSON('data/faq_unified.json');
const MANUAL = readJSON('data/manual.json');
const QUESTIONS = readJSON('Agent工作区/Agent-B-问题生成/agent_b_questions_r2.json');
const API_KEY = process.env.DEEPSEEK_KEY;
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

const norm = s => String(s || '')
  .toLowerCase()
  .replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => '0123456789-+'['₀₁₂₃₄₅₆₇₈₉⁻⁺'.indexOf(c)])
  .replace(/\s+/g, '');

function llm(messages, maxTokens = 2000) {
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
    return 'FAQ《' + x.f.title + '》：' + String(x.f.answer || '').replace(/\s+/g, ' ').slice(0, 600);
  }).join('\n\n');
}

async function improveAnswers(answers, scores) {
  const digest = manualDigest();
  const system = '你是 ChemAI 实验助手。根据评分反馈和手册/FAQ 上下文改进回答。直接输出改进后的回答正文，不要 JSON、不要 Markdown 代码块。';
  let improved = 0;
  for (let i = 0; i < QUESTIONS.length; i++) {
    const score = scores.find(s => norm(s.question) === norm(QUESTIONS[i].question));
    if (!score || Number(score.score) >= 90) continue;
    const q = QUESTIONS[i];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = await llm([
          { role: 'system', content: system },
          { role: 'user', content: '题目：' + q.question +
            '\n\n原回答：' + answers[i].answer +
            '\n\n评分反馈：' + (score.comment || '回答不够完整/准确/贴近手册') +
            '\n\n手册/FAQ上下文：\n' + digest + '\n' + bestFAQContext(q.question) }
        ]);
        const cleaned = String(out || '').replace(/^```[\s\S]*?\n?/, '').replace(/\n?```$/, '').trim();
        if (cleaned) {
          answers[i].answer = cleaned;
          improved++;
          break;
        }
      } catch (e) {
        console.log('improve retry', i, e.message);
      }
    }
    if ((i + 1) % 10 === 0) console.log('improved', improved);
  }
  writeJSON('Agent工作区/Agent-优化/agent_opt_answers_improved.json', answers);
  return answers;
}

async function scoreAll(questions, answers) {
  const results = new Array(questions.length);
  const system = '你是 ChemAI 评分官。只输出 JSON 数组，每项：{"question":"原题","score":0-100,"accuracy":0-100,"completeness":0-100,"manualCompliance":0-100,"safety":0-100,"comment":"一句话评价"}';
  for (let i = 0; i < questions.length; i += 10) {
    const idxs = Array.from({ length: Math.min(10, questions.length - i) }, (_, j) => i + j);
    const entries = idxs.map(idx => ({ question: questions[idx].question, referenceAnswer: questions[idx].referenceAnswer, assistantAnswer: answers[idx].answer }));
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
        console.log('score retry', i / 10 + 1, e.message);
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
  const holes = [];
  for (let i = 0; i < results.length; i++) if (results[i] == null) holes.push(i);
  const systemSingle = '你是 ChemAI 评分官。只输出一行：score: 数字; accuracy: 数字; completeness: 数字; manualCompliance: 数字; safety: 数字; comment: 简短评价';
  for (const idx of holes) {
    const q = questions[idx];
    const entry = [{ question: q.question, referenceAnswer: q.referenceAnswer, assistantAnswer: answers[idx].answer }];
    const out = await llm([
      { role: 'system', content: systemSingle },
      { role: 'user', content: '请按参考答案给 AI 助手回答评分：\n' + JSON.stringify(entry, null, 2) }
    ]);
    const nums = [...String(out || '').matchAll(/(accuracy|completeness|manualCompliance|safety|score)\s*[:：]\s*(\d{1,3})/gi)]
      .reduce((a, m) => { a[m[1].toLowerCase()] = m[2]; return a; }, {});
    const score = Number(nums.score || 0);
    results[idx] = {
      question: q.question,
      score,
      accuracy: Number(nums.accuracy || score),
      completeness: Number(nums.completeness || score),
      manualCompliance: Number(nums.manualcompliance || score),
      safety: Number(nums.safety || 100),
      comment: String(out || '').replace(/\s+/g, ' ').slice(0, 200)
    };
    console.log('individual scored', idx + 1);
  }
  return results;
}

const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0;

(async () => {
  if (!API_KEY) throw new Error('DEEPSEEK_KEY missing');
  const answers = readJSON('Agent工作区/Agent-优化/agent_opt_answers_final.json');
  const scores = readJSON('Agent工作区/Agent-优化/agent_opt_scores_final.json');
  await improveAnswers(answers, scores);
  const improvedScores = await scoreAll(QUESTIONS, answers);
  const report = {
    total: QUESTIONS.length,
    scored: improvedScores.filter(Boolean).length,
    avgScore: avg(improvedScores.filter(Boolean).map(s => Number(s.score))),
    avgAccuracy: avg(improvedScores.filter(Boolean).map(s => Number(s.accuracy))),
    avgCompleteness: avg(improvedScores.filter(Boolean).map(s => Number(s.completeness))),
    avgManualCompliance: avg(improvedScores.filter(Boolean).map(s => Number(s.manualCompliance))),
    avgSafety: avg(improvedScores.filter(Boolean).map(s => Number(s.safety))),
    generatedAt: new Date().toISOString()
  };
  writeJSON('Agent工作区/Agent-优化/agent_opt_scores_improved.json', improvedScores.filter(Boolean));
  writeJSON('Agent工作区/Agent-报告/agent_opt_report_improved.json', report);
  console.log(JSON.stringify(report, null, 2));
})().catch(e => {
  console.error(e);
  process.exit(1);
});
