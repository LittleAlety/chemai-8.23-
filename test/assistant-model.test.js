'use strict';
// ChemAI v69 · AssistantModel 纯函数单测（无 DOM 依赖部分）
global.window = global.window || {};
const { test } = require('node:test');
const assert = require('node:assert');
require('../assets/assistant-model.js');
const AM = global.window.AssistantModel;

// localStorage 轻量 stub：assistant-model 的 _lsGet/_lsSet 在被调用时才读，故 require 后装亦可
const __store = {};
global.localStorage = {
  getItem: k => (k in __store ? __store[k] : null),
  setItem: (k, v) => { __store[k] = String(v); },
  removeItem: k => { delete __store[k]; }
};

test('AssistantModel 暴露核心 API', () => {
  assert.ok(AM);
  assert.ok(Array.isArray(AM.MODE_IDS));
  assert.equal(typeof AM.buildStagedBlocks, 'function');
  assert.ok(AM.Typewriter && typeof AM.Typewriter.write === 'function');
  assert.equal(typeof AM.srsSchedule, 'function');
});

test('srsSchedule：间隔递增、掌握度影响 EF', () => {
  assert.equal(AM.srsSchedule(0.9, 0, 0).interval, 1);   // 首轮
  assert.equal(AM.srsSchedule(0.9, 1, 1).interval, 3);   // 第二轮
  assert.ok(AM.srsSchedule(0.9, 2, 3).interval >= 3);    // 后续递增
  const hi = AM.srsSchedule(0.9, 1, 1).ef;
  const lo = AM.srsSchedule(0.4, 1, 1).ef;
  assert.ok(hi > lo, '掌握度高 → EF 应更高');
});

test('buildPlanHTML：生成执行计划步骤', () => {
  const h = AM.buildPlanHTML('为什么加乙醇后必须搅拌', ['乙醇', '介电']);
  assert.ok(h.includes('执行计划'));
  assert.match(h, /plan-step/);
  assert.ok(h.includes('乙醇'));
});

test('buildReasoningHTML：包装计数与正文', () => {
  const h = AM.buildReasoningHTML({ counts: { hits: 2, analogy: 1 }, label: '中置信度', bodyHTML: '<b>x</b>' });
  assert.ok(h.includes('思考链'));
  assert.ok(h.includes('2 条检索'));
  assert.ok(h.includes('1 条类比'));
});

test('buildVisualHTML：流程类提问生成 SVG', () => {
  const h = AM.buildVisualHTML('画出三步反应的流程图', null);
  assert.match(h, /<svg/);
});

test('buildVisualHTML：无匹配时给提示而非空白', () => {
  const h = AM.buildVisualHTML('随便问点别的', null);
  assert.ok(h.length > 0);
});

test('buildMasteryDashboardHTML：空状态给 CTA', () => {
  const h = AM.buildMasteryDashboardHTML();
  assert.ok(h.includes('掌握度测评'));
});

test('exportLearningJSON：聚合各维度', () => {
  const s = AM.exportLearningJSON({ mastery: { total: 88 }, wrong: [{ q: 'x' }], feedback: [{ vote: 'up' }], srs: { cards: [] } });
  const o = JSON.parse(s);
  assert.equal(o.mastery.total, 88);
  assert.equal(o.wrong.length, 1);
  assert.ok(o.exportedAt);
});

const DAY = 86400000;

test('srsMerge：首轮新卡 due=now、reps=0、interval=1', () => {
  const now = 1700000000000;
  const cards = AM.srsMerge([], [{ name: 'A', m: 0.9 }], now);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].name, 'A');
  assert.equal(cards[0].mastery, 0.9);
  assert.equal(cards[0].reps, 0);
  assert.equal(cards[0].interval, 1);
  assert.equal(cards[0].due, now);           // 立即可复习
  assert.equal(cards[0].ef, 2.6);            // 掌握度高 → EF 高
});

test('srsMerge：既有卡视为复习 → reps++、间隔外推', () => {
  const now = 1700000000000;
  const existing = [{ name: 'A', mastery: 0.8, reps: 0, interval: 1, due: 0 }];
  const cards = AM.srsMerge(existing, [{ name: 'A', m: 0.85 }], now);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].reps, 1);
  assert.equal(cards[0].interval, 3);        // reps 1 → interval 3
  assert.equal(cards[0].due, now + 3 * DAY);
});

