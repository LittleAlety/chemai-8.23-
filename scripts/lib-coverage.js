'use strict';
/**
 * FAQ 覆盖补录条目质量共享工具（v85）
 * 供 训练管道/self_train.js（生产 ensureCoverage）与 训练管道/curate_coverage.js（存量清理）共用，
 * 保证标题净化/键收敛/近重复判定逻辑不漂移。纯函数，无外部依赖。
 *
 * 为何做：matchFAQ 里两层针对"泛条目"的压分 ——
 *   ① keys>45 → firehose √ 阻尼；② 标题/答案含「第N步/深度解析/反应机理…」且查询含操作词 → ×0.12。
 * 覆盖条是"逐字精答"而非"泛模板"，被这两层误伤（+200 在乘子前加、后被 ×0.12 削成 ~24）。
 * 因这两层属 matchFAQ 基础表达式（scorer-base，禁改），只能在 entry 级让覆盖条"长得不像"泛条目：
 *   标题去「第X步」、键收敛 <45、生成/清理前对近重复去重。
 */

// 归一：小写 + 只留 CJK/字母/数字（与 self_train.normQ 同逻辑；去掉 下标/·/标点）
function normQ(s){ return String(s || '').toLowerCase().replace(/[^一-龥a-z0-9]/g, ''); }

function _covBigrams(s){ s = normQ(s); const r = new Set(); for (let i = 0; i + 2 <= s.length; i++) r.add(s.slice(i, i + 2)); return r; }
function _covJaccard(a, b){ const A = _covBigrams(a), B = _covBigrams(b); if (!A.size || !B.size) return 0; let inter = 0; for (const x of A) if (B.has(x)) inter++; return inter / (A.size + B.size - inter); }
function _covNearDup(a, b){ return a !== b && _covJaccard(a, b) >= 0.6; }
function _covHasNearDup(q, existingQs){ const n = normQ(q); for (const e of existingQs) { if (_covNearDup(n, normQ(e))) return true; } return false; }

// 覆盖条标题：去掉所有「第X步」标记（避免 STEP_TEMPLATE_RE），折叠标点（保留 FeC₂O₄·2H₂O 的「·」），取 ≤22 字话题窗口
function coverageTitle(q){
  const raw = String(q || '').trim();
  let t = raw.replace(/第[一二三四五六七八九十百\d]+步/g, '');
  t = t.replace(/[，。；：、？！""''‘’【】（）《》()…—–\s]+/g, ' ');
  t = t.trim().slice(0, 22);
  if (!t) t = raw.slice(0, 22);
  return t + (raw.length > t.length ? '…' : '');
}

// 覆盖条 keys：去重 + 剔除与已保留长键「bigram 高度重叠」的 n-gram 偏移碎屑 + 上限 20（远离 firehose 45）
function pruneCoverageKeys(keys){
  const uniq = Array.from(new Set((keys || []).map(k => String(k).trim()).filter(k => k.length >= 2)));
  uniq.sort((a, b) => (b.length - a.length) || a.localeCompare(b));
  const kept = [];
  for (const k of uniq) {
    if (kept.length >= 20) break;
    const nk = normQ(k);
    if (kept.some(ok => _covJaccard(normQ(ok), nk) >= 0.5)) continue;   // 与已保留长键重叠 → 碎片
    kept.push(k);
  }
  return kept;
}

module.exports = { normQ, coverageTitle, pruneCoverageKeys, _covHasNearDup, _covNearDup, _covJaccard };
