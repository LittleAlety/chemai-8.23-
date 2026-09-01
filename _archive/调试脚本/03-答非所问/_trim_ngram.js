'use strict';
const faqLib = require('./scripts/lib-assistant-faq.js');
const fs = require('fs'), path = require('path');
const arr = faqLib.readFAQRuntime();

// 仅删"机械滑窗"key（同一长句的任意位置子串），保留主题性短语 key
const PLAN = {
  1345: ['成feco2h', 'eco2ho时', '求加热至微沸并', '加热至微沸并保', '热至微沸并保持', '至微沸并保持4'],
  1403: ['光敏物质lmc', '敏物质lmct', '物质lmct光', '质lmct光解', '成fe纯度检验', 'fe纯度检验时'],
  1720: ['第二步氧化中讲', '二步氧化中讲义', '步氧化中讲义规', '氧化中讲义规定', '化中讲义规定6', '中讲义规定6h'],
  1557: ['第四步结晶时讲', '四步结晶时讲义', '95乙醇约10', '5乙醇约10m', '乙醇约10ml', '醇约10ml作'],
};

let total = 0;
Object.keys(PLAN).forEach(idxStr => {
  const idx = +idxStr;
  const before = (arr[idx].keys || []).length;
  const kept = (arr[idx].keys || []).filter(k => !PLAN[idxStr].includes(k));
  const removed = before - kept.length;
  arr[idx].keys = kept;
  total += removed;
  console.log('#idx' + idx + ' "' + arr[idx].title.slice(0, 30) + '" keys ' + before + '->' + kept.length + ' (删' + removed + ')');
});
console.log('共删 ' + total + ' 个滑窗 key');
const bak = faqLib.FAQRUNTIME + '.bak_ngram2_' + Date.now();
fs.copyFileSync(faqLib.FAQRUNTIME, bak);
console.log('备份: ' + bak);
faqLib.writeFAQRuntime(arr);
console.log('已写回');
