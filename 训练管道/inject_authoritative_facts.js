'use strict';
/**
 * 注入"知识清单再检索"筛出的权威事实（entry 级，纯追加，幂等）（v85）
 *
 * 数据源 data/corpus_authoritative_facts.json（只读 corpus 提炼、每条含 sourceCorpusId 溯源）。
 * 注入规则：
 *   ① 条目形状与 ensureCoverage 完全一致 {keys, ents, title, q, subfield, answer, detail}。
 *   ② title 优先用 fact.title（无「第X步」且 ≤22 字），否则 coverageTitle(q)。
 *   ③ keys 经 pruneCoverageKeys 收敛 ≤20（远离 firehose 45）。
 *   ④ 追加前做近重复检查（_covHasNearDup, jaccard≥0.6）与 q 精确相等检查，绝不重复入库。
 *   ⑤ 写回前自动备份 faq_runtime.js（.bak_before_authoritative，仅首次）。
 * 本工具【纯追加】【不删条目】【不动 matchFAQ 基础公式】。
 *
 * 用法：
 *   node 训练管道/inject_authoritative_facts.js            # 默认 APPLY（用户已授权自动注入）
 *   node 训练管道/inject_authoritative_facts.js --check    # 仅报告，不写回
 *   node 训练管道/inject_authoritative_facts.js --json     # 机读输出
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { readFAQRuntime, writeFAQRuntime } = require(path.join(root, 'scripts', 'lib-assistant-faq.js'));
const { coverageTitle, pruneCoverageKeys, _covHasNearDup } = require(path.join(root, 'scripts', 'lib-coverage.js'));

const STEP_T = /第[一二三四五六七八九十百\d]+步|深度解析|反应机理|热力学与动力学|氧化电位/;
const GENRE = /^(三草酸合铁|.*(磁矩|晶体|含量|温度|配方|结晶|分解|光量计))/;

function buildEntry(fact, existingQs) {
  const q = String(fact.q || '').trim();
  if (!q) return null;
  const t = String(fact.title || '').trim();
  const title = (t && !STEP_T.test(t) && t.length <= 22) ? t : coverageTitle(q);
  const keys = pruneCoverageKeys(Array.isArray(fact.keys) ? fact.keys : []);
  return {
    keys: keys.length ? keys : ['三草酸合铁', '实验'],
    ents: [],
    title,
    q,
    subfield: String(fact.subfield || '综合研究'),
    answer: String(fact.answer || '').trim(),
    detail: ''
  };
}

function run(apply) {
  const factsPath = path.join(root, 'data', 'corpus_authoritative_facts.json');
  const facts = JSON.parse(fs.readFileSync(factsPath, 'utf8')).facts || [];
  let faq = readFAQRuntime();
  const existingQs = faq.map(f => f.q);

  const added = [];
  const skipped = [];
  for (const f of facts) {
    if (!f || !f.q) continue;
    const q = String(f.q).trim();
    if (faq.some(e => e.q === q)) { skipped.push({ q, why: 'exact-exists' }); continue; }
    if (_covHasNearDup(q, existingQs)) { skipped.push({ q, why: 'near-dup' }); continue; }
    const entry = buildEntry(f, existingQs);
    if (!entry || !entry.answer) { skipped.push({ q, why: 'no-answer' }); continue; }
    added.push(entry);
    faq.push(entry);
    existingQs.push(q);
  }

  const res = { ok: true, factsTotal: facts.length, added: added.length, skipped: skipped.length, skippedDetail: skipped, newTotal: faq.length };
  if (apply && added.length > 0) {
    const bak = path.join(root, 'data', 'faq_runtime.js.bak_before_authoritative');
    if (!fs.existsSync(bak)) fs.copyFileSync(path.join(root, 'data', 'faq_runtime.js'), bak);
    writeFAQRuntime(faq);
    res.applied = true;
    res.backup = bak;
  } else {
    res.applied = false;
  }
  return res;
}

if (require.main === module) {
  const apply = !process.argv.includes('--check');
  const json = process.argv.includes('--json');
  const res = run(apply);
  if (json) { console.log(JSON.stringify(res, null, 2)); }
  else {
    console.log('========== 注入权威事实（知识清单再检索）==========');
    console.log('  ' + (res.applied ? '[APPLY] 已追加写入 faq_runtime.js' : '[CHECK] 仅模拟，未写回（去掉 --check 生效/默认即 APPLY）'));
    console.log('  事实总数: ' + res.factsTotal + '  新增: ' + res.added + '  跳过: ' + res.skipped + '  写后总条数: ' + res.newTotal);
    for (const s of res.skippedDetail) console.log('    跳过: ' + s.q + ' (' + s.why + ')');
    if (res.backup) console.log('  已备份: ' + res.backup);
  }
}
module.exports = { run };
