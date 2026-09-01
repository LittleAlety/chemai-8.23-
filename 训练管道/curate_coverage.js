'use strict';
/**
 * ChemAI 存量覆盖条目质量清理（v85，entry 级）
 *
 * 目的：已有长 q 覆盖条目（基础库 + cycle1 补录）里，仍有一批旧标题以「第N步」开头、
 * 或 keys 高达 70（>45），会在 matchFAQ 里被 ×0.12 模板压 / firehose √ 阻尼 误伤。
 * 这些压分属 matchFAQ 基础表达式（scorer-base，不可改），故只能在 entry 级让条目不触发它们。
 *
 * 本工具【只改 title + keys】，【不删条目】、【不动 answer/detail】。
 *   ① 标题含「第X步」→ 用 coverageTitle(去第X步/留 ·/≤22字) 重写。
 *   ② keys>45（firehose）或覆盖型长q条目键数>20 → pruneCoverageKeys 收敛到 ≤20。
 * 其余条目（合法短题、title==q 的主题条目）一律不动，避免误伤。
 *
 * 用法：
 *   node 训练管道/curate_coverage.js            # --check 仅报告
 *   node 训练管道/curate_coverage.js --apply    # 写回 faq_runtime.js（先自动备份 .bak_before_curate）
 *   node 训练管道/curate_coverage.js --json     # 机读输出（供 outer_loop 用）
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { readFAQRuntime, writeFAQRuntime } = require(path.join(root, 'scripts', 'lib-assistant-faq.js'));
const { coverageTitle, pruneCoverageKeys } = require(path.join(root, 'scripts', 'lib-coverage.js'));

const STEP_T = /第[一二三四五六七八九十百\d]+步/;
const isCoverage = e => e.q && e.title && String(e.q).length >= 40 && e.q !== e.title;
const stepTitle = e => STEP_T.test(e.title || '');
const firehose = e => (e.keys || []).length > 45;
const toCurate = e => isCoverage(e) || stepTitle(e) || firehose(e);

function curateOne(e) {
  const out = Object.assign({}, e);
  let titleChanged = false, keysChanged = false;
  if (stepTitle(e)) { out.title = coverageTitle(e.q); titleChanged = out.title !== e.title; }
  const klen = (e.keys || []).length;
  if (firehose(e) || (isCoverage(e) && klen > 20)) {
    const pk = pruneCoverageKeys(e.keys || []);
    if (pk.length < klen) { out.keys = pk; keysChanged = true; }
  }
  return { out, titleChanged, keysChanged };
}

function run(apply) {
  const faq = readFAQRuntime();
  let curated = 0, titleChang = 0, keysChang = 0, stepBefore = 0, stepAfter = 0, maxKBefore = 0, maxKAfter = 0;
  const out = faq.map(e => {
    if (!toCurate(e)) return e;
    const r = curateOne(e);
    curated++;
    if (r.titleChanged) titleChang++;
    if (r.keysChanged) keysChang++;
    if (STEP_T.test(e.title || '')) stepBefore++;
    if (STEP_T.test(r.out.title || '')) stepAfter++;
    maxKBefore = Math.max(maxKBefore, (e.keys || []).length);
    maxKAfter = Math.max(maxKAfter, (r.out.keys || []).length);
    return r.out;
  });
  const res = { ok: true, total: faq.length, curated, titleChang, keysChang, stepBefore, stepAfter, maxKBefore, maxKAfter };
  if (apply) {
    const bak = path.join(root, 'data', 'faq_runtime.js.bak_before_curate');
    if (!fs.existsSync(bak)) fs.copyFileSync(path.join(root, 'data', 'faq_runtime.js'), bak);
    writeFAQRuntime(out);
    res.applied = true;
  }
  return res;
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  const json = process.argv.includes('--json');
  const res = run(apply);
  if (json) { console.log(JSON.stringify(res, null, 2)); }
  else {
    console.log('========== 存量覆盖条目清理 ==========');
    console.log('  ' + (apply ? '[APPLY] 已写回 faq_runtime.js' : '[CHECK] 仅模拟，未写回（加 --apply 生效）'));
    console.log('  总条目: ' + res.total + '  清理条目: ' + res.curated);
    console.log('  title 重写: ' + res.titleChang + '   keys 收敛: ' + res.keysChang);
    console.log('  标题含「第X步」: ' + res.stepBefore + ' → ' + res.stepAfter);
    console.log('  keys 最大: ' + res.maxKBefore + ' → ' + res.maxKAfter + '（目标 <45）');
  }
}
module.exports = { run };
