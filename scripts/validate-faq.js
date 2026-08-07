/**
 * ChemAI FAQ 条目结构校验
 *
 * 用法:
 *   node scripts/validate-faq.js [文件路径]
 *   (默认校验 data/faq_unified.json)
 */

'use strict';
const fs = require('fs');
const path = require('path');

const FAQ_PATH = process.argv[2] || path.join(__dirname, '..', 'data', 'faq_unified.json');

function readJSON(fp) {
  let r = fs.readFileSync(fp, 'utf8');
  if (r.charCodeAt(0) === 0xFEFF) r = r.slice(1);
  return JSON.parse(r);
}

const CANONICAL_CATS = [
  '合成制备', '反应原理', '实验操作', '分析测定',
  '光化学应用', '结构表征', '磁性研究', '热分析',
  '安全与废物处理', '配位化学理论', '实验教学', '综合研究',
  '化学史', '高等理论', '蓝晒工艺', '摩尔盐相关', '草酸配合物'
];
const CAT_SET = new Set(CANONICAL_CATS);

/**
 * 校验单个 FAQ 条目
 * @returns {{ errors: string[], warnings: string[] }}
 */
function validateFAQEntry(entry, index) {
  const errors = [];
  const warnings = [];
  const prefix = '[' + index + '] ';

  // 必填字段
  if (!entry.q || String(entry.q).trim().length === 0) {
    errors.push(prefix + '缺少必填字段: q');
  }
  if (!entry.title || String(entry.title).trim().length === 0) {
    errors.push(prefix + '缺少必填字段: title');
  }
  if (!entry.answer || String(entry.answer).trim().length === 0) {
    errors.push(prefix + '缺少必填字段: answer');
  }
  if (!entry.subfield || String(entry.subfield).trim().length === 0) {
    errors.push(prefix + '缺少必填字段: subfield');
  }

  // 答案长度
  if (entry.answer && entry.answer.length < 20) {
    errors.push(prefix + '答案过短 (< 20 字): ' + entry.answer.length + '字');
  } else if (entry.answer && entry.answer.length < 60) {
    warnings.push(prefix + '答案较短 (< 60 字): ' + entry.answer.length + '字 — "' +
      entry.answer.slice(0, 50) + '"');
  }

  // detail 缺失
  if (!entry.detail || String(entry.detail).trim().length === 0) {
    warnings.push(prefix + '缺少 detail（' + (entry.title || entry.q || '?') + '）');
  }

  // 关键词数量
  if (!entry.keys || entry.keys.length < 1) {
    errors.push(prefix + '至少需要 1 个关键词');
  } else if (entry.keys.length < 3) {
    warnings.push(prefix + '关键词较少 (' + entry.keys.length + '个): ' +
      JSON.stringify(entry.keys));
  }

  // subfield 有效性
  if (entry.subfield && !CAT_SET.has(entry.subfield)) {
    warnings.push(prefix + '分类不在权威列表中: ' + entry.subfield);
  }

  // q 和 title 一致性
  if (entry.q && entry.title && entry.q !== entry.title) {
    // q 和 title 不同是正常的（q 可能是长问题，title 是简短标签）
    // 但如果两个完全相同且都很短，发出提醒
    if (entry.q.length < 10 && entry.title.length < 10 && entry.q === entry.title) {
      warnings.push(prefix + 'q 和 title 相同且很短');
    }
  }

  return { errors, warnings };
}

/**
 * 校验整个 FAQ 数组
 * @returns {{
 *   total: number, valid: number, invalid: number,
 *   errors: string[], warnings: string[],
 *   missingDetail: number, shortAnswers: number, noKeys: number,
 *   catDistribution: object
 * }}
 */
function validateFAQArray(faq) {
  const result = {
    total: faq.length,
    valid: 0,
    invalid: 0,
    errors: [],
    warnings: [],
    missingDetail: 0,
    shortAnswers: 0,
    noKeys: 0,
    catDistribution: {}
  };

  faq.forEach(function (entry, i) {
    // 分类统计
    var cat = entry.subfield || '(未分类)';
    result.catDistribution[cat] = (result.catDistribution[cat] || 0) + 1;

    // 质量统计
    if (!entry.detail || String(entry.detail).trim().length === 0) result.missingDetail++;
    if (!entry.answer || entry.answer.length < 60) result.shortAnswers++;
    if (!entry.keys || entry.keys.length < 1) result.noKeys++;

    // 详细校验
    var report = validateFAQEntry(entry, i + 1);
    result.errors.push.apply(result.errors, report.errors);
    result.warnings.push.apply(result.warnings, report.warnings);

    if (report.errors.length === 0) {
      result.valid++;
    } else {
      result.invalid++;
    }
  });

  return result;
}

// ===== MAIN =====
if (require.main === module) {
  if (!fs.existsSync(FAQ_PATH)) {
    console.error('文件不存在: ' + FAQ_PATH);
    process.exit(1);
  }

  var faq = readJSON(FAQ_PATH);
  var report = validateFAQArray(faq);

  console.log('=== FAQ 校验报告 ===');
  console.log('');
  console.log('文件: ' + path.basename(FAQ_PATH));
  console.log('总数: ' + report.total + ' | 有效: ' + report.valid + ' | 有错误: ' + report.invalid);
  console.log('');

  console.log('=== 数据质量 ===');
  var pct;
  pct = report.total > 0 ? Math.round(report.missingDetail / report.total * 100) : 0;
  console.log('缺少 detail: ' + report.missingDetail + '/' + report.total + ' (' + pct + '%)');
  pct = report.total > 0 ? Math.round(report.shortAnswers / report.total * 100) : 0;
  console.log('短答案(<60字): ' + report.shortAnswers + '/' + report.total + ' (' + pct + '%)');
  pct = report.total > 0 ? Math.round(report.noKeys / report.total * 100) : 0;
  console.log('无关键词: ' + report.noKeys + '/' + report.total + ' (' + pct + '%)');
  console.log('');

  console.log('=== 分类分布 ===');
  var cats = Object.entries(report.catDistribution).sort(function (a, b) {
    return b[1] - a[1];
  });
  cats.forEach(function (pair) {
    var bar = '';
    var maxBar = 40;
    var maxCount = cats[0][1];
    var len = Math.round(pair[1] / maxCount * maxBar);
    for (var i = 0; i < len; i++) bar += '█';
    console.log('  ' + (pair[0] + ':').padEnd(18) + String(pair[1]).padStart(3) + ' ' + bar);
  });

  console.log('');
  console.log('=== 错误 (' + report.errors.length + '条) ===');
  report.errors.slice(0, 20).forEach(function (e) {
    console.log('  ❌ ' + e);
  });
  if (report.errors.length > 20) {
    console.log('  ... 还有 ' + (report.errors.length - 20) + ' 条错误');
  }

  console.log('');
  console.log('=== 警告 (' + report.warnings.length + '条) ===');
  report.warnings.slice(0, 20).forEach(function (w) {
    console.log('  ⚠ ' + w);
  });
  if (report.warnings.length > 20) {
    console.log('  ... 还有 ' + (report.warnings.length - 20) + ' 条警告');
  }

  if (report.invalid > 0) {
    console.log('');
    console.log('⚠ 存在 ' + report.invalid + ' 条无效条目，请修复后重新运行。');
    process.exit(1);
  } else {
    console.log('');
    console.log('✓ 所有条目校验通过。');
  }
}

module.exports = { validateFAQEntry, validateFAQArray, CANONICAL_CATS, CAT_SET };
