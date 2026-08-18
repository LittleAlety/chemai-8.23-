#!/usr/bin/env node
/* 运行时 FAQ 健康检查（原为"一次性迁移"导出脚本，v37.6+ FAQ 外置后已由
 * scripts/lib-assistant-faq.js 的 readFAQRuntime/writeFAQRuntime 直接读写 data/faq_runtime.js，
 * 本脚本保留其校验价值，改为对 data/faq_runtime.js 做完整性/重复性体检）。
 *
 * 用法：node scripts/export-faq-runtime.js
 * 退出码：0 = 正常；1 = 存在重复 q 或关键字段缺失（可配 --strict 视为失败）
 */
"use strict";
const path = require("path");
const { readFAQRuntime } = require("./lib-assistant-faq.js");

const STRICT = process.argv.includes("--strict");
const REQUIRED = ["q", "answer", "subfield", "keys", "ents", "detail", "title", "knode"];

const arr = readFAQRuntime();

if (!Array.isArray(arr)) { console.error("❌ data/faq_runtime.js 解析结果不是数组"); process.exit(1); }

/* 条数与唯一 q */
const uniq = new Set(arr.map(e => e && e.q));
const dupCount = arr.length - uniq.size;
console.log(`✅ 运行时 FAQ 条数：${arr.length}，唯一 q：${uniq.size}${dupCount ? `，⚠ 重复 q：${dupCount} 条` : ""}`);

/* 字段完整性统计 */
const fieldMiss = {};
for (const e of arr) for (const k of REQUIRED) {
  if (e[k] === undefined) fieldMiss[k] = (fieldMiss[k] || 0) + 1;
}
console.log("字段缺失：", Object.keys(fieldMiss).length ? fieldMiss : "无");

/* keys/ents 应为数组且非空（检索依赖） */
const noKeys = arr.filter(e => !Array.isArray(e.keys) || !e.keys.length).length;
const noEnts = arr.filter(e => !Array.isArray(e.ents)).length;
if (noKeys) console.log(`⚠ 无 keys 的条目：${noKeys} 条（将无法被 matchFAQ 命中）`);
if (noEnts) console.log(`⚠ 无 ents 数组的条目：${noEnts} 条`);

const problems = dupCount + Object.keys(fieldMiss).length + noKeys;
if (STRICT && problems > 0) {
  console.error(`❌ 严格模式：共 ${problems} 处问题`);
  process.exit(1);
}
console.log(problems ? "⚠ 发现可修复问题（正常运行不受影响，建议排查）" : "✅ 健康检查通过");
process.exit(problems && STRICT ? 1 : 0);
