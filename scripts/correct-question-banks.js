'use strict';
const fs = require('fs');
const path = require('path');
const { normalize } = require('./category-utils');

const root = path.join(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const writeJSON = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2), 'utf8');

const normText = s => String(s || '').replace(/\s+/g, '').toLowerCase();
const rootFileRe = /^(test_questions_core(?:_r\d+)?(?:_fixed)?|test_questions_round\d*|extra_questions|agent_b_questions_r\d+|agent_b_400_questions)\.json$/;
const CORRUPT_CATEGORY = {
  '\uFFFD\uFFFD全规范': '安全与废物处理',
  '安全规\uFFFD\uFFFD与废液处理': '安全与废物处理',
  '化\uFFFD\uFFFD热力学与动力学': '反应原理',
  '\uFFFD\uFFFD作步骤': '实验操作'
};

const files = fs.readdirSync(root)
  .filter(f => rootFileRe.test(f))
  .map(f => f);
const subdirs = [
  'Agent工作区/Agent-B-问题生成',
  'Agent工作区/Agent-D-验证',
  'Agent工作区/Agent-C-答案评分',
  'Agent工作区/Agent-报告',
  'Agent工作区/Agent-优化',
  '试题迭代记录/round1',
  '试题迭代记录/round2',
  '试题迭代记录/round3'
];
subdirs.forEach(sd => {
  const sdPath = path.join(root, sd);
  if (fs.existsSync(sdPath)) {
    fs.readdirSync(sdPath)
      .filter(f => rootFileRe.test(f))
      .forEach(f => files.push(path.join(sd, f)));
  }
});
['questions_master.json', 'all_cycle_questions.json'].forEach(f => {
  if (fs.existsSync(path.join(root, 'data', f))) files.push('data/' + f);
});

const report = [];

function getItems(data) {
  if (Array.isArray(data)) return { items: data, wrapper: null };
  for (const key of ['items', 'questions', 'entries']) {
    if (Array.isArray(data[key])) return { items: data[key], wrapper: key };
  }
  return { items: [], wrapper: null };
}

files.forEach(rel => {
  const preserveDuplicates = /^agent_b_/.test(rel);
  const data = readJSON(rel);
  const { items, wrapper } = getItems(data);
  const seen = new Set();
  let before = items.length;
  let emptyRemoved = 0;
  let dupRemoved = 0;
  let categoryFixed = 0;
  const fixed = [];

  items.forEach(item => {
    if (!item || typeof item !== 'object') return;
    const q = item.question || item.q || item.title || '';
    if (!String(q).trim()) {
      emptyRemoved++;
      return;
    }
    const key = normText(q);
    if (seen.has(key) && !preserveDuplicates) {
      dupRemoved++;
      return;
    }
    seen.add(key);

    if (!item.question && item.q) item.question = item.q;
    if (!item.answer && item.referenceAnswer) item.answer = item.referenceAnswer;
    if (!item.answer && item.key_points) item.answer = item.key_points;
    if (!item.answer && item.explanation) item.answer = item.explanation;
    if (!item.referenceAnswer && item.answer) item.referenceAnswer = item.answer;

    const rawCat = item.category || item.subfield || '';
    const cat = normalize(CORRUPT_CATEGORY[rawCat] || rawCat);
    if (item.category !== cat) {
      item.category = cat;
      categoryFixed++;
    }

    if (item.difficulty) {
      const d = String(item.difficulty).toLowerCase();
      item.difficulty = /简单|容易|easy|1/.test(d) ? 'easy' : /困难|难|hard|3/.test(d) ? 'hard' : 'medium';
    }
    fixed.push(item);
  });

  if (wrapper) {
    data[wrapper] = fixed;
    writeJSON(rel, data);
  } else {
    writeJSON(rel, fixed);
  }

  report.push({ file: rel, before, after: fixed.length, emptyRemoved, dupRemoved, categoryFixed });
  console.log(rel, JSON.stringify({ before, after: fixed.length, emptyRemoved, dupRemoved, categoryFixed }));
});

writeJSON('Agent工作区/Agent-报告/question_bank_correction_report.json', { files: report, correctedAt: new Date().toISOString() });
