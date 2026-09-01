'use strict';
// Phase 5 验证①：无头 local_answer 对 round4 题目命中计算模式并产生与 referenceAnswer 一致的数值。
// 运行：node _verify_r4.js
const fs = require('fs');
const path = require('path');
const R4 = path.join(__dirname, '..', '..', '..');
const la = require(path.join(R4, '训练管道/local_answer.js'));
const ChemCalc = require(path.join(R4, 'scripts/lib-calc.js'));
la.init();

const qs = JSON.parse(fs.readFileSync(path.join(R4, 'Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json'), 'utf8'));
console.log('loaded questions:', qs.length);

let calcHit = 0, calcMiss = 0, mismatch = 0;
const reports = [];

// 从 referenceAnswer 抽取"真实数值"（含科学计数法/上标，如 3.65×10⁻⁴ → 3.65e-4）
const SUPMAP = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+','−':'-'};
function refValues(ans) {
  const out = [], s = String(ans || '');
  // 科学计数法：1.0×10²⁰ / 3.65×10⁻⁴ / 5.0e-3
  let re = /(\d+(?:\.\d+)?)\s*[×x·]\s*10\s*([⁻⁺−\-\+−]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, m;
  while ((m = re.exec(s)) !== null) {
    let sign = 1, digits = '';
    for (const ch of m[2]) {
      if (ch === '⁻' || ch === '−' || ch === '-') { if (digits === '') sign = -1; }
      else if (SUPMAP[ch]) digits += SUPMAP[ch];
      else if (ch >= '0' && ch <= '9') digits += ch;
    }
    out.push(parseFloat(m[1]) * Math.pow(10, sign * parseInt(digits || '0', 10)));
  }
  re = /(\d+(?:\.\d+)?)\s*[eE]\s*([−\-\+]?\d+)/g;
  while ((m = re.exec(s)) !== null) out.push(parseFloat(m[1]) * Math.pow(10, parseFloat(m[2])));
  out.push.apply(out, (s.match(/\d+(?:\.\d+)?/g) || []).map(Number));
  return out;
}
// 把结果对象展平为所有数值叶子
function flattenNums(res) {
  if (res == null) return [];
  if (typeof res === 'number') return [res];
  const out = [];
  for (const k in res) if (typeof res[k] === 'number') out.push(res[k]);
  return out;
}

for (const q of qs) {
  const r = la.answer(q.question);
  const isCalcQ = /\d/.test(q.referenceAnswer) && /产率|%|g|mol|滴定|结晶水|磁矩|CFSE|能斯特|ΔG|摩尔质量|配制/.test(q.referenceAnswer);
  if (r.calc && r.calc.result != null) {
    calcHit++;
    const refs = refValues(q.referenceAnswer);
    const target = flattenNums(r.calc.result);
    let matched = false;
    for (const tv of target) {
      if (refs.some(n => Math.abs(Math.abs(n) - Math.abs(tv)) <= Math.max(0.18, Math.abs(tv) * 0.025))) { matched = true; break; }
    }
    if (!matched) {
      mismatch++;
      reports.push({ id: q.id, type: r.calc.type, result: r.calc.result, refs: refs.slice(0, 8), q: q.question.slice(0, 50) });
    }
  } else if (isCalcQ) {
    calcMiss++;
    reports.push({ id: q.id, miss: true, q: q.question.slice(0, 50) });
  }
}

console.log('总题数=' + qs.length + '  命中计算=' + calcHit + '  未命中(疑计算题)=' + calcMiss + '  数值不一致=' + mismatch);
if (reports.length) {
  console.log('\n—— 需复核项 ——');
  reports.slice(0, 80).forEach(r => console.log(JSON.stringify(r)));
}
