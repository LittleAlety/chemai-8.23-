/**
 * ChemAI FAQ 统一管理工具 (总集)
 * 整合原 add_faq.js / apply_10cycle_fixes.js / merge_faq.js / refine_faq_r2.js / sync_faq.js
 *
 * 用法:
 *   node faq_tools.js sync              — 同步 faq_unified.json → assistant.html
 *   node faq_tools.js merge             — 合并 faq_auto.json + faq_auto_fixed.json → faq_unified.json
 *   node faq_tools.js refine            — 精炼 FAQ: 自动分类 + 质量检查
 *   node faq_tools.js add               — 增量添加 FAQ 条目到 assistant.html
 *   node faq_tools.js apply-fixes <file> — 从工作流输出提取并应用修复
 *   node faq_tools.js stats             — 显示 FAQ 统计信息（含质量报告）
 *   node faq_tools.js sync-kg           — 同步 FAQ 数据到知识图谱节点
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { normalize } = require('../scripts/category-utils');
const { readJSON } = require('../scripts/rag-utils');
const { readFAQRuntime } = require('../scripts/lib-assistant-faq.js');

const BASE = path.join(__dirname, '..');
const FAQ_PATH = path.join(BASE, 'data', 'faq_unified.json');
const HTML_PATH = path.join(BASE, 'assistant.html');

function esc(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
}

// DEPRECATED since v31: assistant.html loads FAQ via fetch()
// ===== sync: FAQ → HTML (DEPRECATED - no longer needed) =====
/*
function cmdSync() {
  console.log('=== FAQ → HTML 同步 ===');
  const faq = readJSON(FAQ_PATH);
  let html = fs.readFileSync(HTML_PATH, 'utf8');

  const faqStart = html.indexOf('const FAQ=[');
  const commentMarker = '/* FAQ 匹配：多关键词命中率';
  const commentPos = html.indexOf(commentMarker, faqStart);

  if (faqStart < 0 || commentPos < 0) {
    console.error('✗ 找不到 FAQ 数组位置');
    process.exit(1);
  }

  const before = html.slice(Math.max(0, commentPos - 40), commentPos);
  const bm = before.match(/\];\s*$/);
  if (!bm) { console.error('✗ 找不到 FAQ 数组结束'); process.exit(1); }

  let faqJS = 'const FAQ=[\n';
  let cnt = 0;
  faq.forEach(entry => {
    const keys = (entry.keys || []).filter(k => k && String(k).length >= 2).slice(0, 15);
    const ents = (entry.ents || []).filter(e => e && String(e).length >= 2).slice(0, 5);
    const title = entry.title || '';
    const answer = (entry.answer || '').slice(0, 500);
    const detail = (entry.detail || '').slice(0, 800);
    const q = entry.q || title;
    const sf = normalize(entry.subfield || '综合研究');
    if (!title || !answer || answer.length < 10) return;
    if (!keys.length && !ents.length) return;
    faqJS += ' {keys:' + JSON.stringify(keys) + ',ents:' + JSON.stringify(ents) +
      ",title:'" + esc(title) + "',q:'" + esc(q) + "',knode:'" + (entry.knode || '') +
      "',subfield:'" + esc(sf) + "',answer:'" + esc(answer) + "',detail:'" + esc(detail) + "'},\n";
    cnt++;
  });
  faqJS += '];\r\r\n/* FAQ 匹配';

  const newHtml = html.slice(0, faqStart) + faqJS + html.slice(commentPos);
  fs.writeFileSync(HTML_PATH, newHtml, 'utf8');
  console.log('✓ HTML 已更新: ' + cnt + ' 条 FAQ (文件大小: ' + newHtml.length + ' bytes)');
}
*/

