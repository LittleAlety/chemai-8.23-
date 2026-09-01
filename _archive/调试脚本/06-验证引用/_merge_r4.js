'use strict';
// 合并 round4 两份题集（B=计算/数据 90 题，C=实验操作/流程 110 题）→ 四份交付物。
// 运行：node _merge_r4.js  （需 agent_B_calc_90.json 与 agent_C_proc_110.json 均已生成）
const fs = require('fs');
const path = require('path');
const R4 = path.join(__dirname, '..', '..', '..');
const TODAY = new Date().toISOString().slice(0, 10);

const read = fp => JSON.parse(fs.readFileSync(path.join(R4, fp), 'utf8').replace(/^﻿/, ''));

// ---- 读取两份 agent 产物 ----
const B = read('试题迭代记录/round4/agent_B_calc_90.json');
const C = read('试题迭代记录/round4/agent_C_proc_110.json');
const all = B.questions.concat(C.questions);
console.log('B=' + B.questions.length + ' C=' + C.questions.length + ' total=' + all.length);
if (all.length !== 200) { console.error('期望 200 题，实得 ' + all.length + '，终止'); process.exit(2); }

// ---- 分类 → 映射表（focusArea / subfield / chapterHint / chapter / topic） ----
const M = {
  '分析测定':        { focus: '数据计算', sub: '分析测定', ch: 'ch5', hint: 'ch5-s1' },
  '反应原理':        { focus: '反应原理', sub: '反应机理', ch: 'ch3', hint: 'ch3-s1' },
  '高等理论':        { focus: '理论计算', sub: '高等理论', ch: 'ch7', hint: 'ch7-s1' },
  '实验操作':        { focus: '操作步骤', sub: '实验操作', ch: 'ch4', hint: 'ch4-s1' },
  '合成制备':        { focus: '制备流程', sub: '合成制备', ch: 'ch3', hint: 'ch3-s2' },
  '综合研究':        { focus: '综合',     sub: '综合研究', ch: 'ch9', hint: 'ch9-s1' },
  '安全与废物处理':  { focus: '安全',     sub: '安全规范', ch: 'ch8', hint: 'ch8-s1' }
};
const DIFF = { easy: '易', medium: '中', hard: '较难' };
function meta(cat) { return M[cat] || { focus: '综合', sub: cat, ch: 'ch9', hint: 'ch9-s1' }; }

// ---- ① 闭环输入：self_train_q_n200_final.json（id 用 Q001..Q200，可被 validateQuestionSet 解析） ----
const loopQs = all.map((q, i) => {
  const m = meta(q.category);
  return {
    id: 'Q' + String(i + 1).padStart(3, '0'),
    question: q.question,
    referenceAnswer: q.referenceAnswer || q.answer || '',
    focusArea: m.focus,
    subfield: m.sub,
    difficulty: DIFF[q.difficulty] || q.difficulty || '中'
  };
});
fs.writeFileSync(path.join(R4, 'Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json'),
  JSON.stringify(loopQs, null, 2), 'utf8');
console.log('① self_train_q_n200_final.json:', loopQs.length, '题');

// ---- ② core 题集：test_questions_core_r19.json（保留原 id / category / key_points / faq_verify） ----
fs.writeFileSync(path.join(R4, '试题迭代记录/round4/test_questions_core_r19.json'),
  JSON.stringify({ round: 'core-19', based_on: 'test_questions_core_r18.json', generated_at: TODAY, questions: all }, null, 2), 'utf8');
console.log('② test_questions_core_r19.json:', all.length, '题');

// ---- ③ round 轮库：test_questions_round4.json（id / chapter / type / difficulty / topic / question / answer / explanation / referenceAnswer） ----
const roundQs = all.map(q => {
  const m = meta(q.category);
  return {
    id: q.id,
    chapter: m.ch,
    type: q.type,
    difficulty: q.difficulty,
    topic: q.faq_verify || m.focus,
    category: q.category,
    question: q.question,
    answer: q.answer || q.referenceAnswer || '',
    explanation: q.explanation || '',
    referenceAnswer: q.referenceAnswer || q.answer || ''
  };
});
fs.writeFileSync(path.join(R4, '试题迭代记录/round4/test_questions_round4.json'),
  JSON.stringify({ round: 4, total: 200, generated_at: TODAY, questions: roundQs }, null, 2), 'utf8');
console.log('③ test_questions_round4.json:', roundQs.length, '题');

// ---- ④ B 题集：agent_b_questions_r4.json（question / referenceAnswer / category / chapterHint / batch / seq / answer） ----
const batchQs = all.map((q, i) => {
  const m = meta(q.category);
  return {
    question: q.question,
    referenceAnswer: q.referenceAnswer || q.answer || '',
    category: q.category,
    chapterHint: m.hint,
    batch: Math.floor(i / 25) + 1,
    seq: (i % 25) + 1,
    answer: q.answer || q.referenceAnswer || ''
  };
});
fs.writeFileSync(path.join(R4, 'Agent工作区/Agent-B-问题生成/agent_b_questions_r4.json'),
  JSON.stringify(batchQs, null, 2), 'utf8');
console.log('④ agent_b_questions_r4.json:', batchQs.length, '题');

// ---- 校验：category 分布 ----
const counts = {};
all.forEach(q => { counts[q.category] = (counts[q.category] || 0) + 1; });
console.log('category 分布:', JSON.stringify(counts));
console.log('DONE');
