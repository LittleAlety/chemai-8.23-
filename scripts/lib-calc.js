'use strict';
/**
 * lib-calc.js — ChemAI 通用化学计算模块（单一真相源）
 *
 * 汇集原分散在 assets/agent-cluster.js（calcSkill）与训练管道/evaluate.js（qaCalc）的
 * 通用定量计算能力，统一为一套纯函数，供浏览器（<script> 挂 window.ChemCalc）与
 * node（require）共同引用，消除摩尔质量常量多份重复与逻辑漂移。
 *
 * 计算通用：所有数值均由公式对任意输入成立，不依赖 FAQ 里写死的示例值。
 * 权威基准：以实验讲义为准（6% H₂O₂=8 mL；莫尔盐 M=392.14；产物 K₃[Fe(C₂O₄)₃]·3H₂O M=491.25）。
 */

/* ================= 原子量表（来源 agent-cluster.js:453） ================= */
var ATOMIC_MASS = {
  H:1.008,He:4.003,Li:6.94,Be:9.012,B:10.81,C:12.011,N:14.007,O:15.999,F:18.998,Ne:20.18,
  Na:22.99,Mg:24.305,Al:26.982,Si:28.085,P:30.974,S:32.06,Cl:35.45,K:39.098,Ca:40.078,
  Sc:44.956,Ti:47.867,V:50.942,Cr:51.996,Mn:54.938,Fe:55.845,Co:58.933,Ni:58.693,Cu:63.546,
  Zn:65.38,Ga:69.723,As:74.922,Se:78.96,Br:79.904,Sr:87.62,Y:88.906,Zr:91.224,Mo:95.95,
  Ag:107.868,Cd:112.414,In:114.818,Sn:118.71,Sb:121.76,Te:127.6,I:126.904,Ba:137.327,
  La:138.905,Ce:140.116,W:183.84,Pt:195.084,Au:196.967,Hg:200.592,Pb:207.2,Bi:208.98,Th:232.038,U:238.029
};

/* ================= 已知化合物摩尔质量（合并 agent-cluster:454-463 与 evaluate:66-68） ================= */
var KNOWN_MASS = {
  // 莫尔盐（限量试剂 / 产率基准）
  '(NH4)2Fe(SO4)2·6H2O':392.14,'硫酸亚铁铵':392.14,'莫尔盐':392.14,'摩尔盐':392.14,
  // 草酸（实验中为二水合物 H2C2O4·2H2O，1.7 g）
  'H2C2O4·2H2O':126.07,'草酸二水合物':126.07,'草酸':126.07,'h2c2o4':126.07,
  'H2C2O4':90.03,'无水草酸':90.03,
  // 草酸亚铁
  'FeC2O4·2H2O':179.90,'草酸亚铁(二水)':179.90,'FeC2O4':143.87,'草酸亚铁':143.87,'fec2o4':143.87,
  // 草酸钾（一水合物，3.5 g）
  'K2C2O4·H2O':184.24,'草酸钾一水合物':184.24,'草酸钾':184.24,'K2C2O4':166.22,'k2c2o4':184.24,
  // 产物
  'K3[Fe(C2O4)3]·3H2O':491.25,'三草酸合铁酸钾':491.25,'产物':491.25,'产品':491.25,
  'K3[Fe(C2O4)3]':437.20,
  // 其它常用
  'H2O2':34.01,'过氧化氢':34.01,'H2O':18.02,'水':18.02,'CO2':44.01,'CO':28.01,
  'C2H5OH':46.07,'乙醇':46.07,'H2SO4':98.08,'Fe2O3':159.69,'K2CO3':138.21,
  'Fe(OH)3':106.87,'FeSO4':151.91,'KMnO4':158.03,'K3[Fe(CN)6]':329.24,'(NH4)2SO4':132.14,
  // 离子（滴定/含量计算用）
  'C2O4^2-':88.02,'c2o4^2-':88.02,'c2o4':88.02,'草酸根':88.02,'Fe^3+':55.845,'Fe^2+':55.845,
  'Fe3+':55.845,'Fe2+':55.845
};

/* ================= 结构化投料常量（让"标准 5.0g→6.26g"由代码算出） ================= */
var RECIPE = {
  mohr:      5.0,   // g  莫尔盐 (NH4)2Fe(SO4)2·6H2O（限量试剂 / 产率基准）
  oxalic:    1.7,   // g  草酸二水合物 H2C2O4·2H2O（第一步沉淀剂）
  k2c2o4:    3.5,   // g  草酸钾一水合物 K2C2O4·H2O（第二步配体/K+ 源）
  h2o2_ml:   8,     // mL 6% H2O2（步骤②氧化剂，权威值 8 mL）
  h2o2_pct:  6,     // %  H2O2 质量分数（非 30%）
  ethanol:   10,    // mL 95% 乙醇（步骤⑤结晶）
  mohr_M:    392.14,
  prod_M:    491.25,
  oxalate_ion_M: 88.02,
  crystal_water_M: 18.02,
  n_crystal_water: 3
};

/* ================= 归一化（供 molarMassOf 匹配用；来源 agent-cluster norm） ================= */
var SUBMAP = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','⁻':'-','⁺':'+','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};
function norm(s) {
  return String(s || '').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]/g, function(c){ return SUBMAP[c] || c; })
    .replace(/·/g, '.').replace(/\s+/g, '');
}

/* ================= 化学式→摩尔质量 解析器（分组栈，支持括号/方括号/多层倍数） =================
 * 修正原 agent-cluster:464-484 的 bug：原实现在 `)` 时才把倍率作用到父级，
 * 导致内层原子未乘上封闭括号的系数（如 K3[Fe(C2O4)3] 算成 261 而非 437）。
 * 此实现用分组栈：每层括号内的质量先累加，关闭时乘以系数再加到父层。
 * 说明：纯化学式（无前置水合系数）精确；水合物（如 ·6H2O）建议用 KNOWN_MASS 或解析为 (H2O)n。
 */
function formulaMass(f) {
  var s = String(f || '').replace(/\s+/g, '').replace(/·/g, '.').replace(/[+\-]+\d*[+\-]?$/, '');
  var i = 0, n = s.length, stack = [0];
  function digits(k) { var j = k; while (j < n && s[j] >= '0' && s[j] <= '9') j++; return j; }
  while (i < n) {
    var c = s[i];
    if (c === '(' || c === '[') { stack.push(0); i++; }
    else if (c === ')' || c === ']') {
      var e = digits(i + 1); var num = (e > i + 1) ? parseFloat(s.slice(i + 1, e)) : 1;
      var g = stack.pop() || 0;
      stack[stack.length - 1] += g * num;
      i = e;
    }
    else if (c >= 'A' && c <= 'Z') {
      var el = c, j = i + 1;
      if (j < n && s[j] >= 'a' && s[j] <= 'z') { el += s[j]; j++; }
      var e2 = digits(j); var cnt = (e2 > j) ? parseFloat(s.slice(j, e2)) : 1;
      var m = ATOMIC_MASS[el]; if (m) stack[stack.length - 1] += m * cnt;
      i = e2;
    } else { i++; }
  }
  return stack[0];
}