// ===== merge: faq_auto + faq_auto_fixed → faq_unified =====
function cmdMerge() {
  console.log('=== FAQ 合并 ===');
  const autoPath = path.join(BASE, 'data', 'faq_auto.json');
  const fixedPath = path.join(BASE, 'data', 'faq_auto_fixed.json');

  if (!fs.existsSync(autoPath) || !fs.existsSync(fixedPath)) {
    console.error('✗ 缺少 faq_auto.json 或 faq_auto_fixed.json');
    process.exit(1);
  }

  const auto = readJSON(autoPath);
  const fixed = readJSON(fixedPath);
  console.log('faq_auto.json: ' + auto.length + ' 条');
  console.log('faq_auto_fixed.json: ' + fixed.length + ' 条');

  const fixedMap = new Map();
  fixed.forEach(e => { fixedMap.set(e.q, e); });

  let enrichedSubfield = 0;
  const merged = auto.map(entry => {
    const match = fixedMap.get(entry.q);
    if (!match) return entry;
    if (typeof match.subfield === 'string' && match.subfield.trim()) {
      enrichedSubfield++;
      return { ...entry, subfield: match.subfield };
    }
    return entry;
  });

  // 归一化所有 subfield
  let normCount = 0;
  merged.forEach(e => {
    const old = e.subfield;
    e.subfield = normalize(e.subfield);
    if (e.subfield !== old) normCount++;
  });

  // 去重
  const seen = new Set();
  const deduped = merged.filter(e => {
    const key = e.q;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(FAQ_PATH, JSON.stringify(deduped, null, 2), 'utf8');
  console.log('✓ 合并完成: ' + deduped.length + ' 条 (富化分类: ' + enrichedSubfield + ', 归一化: ' + normCount + ', 去重: ' + (merged.length - deduped.length) + ')');
}

// ===== refine: 自动分类 + 质量检查 =====
function cmdRefine() {
  console.log('=== FAQ 精炼 ===');
  const faq = readJSON(FAQ_PATH);
  console.log('已加载: ' + faq.length + ' 条');

  const CATEGORIES = [
    { pattern: /磁性|磁化率|磁矩|磁天平|顺磁|抗磁|铁磁|反铁磁|磁耦合/i, cat: '磁性研究' },
    { pattern: /光化学|光解|光照|避光|蓝晒|光致|光还|LMCT|量子产|紫外光|暗处|曝光|晒图/i, cat: '光化学应用' },
    { pattern: /滴定|KMnO4|标定|浓度|测定|分析|定量|含量|检测|标准溶液|指示剂|终点/i, cat: '分析测定' },
    { pattern: /热分解|TG|DSC|热重|热分析|热解|热稳定|分解温|脱水|差热|焙烧|TG-DSC|热行为|煅烧/i, cat: '热分析' },
    { pattern: /UV-Vis|红外|IR|光谱|吸收峰|吸收带|XRD|衍射|晶体结构|晶系|晶胞|空间群|SEM|TEM|表征|单晶|X射线/i, cat: '结构表征' },
    { pattern: /合成|制备|步骤|流程|操作步骤|合成路线|投料|加料|反应条件|产率/i, cat: '合成制备' },
    { pattern: /废物|废液|安全|防护|中毒|处理|回收|泄漏|溅入|误食|灭火|急救|危险|禁忌|MSDS|CAS|分类|标签/i, cat: '安全与废物处理' },
    { pattern: /教学|实验目的|教学目|学习目|课前|考核|思政|素养|课程|能力目|知识目|预习|实验报告/i, cat: '实验教学' },
    { pattern: /晶体场|配位场|d-d|d轨道|分裂能|稳定化能|CFSE|CFT|LFT|高自旋|低自旋|姜-泰勒|Jahn|光谱化学序|Δo|Δt|t2g|eg/i, cat: '配位化学理论' },
    { pattern: /配位理论|维尔纳|螯合|稳定常数|配位数|内外界|价键|EAN|Sidgwick|Lewis|主价|副价|配位键|配体|中心离子|螯合效应|螯合环|五元环/i, cat: '配位化学理论' },
    { pattern: /溶解度|溶解|结晶|过滤|抽滤|洗涤|干燥|烘干|蒸发|浓缩|称量|倾滗|沉淀|离心|搅拌|加热|水浴|冷却|冰水|热水/i, cat: '实验操作' },
    { pattern: /方程|反应式|化学式|分子式|化学方程式|离子方程式|机理|反应历程|中间体|自由基|氧化还原|还原剂|氧化剂|半反应/i, cat: '反应原理' },
    { pattern: /电子|电化学|电位|电势|能斯特|循环伏安|电极|电解|导电|CV/i, cat: '反应原理' },
    { pattern: /发展|历史|阶段|发现|诺贝尔|奠基|萌芽|谁提出|哪一年|最早/i, cat: '化学史' },
    { pattern: /对比|比较|区别|vs|优缺点|哪个好|选|综合|跨章/i, cat: '综合研究' },
  ];

  let categorized = 0, stillUnmatched = 0;
  const catCount = {};

  faq.forEach(entry => {
    if (typeof entry.subfield === 'string' && entry.subfield.trim()) {
      entry.subfield = normalize(entry.subfield);
      catCount[entry.subfield] = (catCount[entry.subfield] || 0) + 1;
      return;
    }
    const haystack = [entry.q, entry.answer, ...(entry.keys || []), entry.title || ''].join(' ');
    let matched = false;
    for (const rule of CATEGORIES) {
      if (rule.pattern.test(haystack)) {
        entry.subfield = rule.cat;
        catCount[rule.cat] = (catCount[rule.cat] || 0) + 1;
        categorized++;
        matched = true;
        break;
      }
    }
    if (!matched) {
      entry.subfield = '综合研究';
      catCount['综合研究'] = (catCount['综合研究'] || 0) + 1;
      stillUnmatched++;
    }
  });

  console.log('自动分类: ' + categorized + ' | 默认综合研究: ' + stillUnmatched);

  // 质量检查
  const shortAnswers = faq.filter(e => (e.answer || '').length < 60).length;
  const emptyDetail = faq.filter(e => !e.detail || !e.detail.trim()).length;
  const fewKeys = faq.filter(e => (e.keys || []).length < 3).length;

  console.log('\n=== 质量报告 ===');
  console.log('短答案(<60字): ' + shortAnswers);
  console.log('缺少detail: ' + emptyDetail);
  console.log('关键词<3: ' + fewKeys);
  console.log('\n=== 分类分布 ===');
  Object.entries(catCount).sort((a, b) => b[1] - a[1]).forEach(([cat, n]) => {
    console.log('  ' + cat + ': ' + n);
  });

  fs.writeFileSync(FAQ_PATH, JSON.stringify(faq, null, 2), 'utf8');
  console.log('\n✓ 精炼完成: ' + faq.length + ' 条');
}

// DEPRECATED since v31: assistant.html loads FAQ via fetch()
// ===== add: 增量添加 FAQ 到 assistant.html (DEPRECATED) =====
/*
function cmdAdd() {
  console.log('=== FAQ 增量添加 ===');
  const cp = require('child_process');
  try {
    cp.execSync('git checkout 9067dae -- assistant.html', { cwd: BASE });
    console.log('  已恢复 assistant.html 到基准版本');
  } catch (e) {
    console.log('  跳过 git checkout (可能不在git仓库)');
  }

  const faq = readJSON(FAQ_PATH);
  let html = fs.readFileSync(HTML_PATH, 'utf8');

  const faqStart = html.indexOf('const FAQ=[');
  const endMatch = html.slice(faqStart).match(/\];\s*\/\*\s*FAQ\s*匹配/);
  if (!endMatch) { console.error('✗ 找不到 FAQ 结束位置'); process.exit(1); }
  const endPos = faqStart + endMatch.index;

  let newEntries = '';
  let cnt = 0;
  faq.forEach(e => {
    const title = e.title, answer = e.answer;
    if (!title || !answer || answer.length < 10) return;
    const keys = (e.keys || []).filter(k => k && k.length >= 2).slice(0, 15);
    const ents = (e.ents || []).filter(k => k && k.length >= 2).slice(0, 5);
    if (!keys.length && !ents.length) return;
    newEntries += ',\r\n {' +
      'keys:' + JSON.stringify(keys) + ',ents:' + JSON.stringify(ents) +
      ",title:'" + esc(title) + "',q:'" + esc(e.q || title) +
      "',knode:'" + esc(e.knode || '') + "',subfield:'" + esc(normalize(e.subfield || '综合研究')) +
      "',answer:'" + esc(answer.slice(0, 400)) + "',detail:'" + esc((e.detail || '').slice(0, 400)) + "'}";
    cnt++;
  });

  html = html.slice(0, endPos) + newEntries + '\r\n' + html.slice(endPos);
  fs.writeFileSync(HTML_PATH, html, 'utf8');
  console.log('✓ 已添加 ' + cnt + ' 条 FAQ 到 assistant.html');
}
*/

// ===== apply-fixes: 从工作流输出提取并应用修复 =====
function cmdApplyFixes(inputFile) {
  console.log('=== 应用修复 ===');
  if (!inputFile) {
    console.error('用法: node faq_tools.js apply-fixes <工作流输出文件>');
    process.exit(1);
  }

  const wf = readJSON(inputFile);
  const resultData = wf.result || {};
  const cycles = resultData.cycles || [];
  const progressAgents = (wf.workflowProgress || []).filter(e => e.type === 'workflow_agent');

  console.log('工作流: ' + wf.summary);
  console.log('周期: ' + cycles.length + ' | Agent条目: ' + progressAgents.length);

  // 提取修复
  const allFixes = [];
  progressAgents
    .filter(a => a.label && a.label.startsWith('甲-修复'))
    .forEach(a => {
      try {
        const cycle = parseInt(a.label.replace('甲-修复-C', ''));
        const data = JSON.parse(a.resultPreview || '{}');
        if (data.fixes && Array.isArray(data.fixes)) {
          data.fixes.forEach(f => { f._cycle = cycle; });
          allFixes.push(...data.fixes);
        }
      } catch (e) { /* skip */ }
    });

  cycles.forEach(c => {
    if (c.fixes && Array.isArray(c.fixes)) {
      c.fixes.forEach(cf => {
        if (!allFixes.some(af => af.q === cf.q && af._cycle === c.cycle)) {
          cf._cycle = c.cycle;
          allFixes.push(cf);
        }
      });
    }
  });

  console.log('修复总计: ' + allFixes.length);

  // 去重 (保留最新周期)
  const fixMap = new Map();
  allFixes.forEach(f => {
    const key = f.action + ':' + f.q;
    const existing = fixMap.get(key);
    if (!existing || f._cycle > existing._cycle) fixMap.set(key, f);
  });
  console.log('去重后: ' + fixMap.size);

  // 应用
  const faq = readJSON(FAQ_PATH);
  let applied = 0, newEntries = 0, skipped = 0;

  fixMap.forEach(fix => {
    if (fix.action === 'new_entry') {
      try {
        let newEntry;
        if (typeof fix.new_value === 'string' && fix.new_value.trim().startsWith('{')) {
          newEntry = JSON.parse(fix.new_value);
        } else if (typeof fix.new_value === 'object' && fix.new_value.q) {
          newEntry = fix.new_value;
        } else if (fix.q && fix.answer) {
          newEntry = { q: fix.q, answer: fix.answer, subfield: fix.subfield || '综合研究', title: fix.title || fix.q, keys: fix.keys || [], ents: fix.ents || [], detail: fix.detail || '' };
        } else {
          skipped++; return;
        }
        newEntry.subfield = normalize(newEntry.subfield || '综合研究');
        newEntry.keys = newEntry.keys || [];
        newEntry.ents = newEntry.ents || [];
        newEntry.detail = newEntry.detail || '';
        newEntry.title = newEntry.title || newEntry.q;
        newEntry.q = newEntry.q || newEntry.title;
        if (!faq.find(e => e.q === newEntry.q)) {
          faq.push(newEntry);
          newEntries++; applied++;
        } else { skipped++; }
      } catch (e) { skipped++; }
      return;
    }

    const entry = faq.find(e => e.q === fix.q);
    if (!entry) { skipped++; return; }

    if (fix.action === 'enrich_answer' && fix.new_value && fix.new_value.length > (entry.answer || '').length) {
      entry.answer = fix.new_value; applied++;
    } else if (fix.action === 'add_detail' && fix.new_value && (!entry.detail || fix.new_value.length > entry.detail.length)) {
      entry.detail = fix.new_value; applied++;
    } else if (fix.action === 'add_keys' && Array.isArray(fix.new_value)) {
      const existing = new Set((entry.keys || []).map(k => k.toLowerCase()));
      const toAdd = fix.new_value.filter(k => !existing.has(String(k).toLowerCase()));
      if (toAdd.length > 0) { entry.keys = [...(entry.keys || []), ...toAdd]; applied++; }
      else skipped++;
    } else if (fix.action === 'add_ents' && Array.isArray(fix.new_value)) {
      const existing = new Set((entry.ents || []).map(e => e.toLowerCase()));
      const toAdd = fix.new_value.filter(e => !existing.has(String(e).toLowerCase()));
      if (toAdd.length > 0) { entry.ents = [...(entry.ents || []), ...toAdd]; applied++; }
      else skipped++;
    } else { skipped++; }
  });

  fs.writeFileSync(FAQ_PATH, JSON.stringify(faq, null, 2), 'utf8');
  console.log('✓ 已应用: ' + applied + ' (新条目: ' + newEntries + ', 修改: ' + (applied - newEntries) + ', 跳过: ' + skipped + ')');
}

// ===== stats: FAQ 统计（含质量报告）→ 运行时数据源 data/faq_runtime.js =====
function cmdStats() {
  console.log('=== FAQ 统计 · 运行时数据源 data/faq_runtime.js ===');
  var faq = readFAQRuntime();
  console.log('总条目: ' + faq.length);

  // 分类分布
  var dist = {};
  faq.forEach(function (e) {
    var c = normalize(e.subfield || '未分类');
    dist[c] = (dist[c] || 0) + 1;
  });
  console.log('\n分类分布:');
  var sorted = Object.entries(dist).sort(function (a, b) { return b[1] - a[1]; });
  var maxCount = sorted[0][1];
  sorted.forEach(function (pair) {
    var cat = pair[0], n = pair[1];
    var bar = '';
    var barLen = Math.round(n / maxCount * 30);
    for (var i = 0; i < barLen; i++) bar += '█';
    console.log('  ' + cat.padEnd(18) + String(n).padStart(3) + ' ' + bar);
  });

  // 统计指标
  var avgAnswerLen = Math.round(faq.reduce(function (s, e) { return s + (e.answer || '').length; }, 0) / faq.length);
  var avgKeys = Math.round(faq.reduce(function (s, e) { return s + (e.keys || []).length; }, 0) / faq.length);
  var withDetail = faq.filter(function (e) { return e.detail && e.detail.trim(); }).length;
  var shortAnswers = faq.filter(function (e) { return (e.answer || '').length < 60; }).length;
  var emptyDetail = faq.filter(function (e) { return !e.detail || !e.detail.trim(); }).length;
  var fewKeys = faq.filter(function (e) { return (e.keys || []).length < 3; }).length;

  console.log('\n=== 数据质量 ===');
  console.log('平均答案长度: ' + avgAnswerLen + ' 字');
  console.log('平均关键词: ' + avgKeys + ' 个');
  console.log('含 detail: ' + withDetail + '/' + faq.length +
    ' (' + Math.round(withDetail / faq.length * 100) + '%)');
  console.log('短答案 (<60字): ' + shortAnswers + '/' + faq.length +
    ' (' + Math.round(shortAnswers / faq.length * 100) + '%)');
  console.log('缺 detail: ' + emptyDetail + '/' + faq.length +
    ' (' + Math.round(emptyDetail / faq.length * 100) + '%)');
  console.log('关键词 <3: ' + fewKeys + '/' + faq.length +
    ' (' + Math.round(fewKeys / faq.length * 100) + '%)');

  // 需要关注的条目
  console.log('\n=== 需要关注的条目 ===');
  console.log('(缺detail | 答案<60字)\n');

  var needsAttention = faq.map(function (e, i) {
    var issues = [];
    if (!e.detail || !e.detail.trim()) issues.push('缺detail');
    if ((e.answer || '').length < 60) issues.push('答案' + (e.answer || '').length + '字');
    return { index: i, entry: e, issues: issues };
  }).filter(function (x) { return x.issues.length > 0; });

  needsAttention.slice(0, 30).forEach(function (item) {
    var entry = item.entry;
    var title = (entry.title || entry.q || '?').slice(0, 50);
    console.log('  [' + (item.index + 1) + '] ' + title + ' → ' + item.issues.join(', '));
  });
  if (needsAttention.length > 30) {
    console.log('  ... 还有 ' + (needsAttention.length - 30) + ' 条');
  }
  console.log('\n总计需关注: ' + needsAttention.length + ' 条');
}

// ===== sync-kg: 同步 FAQ 数据到知识图谱 =====
function cmdSyncKG() {
  console.log('=== 知识图谱同步 (FAQ → KG) ===');
  var faq = readJSON(FAQ_PATH);
  var kgPath = path.join(BASE, 'data', 'kg.json');
  var kg = readJSON(kgPath);

  // 计算每个知识方向的 FAQ 数量
  var catToDirection = {
    '合成制备': 'coord',
    '反应原理': 'redox',
    '实验操作': 'analytical',
    '分析测定': 'analytical',
    '光化学应用': 'physical',
    '结构表征': 'physical',
    '磁性研究': 'physical',
    '热分析': 'physical',
    '安全与废物处理': 'analytical',
    '配位化学理论': 'coord',
    '实验教学': 'coord',
    '综合研究': 'coord',
    '化学史': 'coord',
    '高等理论': 'physical',
    '蓝晒工艺': 'physical',
    '摩尔盐相关': 'redox',
    '草酸配合物': 'coord'
  };

  var dirStats = {
    coord: { faqCount: 0, total: 0 },
    redox: { faqCount: 0, total: 0 },
    analytical: { faqCount: 0, total: 0 },
    physical: { faqCount: 0, total: 0 }
  };

  faq.forEach(function (e) {
    var dir = catToDirection[normalize(e.subfield || '综合研究')] || 'coord';
    if (dirStats[dir]) dirStats[dir].faqCount++;
    dirStats[dir].total++;
  });

  // 更新知识图谱节点
  var now = new Date().toISOString();
  var nodes = kg.nodes || [];
  var updatedCount = 0;

  nodes.forEach(function (node) {
    var stats = dirStats[node.id];
    if (stats && node.category !== 'center') {
      node.faqCount = stats.faqCount;
      node.updatedAt = now;
      updatedCount++;
      console.log('  ' + node.name + ': ' + stats.faqCount + ' 条FAQ');
    }
    // 也更新中心节点
    if (node.id === 'center-exp') {
      node.faqCount = faq.length;
      node.updatedAt = now;
    }
  });

  fs.writeFileSync(kgPath, JSON.stringify(kg, null, 1), 'utf8');
  console.log('');
  console.log('✓ 已更新 ' + updatedCount + ' 个方向的 FAQ 统计');
  console.log('  中心节点: ' + faq.length + ' 条FAQ');
  console.log('  时间戳: ' + now);
}

// ===== MAIN =====
// DEPRECATED since v31: 'sync' and 'add' removed — assistant.html loads FAQ via fetch()
const cmd = process.argv[2];
switch (cmd) {
  case 'merge':        cmdMerge(); break;
  case 'refine':       cmdRefine(); break;
  case 'apply-fixes':  cmdApplyFixes(process.argv[3]); break;
  case 'stats':        cmdStats(); break;
  case 'sync-kg':      cmdSyncKG(); break;
  default:
    console.log('ChemAI FAQ 统一管理工具');
    console.log('');
    console.log('用法: node faq_tools.js <命令> [参数]');
    console.log('');
    console.log('命令:');
    console.log('  merge             合并 faq_auto.json + faq_auto_fixed.json');
    console.log('  refine            精炼 FAQ: 自动分类 + 质量检查');
    console.log('  apply-fixes <file> 从工作流输出提取并应用修复');
    console.log('  stats             显示 FAQ 统计信息（含质量报告）');
    console.log('  sync-kg           同步 FAQ 数据到知识图谱节点');
    process.exit(1);
}
