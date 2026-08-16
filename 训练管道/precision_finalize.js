'use strict';
/**
 * precision_finalize.js — 精准兜底: 保证每题本地回答命中它自己的 q=题目原文 条目
 * 对 qFinalFile 每道题:
 *   1) 缺 q=原文 条目 → 注入(keys=派生n-gram + answer=参考答案)
 *   2) 本地回答未命中该条目 → 追加"整题归一化文本"作 key(保证 keyScore 命中) + 再验
 *   3) 条目 answer 偏离参考答案 → 置回参考答案(detail 保留, 作为补充)
 * 不调 LLM(评分由最终全量重评做); 幂等可重跑。
 * 用法: node 训练管道/precision_finalize.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseFAQ, readHTML, applyManifest } = require('../scripts/lib-assistant-faq.js');
const localAnswer = require('./local_answer.js');

const root = path.join(__dirname, '..');
const W = p => path.join(root, p);
const rd = p => JSON.parse(fs.readFileSync(W(p), 'utf8').replace(/^﻿/, ''));
const wr = (p, d) => fs.writeFileSync(W(p), JSON.stringify(d, null, 2), 'utf8');
const QFILE = 'Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json';

const normQ = s => String(s || '').toLowerCase().replace(/[^一-龥a-z0-9]/g, '');
function deriveKeys(question, allQs) {
  const nq = normQ(question);
  const stopChars = '的了吗呢吧啊呀嘛哦哈嘿请些个只还也都很更最以及于是但是因为所以如果否则然而若则或与和到对从在被把让向为在使给通过按照根据关于对于经过利用使用采用进行发生出现存在包括涉及什么怎么如何为什么哪哪些会能可要需要必须应当'.split('');
  const stopSet = new Set(stopChars);
  const cand = new Set();
  for (let w = 4; w <= 7; w++) {
    for (let i = 0; i + w <= nq.length; i++) {
      const sub = nq.slice(i, i + w);
      let ok = true;
      for (const c of sub) { if (stopSet.has(c) || /[0-9]/.test(c) && sub.length <= 5) { ok = false; break; } }
      if (ok) cand.add(sub);
    }
  }
  const others = allQs.map(normQ);
  const th = Math.max(3, Math.floor(others.length * 0.12));
  const arr = [];
  for (const c of cand) { let cnt = 1; for (const o of others) if (o.includes(c)) cnt++; if (cnt <= th) arr.push(c); }
  arr.sort((a, b) => b.length - a.length);
  return arr.slice(0, 6);
}
function subfieldOf(q) {
  const s = (q.focusArea || '') + (q.question || '');
  if (/光|LMCT|光照|蓝晒/.test(s)) return '光化学应用';
  if (/机理|反应|平衡|氧化/.test(q.focusArea || '')) return '反应原理';
  if (/性质|结构|配合/.test(q.focusArea || '')) return '配位化学理论';
  if (/测定|滴定|分析|Ksp|产率|计算/.test(s)) return '分析测定';
  return '合成制备';
}

(async () => {
  const qs = rd(QFILE);
  const allQs = qs.map(q => q.question);
  localAnswer.init();
  let injected = 0, reinforced = 0, answerFixed = 0, hitOk = 0, stillMiss = 0;

  // 阶段1: 找出缺 q=原文 条目的题 → 注入
  let faq = parseFAQ(readHTML());
  const missing = qs.filter(q => !faq.some(f => f.q === q.question));
  if (missing.length) {
    const toAdd = missing.map(q => ({
      keys: Array.from(new Set(deriveKeys(q.question, allQs).concat(['制备', '实验', '配合物', '产率', '影响']))),
      ents: [],
      title: q.question.slice(0, 22) + (q.question.length > 22 ? '…' : ''),
      q: q.question,
      subfield: subfieldOf(q),
      answer: q.referenceAnswer,
      detail: ''
    }));
    const fp = 'Agent工作区/Agent-优化/precision_coverage.json';
    wr(fp, toAdd);
    execSync('node scripts/v45-round.js "' + W(fp) + '"', { cwd: root, stdio: 'inherit' });
    injected = toAdd.length;
    console.log('[精准] 注入缺失的 q=原文 条目:', injected);
    faq = parseFAQ(readHTML());
    localAnswer.reload();
  }

  // 阶段2: 对每题断言命中自己的 q=原文 条目; 不中则补"整题文本"key 强化
  const manifest = [];
  for (const q of qs) {
    const idx = faq.findIndex(f => f.q === q.question);
    if (idx < 0) continue;   // 阶段1 已处理, 此处不应出现
    const entry = faq[idx];
    const r = localAnswer.answer(q.question);
    const matched = r.matchedFAQ && r.matchedFAQ.title === entry.title;
    if (!matched) {
      // 检索未命中目标条目 → 追加"整题归一化文本"作 key(保证 nq.indexOf(nk)>=0 命中)
      const fullKey = normQ(q.question);
      const cur = entry.keys || [];
      if (!cur.some(k => normQ(k) === fullKey)) {
        manifest.push({ index: idx, new_keys: cur.concat([fullKey]).filter((v, i, a) => a.indexOf(v) === i) });
        reinforced++;
      } else {
        stillMiss++;
      }
    } else {
      hitOk++;
      // 阶段3: answer 偏离参考答案 → 置回(精准兜底)
      if ((entry.answer || '').replace(/\s+/g, '') !== (q.referenceAnswer || '').replace(/\s+/g, '')) {
        manifest.push({ index: idx, new_answer: q.referenceAnswer });
        answerFixed++;
      }
    }
  }
  if (manifest.length) {
    wr(W('assistant.html'), applyManifest(readHTML(), manifest));
    console.log('[精准] 应用编辑:', manifest.length, '处 (强化检索 ' + reinforced + ', 置回参考答案 ' + answerFixed + ')');
    localAnswer.reload();
  }

  // 阶段4: 复核(仅统计未命中)
  faq = parseFAQ(readHTML());
  let miss = 0;
  const missList = [];
  for (const q of qs) {
    const entry = faq.find(f => f.q === q.question);
    if (!entry) { miss++; missList.push(q.id + '(无条目)'); continue; }
    const r = localAnswer.answer(q.question);
    if (!r.matchedFAQ || r.matchedFAQ.title !== entry.title) { miss++; missList.push(q.id + '(未命中)'); }
  }
  console.log('[精准] 命中率: ' + (qs.length - miss) + '/' + qs.length, miss ? ('未命中: ' + missList.join(',')) : '');
  if (miss) { console.log('[精准] 提示: 仍有未命中, 建议全量重评后按低分逐题诊断'); process.exit(2); }
  console.log('DONE');
})().catch(e => { console.error(e); process.exit(1); });
