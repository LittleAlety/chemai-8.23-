'use strict';
/**
 * v43 全量结构校验：从 assistant.html 提取 FAQ，复用 scripts/validate-faq.js 的校验逻辑。
 * 用法: node scripts/validate-assistant-faq.js
 */

const path = require('path');
const { readHTML, parseFAQ } = require('./lib-assistant-faq.js');
const { validateFAQArray, CAT_SET } = require('./validate-faq.js');

function main() {
  const faq = parseFAQ(readHTML());
  const report = validateFAQArray(faq);

  // subfield 非法统计（运行版允许历史分类，仅提示）
  const nonCanonical = {};
  faq.forEach(f => {
    const sf = f.subfield;
    if (sf && !CAT_SET.has(sf)) nonCanonical[sf] = (nonCanonical[sf] || 0) + 1;
  });

  console.log('=== assistant.html FAQ 全量校验 ===');
  console.log('总数: ' + report.total + ' | 有效: ' + report.valid + ' | 有错误: ' + report.invalid);
  console.log('缺少 detail: ' + report.missingDetail + ' | 短答案(<60字): ' + report.shortAnswers + ' | 无关键词: ' + report.noKeys);
  console.log('错误数: ' + report.errors.length + ' | 警告数: ' + report.warnings.length);
  if (Object.keys(nonCanonical).length) {
    console.log('非规范 subfield（仅提示，历史分类）: ' + JSON.stringify(nonCanonical));
  }

  report.errors.slice(0, 15).forEach(e => console.log('  ❌ ' + e));
  if (report.errors.length > 15) console.log('  ... 还有 ' + (report.errors.length - 15) + ' 条错误');
  report.warnings.slice(0, 10).forEach(w => console.log('  ⚠ ' + w));

  if (report.invalid > 0 || report.errors.length) process.exit(1);
  console.log('✓ 全量校验通过（0 错误）');
}

main();
