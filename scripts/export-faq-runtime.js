#!/usr/bin/env node
/* 一次性迁移：把 assistant.html 内嵌的 const FAQ=[...] 字面量原样导出为 data/faq_runtime.js
 * （window.FAQ=[...]），供 loadFAQ() 异步注入（借鉴 v37.6：动态加载减小首屏体积；内嵌数据仍是唯一真相源）。
 * 注意：保留 JS 字面量而非转 JSON —— JSON 键加引号会使文件膨胀到 3.5MB 以上，JS 字面量维持 1.6MB 不倒退。
 *
 * 用法：node scripts/export-faq-runtime.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "assistant.html");
const DST = path.join(ROOT, "data", "faq_runtime.js");

const text = fs.readFileSync(SRC, "utf8");
const startTok = "const FAQ=[";
const si = text.indexOf(startTok);
if (si < 0) throw new Error("未找到 const FAQ=[");

/* 字符串感知地定位外数组的收尾 ]（数据内化学式如 K₃[Fe(C₂O₄)₃] 含 ASCII 方括号） */
let depth = 1, inStr = null, esc = false, end = -1;
for (let i = si + startTok.length; i < text.length; i++) {
  const c = text[i];
  if (inStr) {
    if (esc) esc = false;
    else if (c === "\\") esc = true;
    else if (c === inStr) inStr = null;
    continue;
  }
  if (c === "'" || c === '"') { inStr = c; continue; }
  if (c === "[") depth++;
  else if (c === "]") { depth--; if (depth === 0) { end = i; break; } }
}
if (end < 0) throw new Error("未找到 const FAQ=[ 的收尾 ]");

const arrText = text.slice(si + startTok.length, end);   // 外层 [ ] 之间的内容
const arr = new Function("return ([" + arrText + "]);")();
if (!Array.isArray(arr)) throw new Error("FAQ 字面量解析后不是数组");

/* 校验：条目数与唯一 q */
const uniq = new Set(arr.map(e => e && e.q));
console.log(`内嵌 FAQ 条数：${arr.length}，唯一 q：${uniq.size}`);
if (uniq.size !== arr.length) console.warn(`⚠ 存在重复 q：${arr.length - uniq.size} 条`);

/* 字段完整性统计 */
const fieldMiss = {};
for (const e of arr) for (const k of ["q", "answer", "subfield", "keys", "ents", "detail", "title", "knode"]) {
  if (e[k] === undefined) fieldMiss[k] = (fieldMiss[k] || 0) + 1;
}
console.log("字段缺失：", Object.keys(fieldMiss).length ? fieldMiss : "无");

/* 原样导出为 JS 字面量（window.FAQ=[...]） */
fs.writeFileSync(DST, "window.FAQ=[" + arrText + "];\n", "utf8");
console.log(`已导出 ${DST}（${(fs.statSync(DST).size / 1024 / 1024).toFixed(2)} MB）`);
