'use strict';
/**
 * v43 步骤：为新条目补短学术词 keys → 并入词表 → 生成 manifest 应用回 assistant.html
 */
const fs = require('fs');
const path = require('path');
const { readFAQRuntime, writeFAQRuntime, applyManifestToArray } = require('./lib-assistant-faq.js');

const ENTRY_FILE = path.join(__dirname, '..', 'Agent工作区', 'Agent-报告', 'v43_new_entries.json');
const LEX_FILE = path.join(__dirname, '..', 'data', 'academic_lexicon.json');
const HTML = path.join(__dirname, '..', 'assistant.html');

function readJson(fp) {
  let r = fs.readFileSync(fp, 'utf8');
  if (r.charCodeAt(0) === 0xFEFF) r = r.slice(1);
  return JSON.parse(r);
}

// 按标题覆盖 keys（只补短学术词变体，不动其他字段）
const KEY_FIXES = {
  '草酸根离子的平面性': ['草酸根', '平面', '扭转', '平面性', '构型', '双齿配体', '螯合环', '晶体结构'],
  '碘化物水溶液的光化学氧化实验': ['碘化钾', '碘化物', '光氧化', '光化学氧化', '闪光光解', '动力学', '瞬态光谱'],
  '闪光光解法在教学中的应用': ['闪光光解', '闪光', '光解', '瞬态光谱', '时间分辨光谱', '动力学', '自由基'],
  '光诱导电子转移与激发态氧化还原': ['电子转移', '光诱导电子转移', '激发态', '激发态氧化还原', '电荷转移', 'LMCT', '配离子'],
  '三草酸合铁(III)酸钾的多功能教学应用': ['教学应用', '教学', '三草酸合铁酸钾', '化学平衡', '逐级解离', '配离子分布', '多功能'],
  '二草酸合铜(II)酸钾的化学式书写': ['化学式', '二草酸合铜', '草酸铜', '配位数', '双齿配体', '配离子', '组成'],
  '二草酸合铜(II)酸钾的组成测定': ['组成测定', '二草酸合铜', '含量测定', '经验式', '草酸根', '铜含量', '定量'],
  '镉(II)草酸配合物的合成与结构': ['草酸镉', '镉配合物', '合成', '晶体结构', 'X射线衍射', '配位模式', '草酸配合物'],
  '铁与铬草酸配合物的热分析动力学': ['热分析', '热重分析', '非等温动力学', '分解温度', '草酸铬', '草酸铁', '分解'],
  '草酸桥联双核铜配合物的合成': ['双核配合物', '双核', '桥联配体', '桥联', '草酸根', '配位模式', '合成', '转化'],
  '莫尔盐的摩尔电导率与复盐本质': ['摩尔电导率', '摩尔电导', '电导率', '电导', '复盐', '电解质', '硫酸亚铁铵', '电离'],
  '莫尔盐作为分析化学测试材料': ['测试材料', '分析化学', '基准物质', '含量测定', '莫尔盐', '标准溶液', '标定'],
  '巧制硫酸亚铁铵晶体的结晶技术': ['结晶', '蒸发浓缩', '冷却结晶', '晶膜', '大晶体', '晶形', '硫酸亚铁铵', '过饱和度']
};

function main() {
  // 1. 修补 entries
  const entries = readJson(ENTRY_FILE);
  let patched = 0;
  for (const e of entries) {
    if (KEY_FIXES[e.title]) { e.keys = KEY_FIXES[e.title]; patched++; }
  }
  fs.writeFileSync(ENTRY_FILE, JSON.stringify(entries, null, 2), 'utf8');

  // 2. 并入词表（缺失词自动加入对应 subfield）
  const lex = readJson(LEX_FILE);
  let added = 0;
  for (const e of entries) {
    const b = lex.subfields[e.subfield];
    if (!b) continue;
    for (const k of e.keys || []) {
      if (!b.canonical_terms.includes(k)) { b.canonical_terms.push(k); added++; }
    }
    for (const k of e.ents || []) {
      if (!b.entity_terms.includes(k)) { b.entity_terms.push(k); added++; }
    }
  }
  fs.writeFileSync(LEX_FILE, JSON.stringify(lex, null, 2), 'utf8');

  // 3. 应用回 data/faq_runtime.js（按标题匹配，防误改；本脚本为 v43 一次性工具）
  const faq = readFAQRuntime();
  const changes = [];
  for (const e of entries) {
    const idx = faq.findIndex(f => f.title === e.title);
    if (idx < 0) { console.error('❌ 未找到标题匹配条目(数据已变化, 本脚本为 v43 一次性工具):', (e.title || '').slice(0, 24)); process.exit(1); }
    if (JSON.stringify(faq[idx].keys || []) !== JSON.stringify(e.keys)) changes.push({ index: idx, new_keys: e.keys });
  }
  if (!changes.length) { console.log('无需应用(keys 已一致)'); return; }
  const after = applyManifestToArray(faq, changes);
  if (after.length !== faq.length) { console.error('条目数变化!'); process.exit(1); }
  writeFAQRuntime(after);

  console.log('修补条目: ' + patched + ' | 词表新增: ' + added);
  console.log('FAQ: ' + faq.length + ' → ' + after.length + ' | 已应用短词 keys');
}

main();