/* ================= 摩尔质量查询（来源 agent-cluster molarMassOf:485-493） ================= */
function molarMassOf(term) {
  var key = norm(term);
  if (KNOWN_MASS[term]) return KNOWN_MASS[term];
  for (var k in KNOWN_MASS) if (norm(k) === key) return KNOWN_MASS[k];
  var fm = String(term || '').match(/[A-Z][a-z]?[\d\.·\[\]\(\)A-Za-z]*/);
  if (fm) { var m = formulaMass(fm[0]); if (m > 10) return m; }
  return null;
}

/* ================= 通用定量计算（纯函数，全部对任意输入成立） ================= */

// 理论产量：Fe 守恒，1 mol 莫尔盐 → 1 mol 产物
function theoreticalYield(mMohr, M_mohr, M_prod) {
  M_mohr = M_mohr || RECIPE.mohr_M;
  M_prod = M_prod || RECIPE.prod_M;
  var n = mMohr / M_mohr;
  return { n: n, mTheory: n * M_prod };
}

// 产率：实际/理论 ×100%
function yieldPct(mActual, mTheory) {
  return mActual / mTheory * 100;
}

// 结晶水质量分数：nW × M_H2O / M_prod ×100%
function crystalWaterPct(nW, M_prod) {
  nW = (nW == null) ? RECIPE.n_crystal_water : nW;
  M_prod = M_prod || RECIPE.prod_M;
  return nW * RECIPE.crystal_water_M / M_prod * 100;
}

// 仅自旋磁矩：μeff = √[n(n+2)]
function magneticMoment(nUnpaired) {
  return Math.sqrt(nUnpaired * (nUnpaired + 2));
}

// CFSE：(-0.4×t2g + 0.6×eg) Δo
function cfse(t2g, eg) {
  return (-0.4 * t2g + 0.6 * eg);
}

// ΔG° = -RT lnKf（kJ/mol, T=298K）
function dGfromKf(kf, T) {
  T = T || 298;
  return -8.314 * T * Math.log(kf) / 1000;
}

// KMnO4 滴定 C2O4^2- 含量：n(MnO4)=c×V/1000；n(C2O4^2-)=n(MnO4)×5/2；w=n×M(草酸根)/m_sample×100%
function kmno4OxalatePct(c, V_mL, mSample) {
  var nMnO4 = c * V_mL / 1000;
  var nOx = nMnO4 * 5 / 2;
  var mOx = nOx * RECIPE.oxalate_ion_M;
  var w = mOx / mSample * 100;
  return { nMnO4: nMnO4, nOx: nOx, mOx: mOx, w: w };
}

// 平均值
function mean(vals) {
  if (!vals || !vals.length) return NaN;
  var s = 0; for (var i = 0; i < vals.length; i++) s += vals[i];
  return s / vals.length;
}

// 相对标准偏差 RSD = s/mean×100%
function rsd(vals) {
  if (!vals || vals.length < 2) return NaN;
  var m = mean(vals);
  var s = 0; for (var i = 0; i < vals.length; i++) s += (vals[i] - m) * (vals[i] - m);
  var sd = Math.sqrt(s / (vals.length - 1));
  return sd / m * 100;
}

// Nernst 电池电动势 / lgK
function nernstCell(Epos, Eneg, n) {
  var E = Epos - Eneg;
  return { Ecell: E, lgK: n * E / 0.0592, K: Math.pow(10, n * E / 0.0592) };
}

/* ================= 通用数据类（供 calcAnswer 各分支复用，全部纯函数） ================= */

// 组分质量分数（按分子式）：w = count × M(组分) / M(化合物) ×100%
function componentMassFrac(compoundM, componentM, count) {
  return count * componentM / compoundM * 100;
}
// 由"样品质量 + 组分质量"求质量分数：w = m(组分)/m(样品)×100%
function massFracFromMasses(mComponent, mSample) {
  return mComponent / mSample * 100;
}
// 纯度：w = 实测(组分) / 理论(组分) ×100%
function purity(wMeasured, wTheory) {
  return wMeasured / wTheory * 100;
}
// 相对误差：|测量-真实|/真实×100%；感量法：绝对误差/称样量×100%
function relErr(mMeasured, mTrue) {
  return Math.abs(mMeasured - mTrue) / mTrue * 100;
}
function relErrFromAbs(absErr, mSample) {
  return absErr / mSample * 100;
}
// 多步总产率：逐连乘（百分比），返回百分比；可与理论产量组合求实际
function totalYieldPct(pcts) {
  if (!pcts || !pcts.length) return NaN;
  var p = 1; for (var i = 0; i < pcts.length; i++) p *= pcts[i] / 100;
  return p * 100;
}
// 结晶水质量：mWater = m样品 × wPct/100；无水产物质量 = m样品 - mWater
function waterMass(mSample, wPct) { return mSample * wPct / 100; }
function anhydrousMass(mSample, wPct) { return mSample - mSample * wPct / 100; }
// 反向产率：由目标产物质量反推所需莫尔盐质量（Fe 守恒）
function reverseYieldMohr(mTarget, yieldPct100, M_prod, M_mohr) {
  M_prod = M_prod || RECIPE.prod_M;
  M_mohr = M_mohr || RECIPE.mohr_M;
  return mTarget / (yieldPct100 / 100) * (M_mohr / M_prod);
}
// KMnO4 滴定 Fe2+：n(Fe2+)=5×n(MnO4)；m(Fe)=n×M(Fe)
function kmno4Fe(c, V_mL) {
  var nMnO4 = c * V_mL / 1000;
  var nFe = nMnO4 * 5;
  var mFe = nFe * ATOMIC_MASS.Fe;
  return { nMnO4: nMnO4, nFe: nFe, mFe: mFe };
}
// 分布系数（二元弱酸，pH 下 C2O4^2- 的 α₂）：α₂ = Ka1Ka2 / ([H]²+Ka1[H]+Ka1Ka2)
function oxalateAlpha2(pH, pKa1, pKa2) {
  var H = Math.pow(10, -pH);
  var Ka1 = Math.pow(10, -pKa1), Ka2 = Math.pow(10, -pKa2);
  return Ka1 * Ka2 / (H * H + Ka1 * H + Ka1 * Ka2);
}
// 已知 Kf 与游离配体浓度求游离金属离子：M_free = [ML] / (Kf·[L]^n)
function freeMetal(ML, Kf, L, nLigand) {
  return ML / (Kf * Math.pow(L, nLigand || 3));
}
// 提取科学计数法数值（含上标：1.200×10⁻³ → 1.2e-3；1.0×10²⁰ → 1e20）
var SUPMAP = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};
function extractSci(t) {
  var out = [], s = String(t || '');
  var re = /(\d+(?:\.\d+)?)\s*[×x*]\s*10([⁻⁺−\-]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+|\d+)/g, m;
  while ((m = re.exec(s)) !== null) {
    var mant = parseFloat(m[1]);
    var es = m[2], sign = 1, digits = '';
    for (var i = 0; i < es.length; i++) {
      var ch = es[i];
      if (ch === '⁻' || ch === '−' || ch === '-') { if (digits === '') sign = -1; }
      else if (SUPMAP[ch]) digits += SUPMAP[ch];
      else if (ch >= '0' && ch <= '9') digits += ch;
    }
    out.push(mant * Math.pow(10, sign * parseInt(digits || '0', 10)));
  }
  return out;
}