test('srsMerge：保留本次未覆盖的既有卡', () => {
  const now = 1700000000000;
  const existing = [{ name: 'B', mastery: 0.6, reps: 1, interval: 3, due: now, ef: 2.1 }];
  const cards = AM.srsMerge(existing, [{ name: 'A', m: 0.9 }], now);
  const names = cards.map(c => c.name).sort();
  assert.deepEqual(names, ['A', 'B']);
});

test('srsMerge：m===null 的项跳过不建卡', () => {
  const now = 1700000000000;
  const cards = AM.srsMerge([], [{ name: 'A', m: null }, { name: 'B', m: 0.5 }], now);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].name, 'B');
});

test('srsMerge：无入参安全返回空数组', () => {
  assert.deepEqual(AM.srsMerge(null, null, 0), []);
});

test('feedbackDelta：up/down 各 ±1.5 并 clamp ±3', () => {
  assert.equal(AM.feedbackDelta(0, 'up'), 1.5);
  assert.equal(AM.feedbackDelta(0, 'down'), -1.5);
  assert.equal(AM.feedbackDelta(1.5, 'up'), 3);   // 累加至上限
  assert.equal(AM.feedbackDelta(-1.5, 'down'), -3); // 累加至下限
  assert.equal(AM.feedbackDelta(3, 'up'), 3);     // 不再超过
  assert.equal(AM.feedbackDelta(-3, 'down'), -3);
});

test('toggleFavorite/isFavorite：增删往返', () => {
  delete __store['chemai_favorites_v1'];
  assert.equal(AM.isFavorite('A'), false);
  assert.equal(AM.toggleFavorite({ id: 'A', title: 'x', src: 'corpus' }), true);   // 新增
  assert.equal(AM.isFavorite('A'), true);
  assert.equal(AM.toggleFavorite({ id: 'A', title: 'x', src: 'corpus' }), false);  // 移除
  assert.equal(AM.isFavorite('A'), false);
});

test('saveNote/getNote：写、改、清空', () => {
  delete __store['chemai_notes_v1'];
  AM.saveNote('k', 'hello');
  assert.equal(AM.getNote('k'), 'hello');
  AM.saveNote('k', 'world');
  assert.equal(AM.getNote('k'), 'world');
  AM.saveNote('k', '   ');
  assert.equal(AM.getNote('k'), '');
});

test('buildCompareTableHTML：参数对照表 + ⚠ 标记', () => {
  const rows = [{ param: '烘干温度', lecture: '50℃', cells: [{ title: 'A', hit: true }, { title: 'B', hit: false }] }];
  const h = AM.buildCompareTableHTML(rows);
  assert.ok(h.includes('多文献横向对比'));
  assert.ok(h.includes('50℃'));
  assert.ok(h.includes('⚠'));
  assert.ok(h.includes('A'));
  assert.ok(h.includes('B'));
});

test('buildCompareTableHTML：空入参返回空串', () => {
  assert.equal(AM.buildCompareTableHTML(null), '');
  assert.equal(AM.buildCompareTableHTML([]), '');
});

test('exportLearningJSON：含 favorites/notes', () => {
  const o = JSON.parse(AM.exportLearningJSON({ mastery: { total: 88 }, favorites: [{ id: 'A' }], notes: { A: 'x' } }));
  assert.deepEqual(o.favorites, [{ id: 'A' }]);
  assert.deepEqual(o.notes, { A: 'x' });
});

test('buildFavoritesHTML：空收藏给提示，有收藏给卡片', () => {
  delete __store['chemai_favorites_v1'];
  assert.ok(AM.buildFavoritesHTML().includes('还没有收藏'));
  __store['chemai_favorites_v1'] = JSON.stringify([{ id: '1', title: '文献A', src: 'corpus' }]);
  const h = AM.buildFavoritesHTML();
  assert.ok(h.includes('文献A'));
  assert.ok(h.includes('收藏与笔记'));
});
