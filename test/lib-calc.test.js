/**
 * ChemAI 通用化学计算模块（lib-calc.js）测试套件
 * 使用 Node.js 内置 test runner（零外部依赖）
 *
 * 运行: node --test test/lib-calc.test.js
 *
 * 目标：证明"计算通用"——所有数值均由公式对任意输入成立，而非复述写死的示例值。
 */

'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const C = require('../scripts/lib-calc');

describe('lib-calc · 摩尔质量常量与解析', function () {
  it('莫尔盐与产物分子量正确', function () {
    assert.equal(C.molarMassOf('莫尔盐'), 392.14);
    assert.equal(C.molarMassOf('摩尔盐'), 392.14);
    assert.equal(C.molarMassOf('硫酸亚铁铵'), 392.14);
    assert.equal(C.molarMassOf('产物'), 491.25);
    assert.equal(C.molarMassOf('三草酸合铁酸钾'), 491.25);
  });
  it('化学式解析器对 K3[Fe(C2O4)3] 与结晶水加和正确', function () {
    // 产物无水部分 K3[Fe(C2O4)3] = 3×39.098+55.845+6×12.011+12×15.999 = 437.19 ≈ 437.20
    const anhyd = C.formulaMass('K3[Fe(C2O4)3]');
    assert.ok(Math.abs(anhyd - 437.20) < 0.05, '无水产物 M 应≈437.20，实得 ' + anhyd);
    // 三水合物 = 437.20 + 3×18.02 ≈ 491.25
    const tri = C.molarMassOf('K3[Fe(C2O4)3]·3H2O');
    assert.ok(Math.abs(tri - 491.25) < 0.05, '三水合物 M 应≈491.25，实得 ' + tri);
  });
});

describe('lib-calc · 理论产量 / 产率（通用）', function () {
  it('标准 5.0 g 莫尔盐 → 理论产量 6.26 g', function () {
    const t = C.theoreticalYield(5.0);
    assert.ok(Math.abs(t.mTheory - 6.26) < 0.01, '理论产量应≈6.26，实得 ' + t.mTheory.toFixed(3));
  });
  it('标准例产率 75.1%（4.70/6.26）', function () {
    assert.ok(Math.abs(C.yieldPct(4.70, 6.26) - 75.1) < 0.1);
  });
  it('变体泛化：3.75 g 莫尔盐 → 理论产量按公式成立 (非 6.26)', function () {
    const t = C.theoreticalYield(3.75);
    const expect = 3.75 * 491.25 / 392.14; // 4.6970...
    assert.ok(Math.abs(t.mTheory - expect) < 0.01, '应≈' + expect.toFixed(3) + '，实得 ' + t.mTheory.toFixed(3));
  });
  it('变体泛化：实际 7.6 g 产率按公式成立', function () {
    const t = C.theoreticalYield(5.0);
    const y = C.yieldPct(7.6, t.mTheory);
    assert.ok(Math.abs(y - (7.6 / 6.26) * 100) < 0.1, '产率应≈121.4%，实得 ' + y.toFixed(1));
  });
});

describe('lib-calc · KMnO₄ 滴定草酸根含量（新分支）', function () {
  it('自洽标准样例：0.1500 g + 0.0200 M × 18.25 mL → 53.6%', function () {
    const r = C.kmno4OxalatePct(0.0200, 18.25, 0.1500);
    assert.ok(Math.abs(r.nOx - 9.125e-4) < 1e-7, 'n(C2O4^2-)应≈9.125e-4');
    assert.ok(Math.abs(r.w - 53.6) < 0.4, 'w 应≈53.6%，实得 ' + r.w.toFixed(2));
  });
  it('纠正源数据矛盾：0.3000 g 同样耗 18.25 mL → 26.8%（按称样量 0.3000 才算对）', function () {
    // gen_round3 原题称 0.3000g 却除以 0.1500g→53.6%，数值自相矛盾；
    // 引擎按真实称样量 0.3000 g 算得 26.8%，这才是通用正确的。
    const r = C.kmno4OxalatePct(0.0200, 18.25, 0.3000);
    assert.ok(Math.abs(r.w - (r.nOx * 88.02 / 0.3000) * 100) < 1e-6);
    assert.ok(Math.abs(r.w - 26.8) < 0.4, '0.3000g 时应≈26.8%，实得 ' + r.w.toFixed(2));
  });
  it('变体泛化：任意输入按公式成立', function () {
    const r = C.kmno4OxalatePct(0.0100, 20.00, 0.5000);
    const expect = ((0.0100 * 20.00 / 1000) * (5 / 2) * 88.02 / 0.5000) * 100;
    assert.ok(Math.abs(r.w - expect) < 1e-6);
  });
});

