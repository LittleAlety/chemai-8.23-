'use strict';
/**
 * ChemAI 外层大循环编排器 —— "大循环里套小循环"
 *
 * 每轮外循环 = 一次完整迭代：
 *   ① 小循环：自训练 3×100（`self_train_loop.js`，每轮 100 道不重样题 → LLM 判别 → 富化 FAQ）
 *   ② 校验：`verify_web_ready.js`（运行时 FAQ 能否在网页上实现：可解析/结构健康/无乱码/无头冒烟）
 *   ③ 清理：若可实现在网页且发现乱码 → `clean_garbled.js --apply` 清理 BOM/U+FFFD/控制字符
 *   ④ 复查：清理后再次 `verify_web_ready.js` 确认
 *   ⑤ 记录一轮报告 → OUTER_CYCLES 次后结束（"以此类推"）
 *
 * 用法：
 *   node 训练管道/outer_loop.js             # 默认 1 轮外循环
 *   $env:OUTER_CYCLES=3; node 训练管道/outer_loop.js
 * 注意：当前若无独立在跑的内层，请直接运行本文件；它会逐轮 spawn 内层，避免并发写 faq_runtime.js。
 */
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const node = process.execPath;

const OUTER_CYCLES = Number(process.env.OUTER_CYCLES || 1);

function run(cmd, args, env = {}) {
  const r = spawnSync(node, [path.join(root, cmd), ...args], { cwd: root, env: Object.assign({}, process.env, env), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

(async () => {
  console.log('========== ChemAI 外层大循环 ==========');
  console.log('OUTER_CYCLES=' + OUTER_CYCLES);
  for (let cyc = 1; cyc <= OUTER_CYCLES; cyc++) {
    console.log('\n══════════ 外循环 Cycle ' + cyc + ' / ' + OUTER_CYCLES + ' ══════════');
    // ① 小循环：自训练 3×100
    console.log('[① 内层小循环] 自训练 3×100 开始…');
    const inner = run('训练管道/self_train_loop.js', []);
    console.log('[①] 自训练结束 code=' + inner.code + '（日志见 Agent工作区/Agent-B-问题生成/ 各轮 .log）');
    // 提取内层各轮摘要
    const innerLines = inner.out.split('\n').filter(l => /Pass .* 后|全部完成|运行时 FAQ:/.test(l));
    innerLines.forEach(l => console.log('    ' + l.trim()));

    // ② 校验网页可实现性
    console.log('[② 校验] 运行时 FAQ 能否在网页实现…');
    const v1 = run('训练管道/verify_web_ready.js', ['--json']);
    let chk = null;
    try { const j = JSON.parse(v1.out); chk = j; } catch (e) {}
    console.log('    [校验] 解析=' + (chk && chk.checks.parses.ok) + ' 结构=' + (chk && chk.checks.structure.ok) + ' 乱码=' + (chk && chk.checks.garbled.ok) + ' 冒烟=' + (chk && chk.checks.smoke && chk.checks.smoke.ok) + ' → ' + (chk && chk.ok ? '✅ 可实现' : '❌ 未达标'));
    console.log('    [校验] 乱码计数=' + ((chk && chk.checks.garbled) ? (chk.checks.garbled.totalBad + ' (FFFD=' + chk.checks.garbled.fffd + ' 控制符=' + chk.checks.garbled.control + ')') : 'n/a'));

    // ③ 若可实现且有乱码 → 清理
    if (chk && chk.ok) {
      if (chk.checks.garbled && chk.checks.garbled.totalBad > 0) {
        console.log('[③ 清理乱码] 发现 ' + chk.checks.garbled.totalBad + ' 处，开始清理…');
        const c = run('训练管道/clean_garbled.js', ['--apply']);
        console.log('    ' + c.out.split('\n').filter(Boolean).join('\n    '));
      } else {
        console.log('[③ 清理乱码] 无乱码，跳过。');
      }
      // ④ 复查
      console.log('[④ 复查] 清理后再次校验…');
      const v2 = run('训练管道/verify_web_ready.js', ['--json']);
      let chk2 = null; try { chk2 = JSON.parse(v2.out); } catch (e) {}
      console.log('    [复查] → ' + (chk2 && chk2.ok ? '✅ 仍可实现' : '❌ 复查未达标'));
    } else {
      console.log('[③ ④ 跳过清理/复查] 校验未达标，不清理，人工诊断。');
    }
    console.log('════ Cycle ' + cyc + ' 完成 ════');
  }
  console.log('\n========== 外层大循环全部结束 ==========');
})();
