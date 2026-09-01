'use strict';
/**
 * ChemAI FAQ 自训练 3×100 驱动（"每轮题目不重样"）
 *
 * 背景：self_train.js 的 ROUNDS 是在【同一组固定题】上迭代（round1 出题→复用），
 * 且 round 产物（self_train_*_r1.json）跨运行残留复用 → 会读到上一轮的陈旧评分/优化清单。
 * 本驱动把"每轮 100 道不同题"实现为：每轮独立跑一次 `node self_train.js (N=100 ROUNDS=1)`，
 * 并在每轮前清掉除 SEEN_FILE 外的全部 self_train_* 产物（强制重新出题、避免陈旧复用），
 * 用 N=100/101/102 打开不同题集文件。跨轮题目不重样由 SEEN_FILE 软去重保证。
 *
 * 用法：
 *   node 训练管道/self_train_loop.js            # 默认 3 轮 × 100 题
 *   $env:PASSES=2; node 训练管道/self_train_loop.js
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const W = p => path.join(root, p);
const exists = p => fs.existsSync(W(p));
const FAQLIB = require(path.join(root, 'scripts', 'lib-assistant-faq.js'));

const PASSES = Number(process.env.PASSES || 3);
const N_PER_PASS = Number(process.env.N_PER_PASS || 100);
const KEEP = new Set(['self_train_seen_questions.json']);

// self_train 会写入的 Agent 工作区子目录
const DIRS = [
  'Agent工作区/Agent-B-问题生成',
  'Agent工作区/Agent-C-答案评分',
  'Agent工作区/Agent-优化',
  'Agent工作区/Agent-报告',
];

function cleanArtifacts() {
  let removed = 0;
  for (const d of DIRS) {
    const dir = W(d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('self_train_loop_pass')) continue;   // 保留本驱动的轮次日志
      if (f.startsWith('self_train_') && !KEEP.has(f)) {
        try { fs.unlinkSync(path.join(dir, f)); removed++; } catch (e) {}
      }
    }
  }
  return removed;
}

function runPass(passNum) {
  const N = N_PER_PASS + passNum - 1;   // 100 / 101 / 102 → 不同题集文件
  console.log('\n============ 自训练 Pass ' + passNum + ' / ' + PASSES + '  (N=' + N + ') ============');
  console.log('[清理] 本轮前清掉 ' + cleanArtifacts() + ' 个历史 self_train 产物（保留 SEEN_FILE）');
  const env = Object.assign({}, process.env, { N: String(N), ROUNDS: '1' });
  const r = spawnSync(process.execPath, [path.join(__dirname, 'self_train.js')], {
    cwd: root, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  // 提取最终报告 JSON（日志末尾以 JSON 对象结束，无终止标记）
  let report = null;
  const midx = out.indexOf('========== 最终报告 ==========');
  if (midx >= 0) {
    const s = out.indexOf('{', midx), e = out.lastIndexOf('}');
    if (s >= 0 && e > s) { try { report = JSON.parse(out.slice(s, e + 1)); } catch (err) {} }
  }
  const logFile = W('Agent工作区/Agent-报告/self_train_loop_pass' + passNum + '.log');
  fs.writeFileSync(logFile, out, 'utf8');
  const firstRound = report && report.rounds && report.rounds[0];
  console.log('[Pass ' + passNum + '] ' + (firstRound
    ? ('avg=' + firstRound.avgScore + ' min=' + firstRound.minScore + ' 低分(<9.5)=' + firstRound.lowCount + '/' + firstRound.n +
       ' gate=' + firstRound.gatePassed + ' 注入=' + JSON.stringify(firstRound.opt))
    : '报告解析失败'));
  console.log('[Pass ' + passNum + '] 完整日志 → Agent工作区/Agent-报告/self_train_loop_pass' + passNum + '.log');
  return { pass: passNum, N, report, out };
}

(async () => {
  console.log('========== ChemAI 自训练 3×100 驱动 ==========');
  console.log('PASSES=' + PASSES + ' N_PER_PASS=' + N_PER_PASS + ' MODEL=deepseek-v4-flash');
  const faqBefore = FAQLIB.readFAQRuntime().length;
  console.log('启动前运行时 FAQ: ' + faqBefore + ' 条');
  const results = [];
  for (let p = 1; p <= PASSES; p++) {
    const res = runPass(p);
    results.push(res);
    // 每轮后看 FAQ 数
    const faqNow = FAQLIB.readFAQRuntime().length;
    console.log('[Pass ' + p + ' 后] 运行时 FAQ: ' + faqNow + ' 条（净增 ' + (faqNow - faqBefore) + '）');
  }
  const faqAfter = FAQLIB.readFAQRuntime().length;
  console.log('\n========== 全部完成 ==========');
  console.log('PASSES=' + PASSES + ' 各轮:');
  for (const r of results) {
    const fr = r.report && r.report.rounds && r.report.rounds[0];
    if (fr) console.log('  Pass ' + r.pass + ': avg=' + fr.avgScore + ' min=' + fr.minScore + ' 低分=' + fr.lowCount + '/' + fr.n + ' gate=' + fr.gatePassed + ' 注入=' + JSON.stringify(fr.opt));
    else console.log('  Pass ' + r.pass + ': 无报告');
  }
  console.log('运行时 FAQ: ' + faqBefore + ' → ' + faqAfter + '（净增 ' + (faqAfter - faqBefore) + '）');
})();