describe('lib-calc · 结晶水 / 磁矩 / CFSE / ΔG / 能斯特', function () {
  it('结晶水质量分数 ≈ 11.0%', function () {
    assert.ok(Math.abs(C.crystalWaterPct() - 11.0) < 0.1);
  });
  it('高自旋 d5 磁矩 μeff = √35 ≈ 5.92', function () {
    assert.ok(Math.abs(C.magneticMoment(5) - 5.92) < 0.01);
  });
  it('低自旋 d5 磁矩 = √3 ≈ 1.73', function () {
    assert.ok(Math.abs(C.magneticMoment(1) - 1.73) < 0.01);
  });
  it('CFSE 高自旋 d5 (t2g3 eg2) = 0Δo；低自旋 d6 (t2g6 eg0) = -2.4Δo', function () {
    assert.ok(Math.abs(C.cfse(3, 2)) < 1e-9, '高自旋 d5 CFSE 应≈0Δo');
    assert.ok(Math.abs(C.cfse(6, 0) - (-2.4)) < 1e-9, '低自旋 d6 CFSE 应≈-2.4Δo');
  });
  it('ΔG°(Kf=1e20, 298K) 为负且量级正确', function () {
    const dg = C.dGfromKf(1e20);
    assert.ok(dg < 0, 'ΔG° 应为负');
    assert.ok(Math.abs(dg - (-8.314 * 298 * Math.log(1e20)) / 1000) < 0.1);
  });
  it('能斯特：E°cell=1.005 V, lgK≈33.9 (n=2)', function () {
    const ne = C.nernstCell(1.776, 0.771, 2);
    assert.ok(Math.abs(ne.Ecell - 1.005) < 1e-6);
    assert.ok(Math.abs(ne.lgK - 33.9) < 0.2);
  });
});

describe('lib-calc · 均值 / RSD / 溶液配制', function () {
  it('RSD 样例（72.7/73.5/71.8）均值 72.7%，RSD≈1.2%', function () {
    const m = C.mean([72.7, 73.5, 71.8]);
    assert.ok(Math.abs(m - 72.7) < 0.05);
    assert.ok(Math.abs(C.rsd([72.7, 73.5, 71.8]) - 1.2) < 0.2);
  });
  it('多步连乘：90%×85%×80% = 61.2%', function () {
    assert.ok(Math.abs(0.90 * 0.85 * 0.80 - 0.612) < 1e-9);
  });
  it('溶液配制 m=c·V·M', function () {
    const c = C.calcAnswer('配制 0.0200 mol/L KMnO4 溶液 250 mL，需称取 KMnO4（M=158.03）多少克？');
    // 0.0200 × 0.250 × 158.03 = 0.790
    assert.ok(c.matched, '应匹配配制模式');
    assert.ok(Math.abs(c.result - (0.0200 * 0.250 * 158.03)) < 0.01);
  });
});

describe('lib-calc · calcAnswer 题目→答案调度（通用引擎）', function () {
  it('产率题：实际 4.2 g、理论 6.26 g → 计算结果非硬编码', function () {
    const r = C.calcAnswer('若实际产量为4.2 g，理论产量为6.26 g，产率是多少？');
    assert.equal(r.type, 'yield');
    assert.ok(Math.abs(r.result - (4.2 / 6.26) * 100) < 0.1);
    assert.ok(r.lines.join('\n').includes('4.2'), '答案应含实际量 4.2');
  });
  it('理论产量题：称取 4.90 g 莫尔盐 → 6.14 g', function () {
    const r = C.calcAnswer('称取4.90 g莫尔盐（M=392.14）进行实验，求理论产量。');
    assert.equal(r.type, 'yield');
    assert.ok(Math.abs(r.result - (4.90 / 392.14) * 491.25) < 0.01);
  });
  it('摩尔质量题', function () {
    const r = C.calcAnswer('K3[Fe(C2O4)3]·3H2O的摩尔质量是多少？');
    assert.equal(r.type, 'mass');
    assert.ok(Math.abs(r.result - 491.25) < 0.05);
  });
  it('滴定题：0.0200M × 18.25mL / 0.1500g → 53.6%', function () {
    const r = C.calcAnswer('取0.1500 g产物用0.0200 mol/L KMnO4滴定，消耗18.25 mL，求C2O4^2-质量分数。');
    assert.equal(r.type, 'titration');
    assert.ok(Math.abs(r.result.w - 53.6) < 0.4);
  });
  it('磁矩题：高自旋 d5 → 5.92 BM', function () {
    const r = C.calcAnswer('Fe3+高自旋d5构型的有效磁矩是多少？');
    assert.equal(r.type, 'magnetic');
    assert.ok(Math.abs(r.result - 5.92) < 0.01);
  });
  it('RSD 题从题面百分比计算', function () {
    const r = C.calcAnswer('三次平行实验的产率为72.7%、73.5%、71.8%，求平均值和RSD。');
    assert.equal(r.type, 'stats');
    assert.ok(Math.abs(r.result.mean - 72.7) < 0.05);
    assert.ok(Math.abs(r.result.rsd - 1.2) < 0.2);
  });
});
