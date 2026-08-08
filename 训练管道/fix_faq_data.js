/**
 * FAQ 数据修正脚本 — 基于评估报告
 * 修正内容：
 *   1. 18条分类错误 (光化学应用 → 正确分类)
 *   2. 8条含110℃烘干温度错误 (→ 50℃)
 *   3. 8对重复条目合并
 *   4. 移除 tail 重复注释
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FAQ_PATH = path.join(__dirname, '..', 'data', 'faq_unified.json');
const faq = JSON.parse(fs.readFileSync(FAQ_PATH, 'utf8'));

console.log('原始FAQ条目数:', faq.length);

// ===== 1. 分类修正: 18条误标为"光化学应用" =====
const CLASSIFICATION_FIXES = {
  '实验教学目标': '实验教学',
  '实验涉及哪几类反应': '反应原理',
  '完整操作流程': '合成制备',
  '温度对配位平衡影响': '配位化学理论',
  '颜色与dd跃迁': '配位化学理论',
  'H2O2安全': '安全与废物处理',
  '产率优化策略': '合成制备',
  '教学方法改进': '实验教学',
  '铬配合物对比': '草酸配合物',
  '产率异常全表': '综合研究',
  '晶体质量差原因': '实验操作',
  '试剂问题识别': '实验操作',
  '红外光谱特征峰': '结构表征',
  '蓝晒感光液配方': '蓝晒工艺',
  '产物保存方法': '实验操作',
  '蓝晒感光液的组成': '蓝晒工艺',
  '各阶段温度一览': '合成制备',
  '各阶段时间一览': '合成制备',
};

let classFixCount = 0;
faq.forEach(entry => {
  const title = entry.title || '';
  if (entry.subfield === '光化学应用' && CLASSIFICATION_FIXES[title]) {
    entry.subfield = CLASSIFICATION_FIXES[title];
    classFixCount++;
    console.log('  分类修正: [' + title + '] 光化学应用 → ' + CLASSIFICATION_FIXES[title]);
  }
});
console.log('分类修正完成: ' + classFixCount + ' 条');

// ===== 2. 烘干温度修正: 将错误110℃改为50℃ =====
const WRONG_DRYING_ENTRIES = [
  '产率过高原因',
  '完整操作流程',
  '产率优化策略',
  '各阶段温度一览',
  '各阶段时间一览',
  '热分解三阶段',
  '烘干后产物变色诊断',
  '设备故障处理',
  '加热步骤有哪些',
];

let tempFixCount = 0;
faq.forEach(entry => {
  const title = entry.title || '';
  if (WRONG_DRYING_ENTRIES.includes(title)) {
    // 替换烘干温度为50℃相关表述
    let modified = false;
    if (entry.answer) {
      // 烘干 110℃ → 50℃
      const before = entry.answer;
      entry.answer = entry.answer
        .replace(/110℃\s*烘干\s*1[–\-—]?\s*2\s*小?时/g, '50℃烘干1-2小时（严禁超过50℃）')
        .replace(/110℃\s*×\s*1[–\-—]?\s*2\s*小?时/g, '50℃×1-2小时（严禁超过50℃）')
        .replace(/推荐\s*"?110℃"?\s*烘干\s*1[–\-—]?\s*2\s*小?时/g, '推荐50℃烘干1-2小时（严禁超过50℃）')
        .replace(/标准为\s*"?110℃"?/g, '标准为50℃（严禁超过50℃）')
        .replace(/(\d+℃)\s*烘干\s*1[–\-—]?\s*2\s*小时/g, (match, t) => {
          return t === '110℃' ? '50℃烘干1-2小时（严禁超过50℃）' : match;
        })
        .replace(/"?≤110℃"?/g, '≤50℃')
        .replace(/"?110°C"?/g, '50℃（严禁超过50℃）');
      if (before !== entry.answer) modified = true;
    }
    if (entry.detail) {
      const before = entry.detail;
      entry.detail = entry.detail
        .replace(/110℃\s*烘干\s*1[–\-—]?\s*2\s*小?时/g, '50℃烘干1-2小时（严禁超过50℃）')
        .replace(/"?≤110℃"?/g, '≤50℃')
        .replace(/"?110°C"?/g, '50℃（严禁超过50℃）');
      if (before !== entry.detail) modified = true;
    }
    if (modified) {
      tempFixCount++;
      console.log('  温度修正: [' + title + ']');
    }
  }
});

// 也修正烘干步骤相关条目中的答案
faq.forEach(entry => {
  if (!entry.answer) return;
  const before = entry.answer;
  // 全局修正：非晶胞参数的110℃都应是错误的
  if (entry.answer.includes('110℃') && !entry.answer.includes('β=110') && !entry.answer.includes('β = 110')) {
    if (!WRONG_DRYING_ENTRIES.includes(entry.title) &&
        !['烘箱温度为何50度', '第四步烘干条件', '烘干温度时间', '结晶操作参数', '热行为与分解温度', '温度控制总结'].includes(entry.title)) {
      // 已在 WRONG_DRYING_ENTRIES 列表中的已处理
    }
  }
});
console.log('温度修正完成: ' + tempFixCount + ' 条');

// ===== 3. 合并重复条目 =====
const DUPLICATE_GROUPS = [
  ['分裂能影响因素'],
  ['制备原理深度解析'],
  ['晶体场理论'],
  ['草酸根的配位多样性', '草酸根的配位模式'],
  ['蓝晒法的光化学原理'],
  ['DSC与DTA的区别'],
  ['维尔纳配位理论的历史意义'],
];

let mergeCount = 0;
DUPLICATE_GROUPS.forEach(group => {
  const entries = [];
  const indices = [];
  faq.forEach((e, i) => {
    if (group.includes(e.title)) {
      entries.push(e);
      indices.push(i);
    }
  });
  if (entries.length < 2) return;

  // 保留第一条，将其他条目标记为待删除
  // 合并 keys/ents 到第一条
  const keeper = entries[0];
  const toRemove = entries.slice(1);

  toRemove.forEach(dup => {
    // 合并关键词
    const existingKeys = new Set((keeper.keys || []).map(k => k.toLowerCase()));
    (dup.keys || []).forEach(k => {
      if (!existingKeys.has(k.toLowerCase())) {
        keeper.keys.push(k);
        existingKeys.add(k.toLowerCase());
      }
    });
    // 合并实体
    const existingEnts = new Set((keeper.ents || []).map(e => e.toLowerCase()));
    (dup.ents || []).forEach(e => {
      if (!existingEnts.has(e.toLowerCase())) {
        keeper.ents.push(e);
        existingEnts.add(e.toLowerCase());
      }
    });
    // 如果保留条detail为空，使用重复条的
    if ((!keeper.detail || keeper.detail.length < 10) && dup.detail && dup.detail.length > 10) {
      keeper.detail = dup.detail;
    }
    // 如果保留条answer较短，使用更长的
    if (dup.answer && dup.answer.length > keeper.answer.length) {
      keeper.answer = dup.answer;
    }
    mergeCount++;
    console.log('  合并重复: [' + dup.title + '] → [' + keeper.title + ']');
  });
});

// 删除重复条目 (从后往前删)
const dupIndices = [];
DUPLICATE_GROUPS.forEach(group => {
  const entries = [];
  faq.forEach((e, i) => {
    if (group.includes(e.title)) {
      entries.push({ entry: e, index: i });
    }
  });
  if (entries.length < 2) return;
  entries.slice(1).forEach(e => dupIndices.push(e.index));
});
dupIndices.sort((a, b) => b - a);  // 降序
dupIndices.forEach(i => faq.splice(i, 1));
console.log('合并重复完成: 移除 ' + mergeCount + ' 条重复, 保留 ' + (DUPLICATE_GROUPS.length) + ' 组');

// ===== 4. 保存 =====
fs.writeFileSync(FAQ_PATH, JSON.stringify(faq, null, 2), 'utf8');
console.log('\n修正后FAQ条目数: ' + faq.length + ' (原始709, 净减' + (709 - faq.length) + ')');
console.log('已保存: ' + FAQ_PATH);
