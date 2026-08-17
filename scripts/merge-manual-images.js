#!/usr/bin/env node
/* 一次性迁移：把源仓库 manual.json 各小节的 images 元数据合并进目标 manual.json。
 * 目标文件采用「深层缩进」格式（键 4 空格起、数组元素 +16、对象内键再 +4，与 corpus.json 一致），
 * 本脚本用字节级精确插入保留其余字节不动，缩进常量从文件实测推导。
 *
 * 用法：node scripts/merge-manual-images.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.resolve(ROOT, "..", "新建文件夹", "version7-25", "version7-25", "data", "manual.json");
const DST = path.join(ROOT, "data", "manual.json");

/* ---------- 1. 从源解析 sectionId -> images[] ---------- */
const src = JSON.parse(fs.readFileSync(SRC, "utf8"));
const imgMap = new Map();
for (const ch of src.chapters || []) {
  for (const s of ch.sections || []) {
    if (Array.isArray(s.images) && s.images.length) imgMap.set(s.id, s.images);
  }
}
console.log(`源带图小节：${imgMap.size} 个，共 ${[...imgMap.values()].reduce((a, b) => a + b.length, 0)} 条`);

/* ---------- 2. 读取目标文本 ---------- */
const dst = fs.readFileSync(DST, "utf8");

/* ---------- 3. 推导缩进常量（从文件实测，约定：数组元素=键缩进+17，对象内键=元素+4） ---------- */
function leadingWs(line) { const m = line.match(/^[ \t]*/); return m ? m[0] : ""; }
const lines = dst.split("\n");
function lineIndexOf(sub, from) {
  for (let i = from || 0; i < lines.length; i++) if (lines[i].includes(sub)) return i;
  return -1;
}
const chKeyLine = lineIndexOf('"chapters":');
const secKeyLine = lineIndexOf('"sections":');
if (chKeyLine < 0 || secKeyLine < 0) throw new Error("无法在目标 manual.json 定位 chapters/sections 行");
const kCh = leadingWs(lines[chKeyLine]).length;                  // "chapters" 键缩进（4）
const eCh = leadingWs(lines[chKeyLine + 1]).length;              // chapters 数组元素 { 缩进（21）
const arrayElemOffset = eCh - kCh;                               // 数组元素相对键的偏移（17）
const kSec = leadingWs(lines[secKeyLine]).length;                // "sections" 键缩进（= 章节属性缩进，25）
const propOffset = kSec - eCh;                                   // 对象内键相对元素缩进（4）
const idAfterSec = lineIndexOf('"id":', secKeyLine + 1);         // 第一个小节 "id" 行
if (idAfterSec < 0) throw new Error("未找到小节 id 行");
const P_sec = leadingWs(lines[idAfterSec]).length;               // 小节属性缩进（46）
console.log(`实测：键缩进 ${kCh}，数组元素偏移 +${arrayElemOffset}，对象内键偏移 +${propOffset}，小节属性缩进 ${P_sec}`);
if (arrayElemOffset < 1 || propOffset < 1) throw new Error("缩进推导异常，中止");

/* ---------- 4. 逐节定位并插入 images ---------- */
/* 字符串感知的括号匹配：跳过 JSON 字符串内的 { }，避免 content 里的公式大括号干扰 */
function findSectionObjEnd(idValue, haystack, fromPos) {
  const m = haystack.indexOf(`"${idValue}"`, fromPos);
  if (m < 0) throw new Error(`目标文件中未找到小节 id: ${idValue}`);
  const open = haystack.lastIndexOf("{", m);
  let depth = 0, inStr = false, esc = false;
  for (let i = open; i < haystack.length; i++) {
    const c = haystack[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return i; }
  }
  throw new Error(`小节 ${idValue} 括号未闭合`);
}
function fmtImages(arr) {
  // 序列化 images 数组，遵循目标深层缩进约定
  const P = " ".repeat(P_sec);
  const E = " ".repeat(P_sec + arrayElemOffset);
  const IP = " ".repeat(P_sec + arrayElemOffset + propOffset);
  const parts = arr.map(function (im) {
    const props = [`${IP}"file":  ${JSON.stringify(im.file)}`, `${IP}"caption":  ${JSON.stringify(im.caption || "")}`];
    if (im.big) props.push(`${IP}"big":  true`);
    return `${E}{\n${props.join(",\n")}\n${E}}`;
  });
  return `${P}"images":  [\n${parts.join(",\n")}\n${P}]`;
}

const EOL = dst.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
let out = dst, merged = 0, skipped = 0;
for (const [sid, arr] of imgMap) {
  const i = findSectionObjEnd(sid, out, 0);            // i = 小节收尾 } 的位置（id 唯一，从 0 搜索）
  if (out.lastIndexOf('"images"', i) > out.lastIndexOf('"id":', i)) { skipped++; continue; } // 幂等：已有 images
  // 逗号挂到小节最后一个值（formulas 数组的 ]）行末尾，符合文件「, 在值行尾」约定
  let j = i - 1;
  while (j > 0 && /\s/.test(out[j])) j--;
  const indentMatch = out.slice(j + 1, i).match(/[ \t]+$/);  // 收尾 } 前的缩进
  const indent = indentMatch ? indentMatch[0] : "";
  out = out.slice(0, j + 1) + "," + EOL + fmtImages(arr) + EOL + indent + out.slice(i);
  merged += arr.length;
}
fs.writeFileSync(DST, out, "utf8");
console.log(`合并完成：写入 ${merged} 条图片记录到 ${imgMap.size} 个小节${skipped ? `（跳过已存在 ${skipped} 节）` : ""}`);