/* ================= 从题面提取带单位数值 ================= */
function extractNums(q) {
  var out = [];
  var re = /(\d+(?:\.\d+)?)\s*(g|克|mg|毫升|ml|mol\/l|m|mol|%)?/gi, m;
  while ((m = re.exec(String(q || ''))) !== null) {
    out.push({ v: parseFloat(m[1]), u: (m[2] || '').toLowerCase() });
  }
  return out;
}

/* ================= 题目→计算答案 调度器（通用，供 local_answer / 浏览器调用） ================= */
function calcAnswer(q) {
  var t = String(q || '');
  var res = { matched: false, type: '', title: '', lines: [], formula: '', note: '', result: null };

  // 排序/操作顺序题交 FAQ，不做计算（避免把"排列顺序"误当作配比代算）
  if (/排列.*顺序|排序|操作顺序|先后顺序|顺序排列|请排列/.test(t)) return res;

  // ⓪ 统计（平均/RSD/精密度）——优先，避免被"产率"分支误判
  if (/平均产率|平均值|均值|相对标准偏差|rsd|精密度|标准偏差/i.test(t)) {
    // 若给出"均值 X% + 标准偏差 s=Y%"，则 RSD = s/均值×100%（Q042/Q090 等）
    var mAvgPct = t.match(/(?:平均|均值)[^0-9]{0,6}(\d+(?:\.\d+)?)\s*%/);
    var mSdPct = t.match(/s\s*=\s*(\d+(?:\.\d+)?)\s*%/) || t.match(/标准偏差[s]?\s*=?\s*(\d+(?:\.\d+)?)\s*%/);
    if (mAvgPct && mSdPct) {
      var av = +mAvgPct[1], sd = +mSdPct[1];
      var rd = sd / av * 100;
      var good = rd < 2;
      res.matched = true; res.type = 'stats'; res.title = '🧮 平均 / RSD';
      res.formula = 'RSD = s/均值×100%';
      res.result = { mean: av, rsd: rd, good: good };
      res.lines.push('RSD = ' + sd + '% ÷ ' + av + '% × 100% = ' + rd.toFixed(2) + '%');
      res.lines.push(rd < 2 ? 'RSD<2%，精密度良好。' : 'RSD≥2%，精密度欠佳。');
      return res;
    }
    var pctsS = (t.match(/(\d+(?:\.\d+)?)\s*%/g) || []).map(function(x){ return parseFloat(x); });
    // 无 % 上标的场合（如"5 次产率数据（62.3、61.8、…）"），从括号内取纯数字
    if (pctsS.length < 3) {
      var par = t.match(/[（(]([^）)]*)[）)]/);
      if (par) {
        var plain = par[1].match(/\d+(?:\.\d+)?/g);
        if (plain && plain.length >= 3) pctsS = plain.map(function(x){ return parseFloat(x); });
      }
    }
    // 仍不足：题目以"…、…"逗号分隔、无括号无%，取全文一串数据点，并剔掉开头表示"次数"的小整数
    if (pctsS.length < 3) {
      var all = (t.match(/\d+(?:\.\d+)?/g) || []).map(function(x){ return parseFloat(x); });
      if (all.length >= 3) {
        var firstPos = t.search(/\d+(?:\.\d+)?/);
        var afterFirst = t.slice(firstPos).replace(/^\d+(?:\.\d+)?/, '');
        if (all[0] <= 10 && /^[^0-9]{0,6}(次|组|回|份|个|平行|平行测定)/.test(afterFirst)) all.shift();
        if (all.length >= 3) pctsS = all;
      }
    }
    if (pctsS.length >= 2) {
      res.matched = true; res.type = 'stats'; res.title = '🧮 平均 / RSD';
      var mAvg = mean(pctsS); var rr = rsd(pctsS);
      res.formula = '均值=Σx/n；RSD = s/均值×100%';
      res.result = { mean: mAvg, rsd: rr, good: rr < 2 };
      res.lines.push('均值 = (' + pctsS.join('+') + ')/' + pctsS.length + ' = ' + mAvg.toFixed(1) + '%');
      res.lines.push('RSD = ' + rr.toFixed(1) + '%（' + (rr < 2 ? '<2% 表明精密度良好' : '≥2% 精密度欠佳') + '）。');
      return res;
    }
  }

  // ⓪b 多步总产率（每步产率连乘）：可再结合理论产量求实际可得（Q051-Q054）
  if (/总产率|三步|每步.*产率|产率.*分别|依次.*产率|连乘/.test(t) && (t.match(/\d+(?:\.\d+)?\s*%/g) || []).length >= 2) {
    var steps = (t.match(/(\d+(?:\.\d+)?)\s*%/g) || []).map(function(x){ return parseFloat(x); });
    var tot = totalYieldPct(steps);
    res.matched = true; res.type = 'totalyield'; res.title = '🧮 多步总产率'; res.result = tot;
    res.formula = '总产率 = Π(每步产率)';
    res.lines.push('总产率 = ' + steps.map(function(x){ return x + '%'; }).join('×') + ' = ' + tot.toFixed(1) + '%');
    // 若给出理论产量 → 实际可得产物质量 = 总产率 × 理论产量
    var thM = t.match(/理论产量[为是约等于=\s：:]{0,4}(\d+(?:\.\d+)?)/);
    if (thM) {
      var actM = tot / 100 * parseFloat(thM[1]);
      res.lines.push('实际可得产物 = ' + tot.toFixed(1) + '% × ' + thM[1] + ' g = ' + actM.toFixed(2) + ' g');
      res.result = { total: tot, actual: actM };
    }
    return res;
  }

  // ⓪c 反向产率（Q058：预期产率 Y%，得 m g 产物 → 需称取莫尔盐）
  if (/需称取\s*(?:的)?\s*莫尔盐|要得到.*需称取|预期产率.*称取|反推.*莫尔盐/.test(t)) {
    var expP = (t.match(/产率为?[^0-9]{0,4}(\d+(?:\.\d+)?)\s*%/) || [])[1];
    var tgtM = (t.match(/(\d+(?:\.\d+)?)\s*g\s*K?3?\[?Fe|要[得到制]到?\s*(\d+(?:\.\d+)?)\s*g/) || [])[2] || (t.match(/(\d+(?:\.\d+)?)\s*g\s*产物/) || [])[1];
    if (expP && tgtM) {
      var vR = reverseYieldMohr(parseFloat(tgtM), parseFloat(expP));
      res.matched = true; res.type = 'revyield'; res.title = '🧮 反向产率（求投料量）'; res.result = vR;
      res.formula = 'm(莫尔盐) = m(产物) ÷ (产率% × 491.25/392.14)';
      res.lines.push('m(莫尔盐) = ' + tgtM + ' ÷ (' + expP + '% × ' + (RECIPE.prod_M / RECIPE.mohr_M).toFixed(4) + ') ≈ ' + vR.toFixed(2) + ' g');
      return res;
    }
  }

  // ① 产率 / 理论产量（触发词收紧，避免误捕"配制/称取多少克""摩尔质量M="）
  // 额外覆盖"称取X g莫尔盐，求理论产物/理论可得多少克产物"这类按 Fe 守恒求理论产物质量的问法。
  // 注意：不可用笼统的 "产物.*质量" 作触发词，否则会把滴定"求产物中草酸根质量分数"误夺。
  if (/产率|收率|百分产率|理论产量|理论产物|理论可得|可制得|能生成|能制得|多少克产物|多少克产品|实际产量/.test(t)) {
    res.matched = true; res.type = 'yield'; res.title = '🧮 产率 / 理论产量';
    var gvals = ((t.match(/(\d+(?:\.\d+)?)\s*(g|克)/g) || []).map(function(x){ return parseFloat(x); }));
    var salt = (t.match(/(\d+(?:\.\d+)?)\s*g\s*(莫尔盐|摩尔盐|硫酸亚铁铵)/) || [])[1];
    // 显式"理论产量为X" 与 "实际产量为X"
    var theoryEx = (t.match(/理论(?:产量|产物|可得)?[^0-9]{0,5}(\d+(?:\.\d+)?)/) || [])[1];
    var actualEx = (t.match(/(?:实际|实得|得到|获得|制得|回收)[^0-9]{0,3}(\d+(?:\.\d+)?)/) || [])[1];
    var theory = theoryEx ? parseFloat(theoryEx) : (salt ? theoreticalYield(parseFloat(salt)).mTheory : null);
    var actual = actualEx ? parseFloat(actualEx) : null;
    if (theory == null && /称取|莫尔盐|摩尔盐|硫酸亚铁铵/.test(t) && gvals.length) theory = theoreticalYield(gvals[0]).mTheory;
    if (actual && theory) {
      var y = yieldPct(actual, theory);
      res.result = y;
      res.formula = '产率(%) = 实际产量 ÷ 理论产量 × 100%';
      res.lines.push('产率 = ' + actual.toFixed(2) + ' ÷ ' + theory.toFixed(2) + ' × 100% = ' + y.toFixed(1) + '%');
    } else if (theory) {
      res.result = theory;
      res.formula = '理论产量 = m(莫尔盐) × 491.25/392.14';
      var mS = salt ? parseFloat(salt) : ((gvals.length && /莫尔盐|摩尔盐|硫酸亚铁铵|称取|实际/.test(t)) ? gvals[0] : RECIPE.mohr);
      res.lines.push('n(莫尔盐) = ' + mS.toFixed(2) + ' ÷ 392.14 = ' + theoreticalYield(mS).n.toFixed(5) + ' mol');
      res.lines.push('理论产量 = ' + theory.toFixed(2) + ' g');
    } else {
      res.lines.push('以莫尔盐（限量试剂）为基准：1 mol 莫尔盐 → 1 mol 产物。');
      res.lines.push('理论产量 = m(莫尔盐) × 491.25/392.14；产率 = 实际产量/理论产量 × 100%。');
      res.note = '标准例：5.0 g 莫尔盐 → 理论 6.26 g。';
    }
    return res;
  }

  // ② 摩尔质量（仅当题目在"求 M"时触发；用 norm 归一化下标，兼容 K₃[Fe(C₂O₄)₃]·3H₂O 写法）
  if (/摩尔质量|分子量|相对分子质量|g\/mol|g\s*\/\s*mol/i.test(t) || /M\s*[\(（]/.test(t)) {
    var known = null, kname = '';
    var nt = norm(t);
    // 优先：无水/无结晶水产物 → 437.20
    if (/无水\s*K?3?\[?Fe|无水.*三草酸|无水.*产物/i.test(nt) && !/·?\s*3\s*H2O/.test(nt)) { known = molarMassOf('K3[Fe(C2O4)3]'); kname = '无水K3[Fe(C2O4)3]'; }
    var cands = ['三草酸合铁酸钾','K3[Fe(C2O4)3]·3H2O','莫尔盐','(NH4)2Fe(SO4)2·6H2O','硫酸亚铁铵','草酸亚铁二水合物','FeC2O4·2H2O','草酸亚铁','FeC2O4','草酸二水合物','H2C2O4·2H2O','草酸钾一水合物','K2C2O4·H2O','草酸钾','K2C2O4','H2C2O4','无水草酸','草酸','KMnO4','乙醇','H2O2'];
    for (var ci = 0; ci < cands.length; ci++) {
      if (known == null && nt.indexOf(norm(cands[ci])) >= 0) { known = molarMassOf(cands[ci]); kname = cands[ci]; }
    }
    if (known) {
      res.matched = true; res.type = 'mass'; res.title = '🧮 摩尔质量';
      res.result = known;
      res.formula = 'M(' + kname + ') = ' + known.toFixed(2) + ' g/mol';
      res.lines.push('由原子量加和求得：M = ' + known.toFixed(2) + ' g/mol。');
      res.note = '常见：莫尔盐 392.14；产物 491.25。';
      return res;   // 仅真命中已知物才返回；否则下探其余分支（如配制/滴定）
    }
  }

  // ③ 纯度（有效成分/有效产物；实测% vs 理论%；失水法纯度）——须在滴定/结晶水前，避免被"含量"吞掉
  if (/纯度|有效成分|有效产物/.test(t)) {
    var mAct = (t.match(/有效(?:成分|产物)[^0-9]{0,30}(\d+(?:\.\d+)?)\s*g/) || [])[1];
    var wReal = (t.match(/(?:实测|测得)[^0-9]{0,12}(\d+(?:\.\d+)?)\s*%/) || [])[1];
    var wStd = (t.match(/(?:理论|纯品|纯产物|纯)[^0-9]{0,12}(\d+(?:\.\d+)?)\s*%/) || [])[1];
    var mLoss = (t.match(/(?:失水|失去|脱水|水质量)[^0-9]{0,3}(\d+(?:\.\d+)?)\s*g/) || [])[1];
    var mSampleB = t.match(/(?:样品|称取\s*)?(\d+(?:\.\d+)?)\s*g\s*(?:样品|产物|晶体)|\b(\d+(?:\.\d+)?)\s*g\s+(?:样品|产物)/) || t.match(/样品\s*(\d+(?:\.\d+)?)\s*g/);
    // 失水法（Q045）：纯度 = 实测失水 / (样品 × 理论含水量)
    if (mLoss && wStd && mSampleB) {
      var mSam = parseFloat(mSampleB[1] || mSampleB[2]);
      var pQ45 = purity(parseFloat(mLoss), mSam * (parseFloat(wStd) / 100));
      res.matched = true; res.type = 'purity'; res.title = '🧮 产品纯度（失水法）'; res.result = pQ45;
      res.formula = '纯度 = 实测失水 / (样品×理论含水量) ×100%';
      res.lines.push('纯度 = ' + mLoss + ' ÷ (' + mSam + '×' + wStd + ') ×100% = ' + pQ45.toFixed(1) + '%');
      return res;
    }
    // 实测% vs 理论%（Q044/Q059）
    if (wReal && wStd) {
      var pQ2 = purity(parseFloat(wReal), parseFloat(wStd));
      res.matched = true; res.type = 'purity'; res.title = '🧮 产品纯度'; res.result = pQ2;
      res.formula = '纯度 = 实测(组分)/理论(组分)×100%';
      res.lines.push('纯度 = ' + wReal + '% ÷ ' + wStd + '% ×100% = ' + pQ2.toFixed(1) + '%');
      return res;
    }
    // Q057：由 n(Fe²⁺) 求实测 Fe%，再除以纯品 Fe% 得纯度
    if (/n\s*[（(]\s*fe/i.test(t)) {
      var scisFe = extractSci(t);
      if (scisFe.length) {
        var nFeV = scisFe[0];
        var mSamQ = t.match(/(?:样品|称取)\s*(\d+(?:\.\d+)?)\s*g|\b(\d+(?:\.\d+)?)\s*g\s+(?:样品|莫尔盐|产物)/);
        if (mSamQ) {
          var mSamQv = parseFloat(mSamQ[1] || mSamQ[2]);
          var wFeM = massFracFromMasses(nFeV * ATOMIC_MASS.Fe, mSamQv);
          res.matched = true; res.type = 'purity'; res.title = '🧮 Fe 质量分数 / 纯度';
          res.formula = 'w(Fe) = n(Fe²⁺)×55.845/m(样品)×100%；纯度=w/纯品w×100%';
          res.lines.push('m(Fe) = ' + nFeV.toExponential(3) + ' × 55.845 = ' + (nFeV * ATOMIC_MASS.Fe).toFixed(4) + ' g');
          res.lines.push('w(Fe) = ' + (nFeV * ATOMIC_MASS.Fe).toFixed(4) + ' ÷ ' + mSamQv + ' ×100% = ' + wFeM.toFixed(2) + '%');
          if (wStd) {
            var pFe = purity(wFeM, parseFloat(wStd));
            res.lines.push('纯度 = ' + wFeM.toFixed(2) + '% ÷ ' + wStd + '% ×100% = ' + pFe.toFixed(1) + '%');
            res.result = { wFe: wFeM, purity: pFe };
          } else { res.result = wFeM; }
          return res;
        }
      }
    }
    // 有效成分质量 / 样品质量（Q043/Q046 = min/max 两个 g 值）
    var gsQ = extractNums(t).filter(function(x){ return x.u === 'g' || x.u === '克'; }).map(function(x){ return x.v; });
    if (gsQ.length >= 2) {
      var gMin = Math.min.apply(null, gsQ), gMax = Math.max.apply(null, gsQ);
      var pQ3 = purity(gMin, gMax);
      res.matched = true; res.type = 'purity'; res.title = '🧮 产品纯度'; res.result = pQ3;
      res.formula = '纯度 = 有效成分/样品×100%';
      res.lines.push('纯度 = ' + gMin + ' g ÷ ' + gMax + ' g ×100% = ' + pQ3.toFixed(1) + '%');
      return res;
    }
  }

  // ③ KMnO4 滴定 C2O4^2- 含量（用 norm 归一化，兼容 KMnO₄ / C₂O₄²⁻ / Fe²⁺ 上标写法）
  var tTit = norm(t);
  if (/kmno4|高锰酸钾.*(滴定|消耗)|滴定.*(c2o4|草酸根|草酸铁钾)|含量.*c2o4|草酸根.*(含量|质量分数)/i.test(t)
      || /kmno4/.test(tTit) || /c2o4/.test(tTit)) {
    var nums3 = extractNums(t);
    var cK = null, vK = null, mS = null;
    for (var ni = 0; ni < nums3.length; ni++) {
      var it = nums3[ni];
      if (it.u === 'mol/l' || it.u === 'm') { if (cK == null) cK = it.v; }
      else if (it.u === 'ml' || it.u === '毫升') { if (vK == null) vK = it.v; }
      else if (it.u === 'g' || it.u === '克') { if (mS == null && it.v < 5) mS = it.v; }
    }
    if (cK == null) cK = 0.0200; if (vK == null) vK = null;
    // 只求 n(KMnO4)=c×V/1000（无称样量，问"物质的量"）——Q014
    if (cK && vK && !mS && /物质的量|摩尔数|n\s*[（(]\s*kmno4/i.test(t)) {
      var nM4 = cK * vK / 1000;
      res.matched = true; res.type = 'titration'; res.title = '🧮 KMnO₄ 物质的量'; res.result = nM4;
      res.formula = 'n = c × V(L)';
      res.lines.push('n(KMnO₄) = ' + cK + ' mol/L × ' + vK + ' mL/1000 = ' + nM4.toExponential(3) + ' mol');
      return res;
    }
    // KMnO4 滴定 Fe2+：n(Fe)=5×n(MnO4)，m(Fe)=n×M(Fe)——Q055
    if (cK && vK && !mS && /fe2?\+|fe\^?2\+|滴定.*fe|fe.*滴定|莫尔盐.*fe/i.test(t)) {
      var rFe = kmno4Fe(cK, vK);
      res.matched = true; res.type = 'titration'; res.title = '🧮 KMnO₄ 滴定 Fe²⁺'; res.result = rFe;
      res.formula = '5Fe²⁺ + MnO₄⁻ → 5Fe³⁺ + Mn²⁺；n(Fe)=5×n(MnO₄)；m(Fe)=n×55.845';
      res.lines.push('n(MnO₄⁻) = ' + cK + ' × ' + vK + '/1000 = ' + rFe.nMnO4.toExponential(3) + ' mol');
      res.lines.push('n(Fe²⁺) = 5 × ' + rFe.nMnO4.toExponential(3) + ' = ' + rFe.nFe.toExponential(3) + ' mol');
      res.lines.push('m(Fe) = ' + rFe.nFe.toExponential(3) + ' × 55.845 = ' + rFe.mFe.toFixed(4) + ' g');
      return res;
    }
    if (cK && vK && mS) {
      var rK = kmno4OxalatePct(cK, vK, mS);
      res.matched = true; res.type = 'titration'; res.title = '🧮 KMnO₄ 滴定草酸根含量';
      res.result = rK;
      res.formula = 'n(MnO₄⁻)=c×V；n(C₂O₄²⁻)=n(MnO₄⁻)×5/2；w=n×M(C₂O₄²⁻)/m(样)×100%';
      res.lines.push('n(MnO₄⁻) = ' + cK + ' mol/L × ' + vK + ' mL/1000 = ' + rK.nMnO4.toExponential(3) + ' mol');
      res.lines.push('n(C₂O₄²⁻) = ' + rK.nMnO4.toExponential(3) + ' × 5/2 = ' + rK.nOx.toExponential(3) + ' mol');
      res.lines.push('m(C₂O₄²⁻) = ' + rK.nOx.toExponential(3) + ' × 88.02 = ' + rK.mOx.toFixed(4) + ' g');
      res.lines.push('w(C₂O₄²⁻) = ' + rK.mOx.toFixed(4) + ' ÷ ' + mS + ' × 100% = ' + rK.w.toFixed(1) + '%');
      if (Math.abs(rK.w - 53.8) <= 3) res.note = '纯产物理论值 3×88.02/491.25 ≈ 53.8%，与测定值吻合。';
      return res;
    }
    // 未凑成完整滴定（缺 c / V / 称样量），不在此处吞掉：下探配制/其它分支
  }

  // ④ 组分质量分数（由分子式 或 由样品/组分质量求）——用 norm 归一化下标；组分取"最靠近 质量分数 者"
  if (/质量分数|理论含量|百分含量/.test(t) && !/结晶水|失水|含水量|无水/.test(t)) {
    var tnMF = norm(t);
    var compName = null, compM = null, compCount = 1;
    var qi = tnMF.indexOf('质量分数');
    if (qi < 0) qi = tnMF.indexOf('含量'); if (qi < 0) qi = tnMF.indexOf('百分含量');
    var iFe = tnMF.lastIndexOf('fe', qi), iC2 = tnMF.lastIndexOf('c2o4', qi), iOx = tnMF.lastIndexOf('草酸根', qi);
    if (iC2 >= 0 || iOx >= 0) { var c2last = Math.max(iC2, iOx); var felast = iFe; if (c2last >= felast) { compName = 'C₂O₄²⁻'; compM = RECIPE.oxalate_ion_M; compCount = 3; } else { compName = 'Fe'; compM = ATOMIC_MASS.Fe; compCount = 1; } }
    else if (iFe >= 0) { compName = 'Fe'; compM = ATOMIC_MASS.Fe; compCount = 1; }
    if (compName) {
      var nx4 = extractNums(t);
      var mSmp = null, mCmp = null;
      for (var fi = 0; fi < nx4.length; fi++) {
        var u4 = nx4[fi];
        if (u4.u === 'g' || u4.u === '克') { if (mSmp == null) mSmp = u4.v; else mCmp = u4.v; }
      }
      // ① 样品质量 + 组分质量 → w = m组分/m样
      if (mSmp != null && mCmp != null && mSmp > 0 && mCmp < mSmp) {
        var wMF = massFracFromMasses(mCmp, mSmp);
        res.matched = true; res.type = 'massfrac'; res.title = '🧮 质量分数（实测）'; res.result = wMF;
        res.formula = 'w = m(组分)/m(样品)×100%';
        res.lines.push('w(' + compName + ') = ' + mCmp + ' ÷ ' + mSmp + ' × 100% = ' + wMF.toFixed(1) + '%');
        return res;
      }
      // ② 由分子式求理论质量分数
      var compF = null;
      var cand5 = ['三草酸合铁酸钾','K3[Fe(C2O4)3]·3H2O','莫尔盐','(NH4)2Fe(SO4)2·6H2O','草酸亚铁','KMnO4','产物','产品'];
      for (var ci5 = 0; ci5 < cand5.length; ci5++) {
        if (compF == null && norm(t).indexOf(norm(cand5[ci5])) >= 0) compF = molarMassOf(cand5[ci5]);
      }
      if (compF) {
        var wMF2 = componentMassFrac(compF, compM, compCount);
        res.matched = true; res.type = 'massfrac'; res.title = '🧮 质量分数（分子式）'; res.result = wMF2;
        res.formula = 'w = ' + compCount + '×M(' + compName + ')/M(化合物)×100%';
        res.lines.push('w(' + compName + ') = ' + compCount + '×' + compM + '/' + compF.toFixed(2) + '×100% = ' + wMF2.toFixed(1) + '%');
        return res;
      }
    }
  }

  // ⑤ 结晶水（质量分数 & 失水/无水质量）——若为"配制溶液/需称取"的制备题则下探到 ⑩ 配制；若问温度则为事实题，交 FAQ
  var isPrepareQ = /mol\/l|mol\s*\/\s*l|mol·l/i.test(t) && /(配制|需称取|称取|定容|加.*水.*至)/.test(t);
  var isTempQ = /摄氏度|℃|温度|加热到.*?℃/.test(t);
  if (/结晶水|失水|脱水|无水|含水量|水分子|失去.*的水/.test(t) && !isPrepareQ && !isTempQ) {
    var nw2 = null;
    var n3 = extractNums(t);
    for (var wi = 0; wi < n3.length; wi++) { var u3 = n3[wi]; if (u3.u === '' && u3.v >= 1 && u3.v <= 6) { nw2 = u3.v; } }
    if (nw2 == null) nw2 = RECIPE.n_crystal_water;
    var wcp = crystalWaterPct(nw2);
    // 样品质量（g，取第一个带 g 的数值）
    var mCW = null;
    for (var wj = 0; wj < n3.length; wj++) { if (n3[wj].u === 'g' || n3[wj].u === '克') { mCW = n3[wj].v; break; } }
    var asksMass = /失水|脱水|失去.*的水|无水|水的质量|水质量/.test(t);
    var asksPct = /质量分数|含量|含水量|百分/.test(t);
    res.matched = true; res.type = 'crystalwater'; res.title = '🧮 结晶水'; res.formula = 'w = nW×18.02/491.25×100%';
    if (mCW != null && (asksMass || /无水产物|无水质量/.test(t))) {
      var mW = waterMass(mCW, wcp), mA = anhydrousMass(mCW, wcp);
      res.result = { wPct: wcp, mWater: mW, mAnhydrous: mA };
      res.lines.push('w(结晶水) = ' + wcp.toFixed(2) + '%；（每摩尔含 3 分子水）');
      res.lines.push('m(结晶水) = ' + mCW + ' g × ' + wcp.toFixed(2) + '% = ' + mW.toFixed(3) + ' g');
      res.lines.push('m(无水产物) = ' + mCW + ' g − ' + mW.toFixed(3) + ' g = ' + mA.toFixed(3) + ' g');
      return res;
    }
    res.result = wcp;
    res.lines.push('w(结晶水) = 3×18.02/491.25×100% = ' + wcp.toFixed(1) + '%');
    return res;
  }

  // ⑥ 相对误差（称量/感量）
  if (/相对误差/.test(t)) {
    var gvs6 = extractNums(t).filter(function(x){ return x.u === 'g' || x.u === '克'; }).map(function(x){ return x.v; });
    if (/感量|绝对误差/.test(t) && gvs6.length >= 2) {
      var absE = Math.min.apply(null, gvs6), sampV = Math.max.apply(null, gvs6);
      var reAbs = relErrFromAbs(absE, sampV);
      res.matched = true; res.type = 'relerr'; res.title = '🧮 相对误差（感量）'; res.result = reAbs;
      res.formula = '相对误差 = 绝对误差/称样量×100%';
      res.lines.push('相对误差 = ' + absE + ' g ÷ ' + sampV + ' g ×100% = ' + reAbs.toFixed(2) + '%');
      return res;
    }
    if (gvs6.length >= 2) {
      var mTrueV = (t.match(/真实值?[为是约等于=\s：:]{0,4}(\d+(?:\.\d+)?)\s*g/) || [])[1];
      var mMeasV = (t.match(/(?:称量|读数|测量)[^0-9]{0,6}(\d+(?:\.\d+)?)\s*g/) || [])[1];
      var m1 = mMeasV ? parseFloat(mMeasV) : gvs6[0], m2 = mTrueV ? parseFloat(mTrueV) : gvs6[1];
      var reE = relErr(m1, m2);
      res.matched = true; res.type = 'relerr'; res.title = '🧮 相对误差'; res.result = reE;
      res.formula = '相对误差 = |测量-真实|/真实×100%';
      res.lines.push('相对误差 = |' + m1 + '−' + m2 + '|/' + m2 + '×100% = ' + reE.toFixed(1) + '%');
      return res;
    }
  }

  // ⑤ 磁矩（仅自旋）——用 norm 归一化上标，取"最后一个"d 构型=提问对象，避免把 BM 当 n
  if (/磁矩|b\.m\.|bm|未成对电子.*(几个|多少)|μ\s*eff|μeff/i.test(t)) {
    var tn = norm(t);
    var isLow = /低自旋/.test(tn) && !/高自旋/.test(tn);
    var dE = null;
    if (/fe2\+|fe\^?2\+/.test(tn) && !/fe3\+|fe\^?3\+/.test(tn)) dE = isLow ? 0 : 4; // Fe2+ d6 高自旋→4
    else if (/fe3\+|fe\^?3\+/.test(tn) && !/fe2\+|fe\^?2\+/.test(tn)) dE = isLow ? 1 : 5; // Fe3+ d5
    else {
      var dmAll = tn.match(/d\s*([0-9])/g) || [];
      if (dmAll.length) { var dVal = +dmAll[dmAll.length - 1].match(/[0-9]/)[0]; dE = isLow ? (dVal === 5 ? 1 : (dVal >= 6 ? 0 : dVal % 2)) : (dVal <= 5 ? dVal : 10 - dVal); }
    }
    res.matched = true; res.type = 'magnetic'; res.title = '🧮 磁矩'; res.formula = 'μeff = √[n(n+2)]';
    if (dE != null) {
      res.result = magneticMoment(dE);
      res.lines.push('未成对电子 n = ' + dE + '（' + (isLow ? '低自旋' : '高自旋') + '），μeff = √[' + dE + '×' + (dE + 2) + '] = √' + (dE * (dE + 2)) + ' ≈ ' + res.result.toFixed(2) + ' BM');
    } else {
      res.lines.push('由电子构型求未成对电子数，再代入 μeff = √[n(n+2)]。');
    }
    return res;
  }

  // ⑥ CFSE（用 norm 归一化下标/上标：t₂g³ eg² → t2g3 eg2）
  if (/cfse|稳定化能|晶体场稳定化/i.test(t)) {
    var tnCFSE = norm(t);
    var cs = tnCFSE.match(/t2g\^?(\d)\D{0,6}eg\^?(\d)/) || tnCFSE.match(/t2g(\d)\D{0,6}eg(\d)/);
    res.matched = true; res.type = 'cfse'; res.title = '🧮 CFSE';
    if (cs) { var a = +cs[1], b = +cs[2]; res.result = cfse(a, b); res.formula = 'CFSE=(-0.4×t₂g+0.6×eg)Δo';
      res.lines.push('CFSE = (-0.4×' + a + ' + 0.6×' + b + ')Δo = ' + res.result.toFixed(1) + 'Δo（t₂g' + a + ' eg' + b + '）。'); }
    else if (/高自旋.*d5|d5.*高自旋/.test(tnCFSE)) { res.result = 0; res.formula = '高自旋d⁵(t₂g³eg²)'; res.lines.push('高自旋d⁵（t₂g³ eg²）CFSE = (-0.4×3+0.6×2)Δo = 0Δo。'); }
    else if (/低自旋.*d6|d6.*低自旋/.test(tnCFSE)) { res.result = -2.4; res.formula = '低自旋d⁶(t₂g⁶eg⁰)'; res.lines.push('低自旋d⁶（t₂g⁶ eg⁰）CFSE = (-0.4×6+0.6×0)Δo = -2.4Δo。'); }
    return res;
  }

  // ⑦ ΔG° from Kf（用 extractSci 解析 "1.0×10²⁰" 这类上标科学计数）
  if (/自由能|Δg|δg|gibbs/i.test(t) && /kf|稳定常数|平衡常数/.test(t)) {
    var scisD = extractSci(t);
    if (scisD.length) {
      var dg = dGfromKf(scisD[0]);
      res.matched = true; res.type = 'dG'; res.title = '🧮 标准自由能'; res.result = dg;
      res.formula = 'ΔG° = -RT lnKf';
      res.lines.push('ΔG° = -8.314 × 298 × ln(' + scisD[0].toExponential(3) + ') ÷ 1000 ≈ ' + dg.toFixed(1) + ' kJ/mol（25℃）。');
    }
    return res;
  }

  // ⑧ 电池电动势 / lgK（给定两个电极电势 或 直接给 ΔE° 与 n）
  if (/电动势|ecell|电位|电势|标准电极|lg\s*k|平衡常数/.test(t)) {
    var vM = t.match(/(\d+\.?\d*)\s*v[^0-9]{0,12}(\d+\.?\d*)\s*v/i);
    if (vM) {
      var eN = t.match(/\b([12])\s*个电子|\bn\s*=\s*([12])\b/);
      var nn = eN ? (eN[1] ? +eN[1] : +eN[2]) : 2;
      var ne = nernstCell(parseFloat(vM[1]), parseFloat(vM[2]), nn);
      res.matched = true; res.type = 'nernst'; res.title = '🧮 电池电动势 / lgK'; res.result = ne;
      res.formula = 'E°cell = E°(阳)-E°(阴)；lgK = nE°/0.0592';
      res.lines.push('E°cell = ' + vM[1] + ' - ' + vM[2] + ' = ' + ne.Ecell.toFixed(3) + ' V');
      res.lines.push('lgK = ' + nn + '×' + ne.Ecell.toFixed(3) + '/0.0592 ≈ ' + ne.lgK.toFixed(1) + '，K≈10^' + ne.lgK.toFixed(1));
      return res;
    }
    // 直接给 ΔE° 与 n（Q072）
    var dE = t.match(/(?:Δ[eE]°?|电池电势差|标准电动势)[^0-9]{0,4}(-?\d+(?:\.\d+)?)\s*v/i);
    if (dE) {
      var eN2 = t.match(/n\s*=\s*([12])\b/) || t.match(/\b([12])\s*个电子/);
      var nn2 = eN2 ? +eN2[1] : 2;
      var dEval = parseFloat(dE[1]);
      var lgKv = nn2 * dEval / 0.0592;
      res.matched = true; res.type = 'nernst'; res.title = '🧮 lgK（由 ΔE°）'; res.result = { Ecell: dEval, lgK: lgKv, K: Math.pow(10, lgKv) };
      res.formula = 'lgK = nΔE°/0.0592';
      res.lines.push('lgK = ' + nn2 + '×' + dEval + '/0.0592 ≈ ' + lgKv.toFixed(1) + '，K≈10^' + lgKv.toFixed(1));
      return res;
    }
    return res;
  }

  // ⑨ 平均 / RSD 已前移到函数顶部 ⓪（避免被"产率"分支误判）

  // ⑩ 溶液配制 m=c·V·M（V 支持 mL/L；M 可由物质名查出，见 Q033-Q036）
  if (/配制|称取.*g|需要.*g/.test(t)) {
    var nx = extractNums(t);
    var cN = null, vN = null, MN = null;
    for (var pi = 0; pi < nx.length; pi++) {
      var itp = nx[pi];
      if (itp.u === 'mol/l' || itp.u === 'm') { if (cN == null) cN = itp.v; }
      else if (itp.u === 'ml' || itp.u === '毫升') { if (vN == null) vN = itp.v / 1000; }
      else if (itp.u === 'l') { if (vN == null) vN = itp.v; }
      else if (itp.u === '') { if (MN == null && itp.v > 20) MN = itp.v; } // g/mol 数量级
    }
    if (cN != null && vN != null && MN == null) {
      var compP = null, ntP = norm(t);
      var candP = ['三草酸合铁酸钾','K3[Fe(C2O4)3]·3H2O','K3[Fe(C2O4)3]','草酸亚铁二水合物','草酸亚铁','草酸二水合物','H2C2O4·2H2O','草酸钾一水合物','K2C2O4·H2O','草酸钾','草酸','KMnO4','莫尔盐','硫酸亚铁铵','H2O2'];
      for (var pi2 = 0; pi2 < candP.length; pi2++) { if (compP == null && ntP.indexOf(norm(candP[pi2])) >= 0) compP = candP[pi2]; }
      if (/无水\s*K?3?\[?Fe|无水.*三草酸/i.test(ntP)) compP = 'K3[Fe(C2O4)3]';
      if (/草酸.*二水|二水.*草酸|h2c2o4.*2h2o|草酸二水/.test(t)) compP = 'H2C2O4·2H2O';
      if (compP) MN = molarMassOf(compP);
    }
    if (cN != null && vN != null && MN != null) {
      res.matched = true; res.type = 'prepare'; res.title = '🧮 溶液配制'; res.formula = 'm = c × V × M';
      res.result = cN * vN * MN;
      res.lines.push('需要溶质质量 = ' + cN + ' mol/L × ' + vN.toFixed(3) + ' L × ' + MN + ' g/mol = ' + res.result.toFixed(2) + ' g');
      return res;
    }
    return res;
  }

  // ⑪ 自由金属离子浓度（Q075）
  if (/游离\s*fe|\[fe\^?3?\+?.*浓度|求.*fe\^?3\+.*mol\/l|kf.*游离/i.test(t)) {
    var tnFM = norm(t);
    var scsFM = extractSci(t);
    var ML = (t.match(/(\d+(?:\.\d+)?)\s*mol\/l/i) || [])[1];
    var Lf = (tnFM.match(/游离\s*草酸根\s*\[?\/?[\W]*(\d+(?:\.\d+)?)\s*mol\/l/) || [])[1] || (tnFM.match(/\[?c2o4\^?2-?\]?\s*=\s*(\d+(?:\.\d+)?)/) || [])[1];
    if (scsFM.length && ML && Lf) {
      var fM = freeMetal(parseFloat(ML), scsFM[0], parseFloat(Lf));
      res.matched = true; res.type = 'freeMetal'; res.title = '🧮 游离 Fe³⁺ 浓度'; res.result = fM;
      res.formula = '[Fe³⁺] = [配合物]/(Kf·[C₂O₄²⁻]³)';
      res.lines.push('[Fe³⁺] = ' + ML + ' ÷ (' + scsFM[0].toExponential(3) + ' × ' + Lf + '³) ≈ ' + fM.toExponential(2) + ' mol/L');
      return res;
    }
  }

  // ⑫ 分布系数 α₂（Q088）
  if (/分布系数/.test(t) && /pka|ph/i.test(t)) {
    var pH = (t.match(/ph\s*=\s*(\d+(?:\.\d+)?)/i) || [])[1];
    var pk1 = (t.match(/pka1\s*=\s*(\d+(?:\.\d+)?)/i) || [])[1];
    var pk2 = (t.match(/pka2\s*=\s*(\d+(?:\.\d+)?)/i) || [])[1];
    if (pH && pk1 && pk2) {
      var a2 = oxalateAlpha2(parseFloat(pH), parseFloat(pk1), parseFloat(pk2));
      res.matched = true; res.type = 'alpha2'; res.title = '🧮 分布系数 α₂'; res.result = a2;
      res.formula = 'α₂ = Ka1Ka2/([H]²+Ka1[H]+Ka1Ka2)';
      res.lines.push('α₂ = ' + a2.toFixed(4) + '（pH=' + pH + '，草酸根占主导）。');
      return res;
    }
  }

  // ⑬ 简单化学计量（Q077：n(草酸)=n(Fe²⁺)；Q079：电子转移数）
  var tnST = norm(t);
  if (/h2c2o4|草酸/.test(tnST) && /fe/.test(tnST) && /物质的量|投入|所需/.test(t)) {
    var nFeS = (tnST.match(/(?:投入|加?入|取)\s*([\d.]+)\s*mol\s*fe\^?2\+|([\d.]+)\s*mol\s*fe\^?2\+/) || []);
    var nFeV = nFeS[1] ? parseFloat(nFeS[1]) : (nFeS[2] ? parseFloat(nFeS[2]) : 0.01275);
    res.matched = true; res.type = 'stoi'; res.title = '🧮 化学计量（Fe²⁺:H₂C₂O₄=1:1）'; res.result = nFeV;
    res.formula = 'Fe²⁺ + H₂C₂O₄ → FeC₂O₄↓ + 2H⁺';
    res.lines.push('n(H₂C₂O₄) = n(Fe²⁺) = ' + nFeV + ' mol');
    return res;
  }
  if (/转移.*电子|多少个?电子|得电子|失电子/.test(t)) {
    var nFeE = (tnST.match(/([\d.]+)\s*mol\s*fe\^?2\+/) || [])[1];
    if (nFeE) {
      res.matched = true; res.type = 'stoi'; res.title = '🧮 电子转移'; res.result = parseFloat(nFeE);
      res.formula = 'Fe²⁺→Fe³⁺：1e⁻/mol';
      res.lines.push('2 mol Fe²⁺→2 mol Fe³⁺ 共转移 ' + nFeE + ' mol 电子（每 mol Fe²⁺ 失 1 mol e⁻）。');
      return res;
    }
    if (/1\s*mol\s*h2o2|h2o2.*2\s*mol/.test(tnST) || (/h2o2/.test(tnST) && /得到/.test(t))) {
      res.matched = true; res.type = 'stoi'; res.title = '🧮 电子转移'; res.result = 2; res.formula = 'H₂O₂：2e⁻/mol';
      res.lines.push('1 mol H₂O₂ 得到 2 mol 电子（O 由 -1 降至 -2）。');
      return res;
    }
  }

  // ⑭ 有效数字 / 多步连乘产率可用通用产率覆盖（保留）
  return res;
}

/* ================= 导出（兼容 node require 与浏览器 <script>） ================= */
var ChemCalc = {
  ATOMIC_MASS: ATOMIC_MASS,
  KNOWN_MASS: KNOWN_MASS,
  RECIPE: RECIPE,
  norm: norm,
  formulaMass: formulaMass,
  molarMassOf: molarMassOf,
  theoreticalYield: theoreticalYield,
  yieldPct: yieldPct,
  crystalWaterPct: crystalWaterPct,
  magneticMoment: magneticMoment,
  cfse: cfse,
  dGfromKf: dGfromKf,
  kmno4OxalatePct: kmno4OxalatePct,
  mean: mean,
  rsd: rsd,
  nernstCell: nernstCell,
  componentMassFrac: componentMassFrac,
  massFracFromMasses: massFracFromMasses,
  purity: purity,
  relErr: relErr,
  relErrFromAbs: relErrFromAbs,
  totalYieldPct: totalYieldPct,
  waterMass: waterMass,
  anhydrousMass: anhydrousMass,
  reverseYieldMohr: reverseYieldMohr,
  kmno4Fe: kmno4Fe,
  oxalateAlpha2: oxalateAlpha2,
  freeMetal: freeMetal,
  extractSci: extractSci,
  extractNums: extractNums,
  calcAnswer: calcAnswer
};

if (typeof module !== 'undefined' && module.exports) module.exports = ChemCalc;
if (typeof globalThis !== 'undefined') { try { globalThis.ChemCalc = ChemCalc; } catch (e) {} }
if (typeof window !== 'undefined') { window.ChemCalc = ChemCalc; }
