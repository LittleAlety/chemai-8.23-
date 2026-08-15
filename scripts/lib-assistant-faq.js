'use strict';
/**
 * assistant.html 内嵌 FAQ 数组的共享提取/改写工具（v43 自学习专用）
 *
 * 提取与改写均做"字符串感知"处理：FAQ 条目 detail/answer 内含
 * [Fe(C₂O₄)₃]³⁻、' 转义、\n 转义等，不能按朴素括号匹配。
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_HTML = path.join(__dirname, '..', 'assistant.html');

/**
 * 从 assistant.html 提取 const FAQ=[...] 数组源码。
 * @returns {{src:string, start:number, end:number}}
 *   start/end 为 [ 与 ] 在全文中的位置
 */
function extractFAQArray(html) {
  const idx = html.indexOf('const FAQ=');
  if (idx < 0) throw new Error('const FAQ= 未找到');
  const open = html.indexOf('[', idx);
  if (open < 0) throw new Error('const FAQ= 后未找到 [');
  let depth = 0;
  let inStr = null;   // null | "'" | '"' | '`'
  let close = -1;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { close = i; break; } }
  }
  if (close < 0) throw new Error('FAQ 数组括号不平衡');
  return { src: html.slice(open, close + 1), start: open, end: close };
}

/**
 * 解析 FAQ 数组源码 → 对象数组。
 * 通过 new Function 求值（数组字面量，无外部依赖）。
 */
function parseFAQ(html) {
  const { src } = extractFAQArray(html);
  try {
    // eslint-disable-next-line no-new-func
    return new Function('return (' + src + ')')();
  } catch (e) {
    throw new Error('FAQ 数组求值失败: ' + e.message);
  }
}

/**
 * 计算每个条目在 src 中的位置跨度。
 * @param {string} src FAQ 数组源码
 * @returns {Array<{entryStart:number, entryEnd:number, keysSpan:{start:number,end:number}|null, entsSpan:{start:number,end:number}|null}>}
 *   所有 span 相对 src 偏移；keys/ents span 是 value（含 [] 括回的数组字面量）位置。
 */
function getEntrySpans(src) {
  const spans = [];
  let depth = 0;           // 数组 [ → 1；条目对象 { → 2；keys/ents 数组 [ → 3
  let inStr = null;
  let entryStart = -1;     // 当前条目 { 的位置
  let entryEnd = -1;       // 当前条目 } 的位置
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    // 行注释（FAQ 数组内夹有 // ===== v3x 等分隔注释）
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    // 块注释
    if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2);
      i = j < 0 ? src.length - 1 : j + 1;
      continue;
    }
    if (c === '{') {
      if (depth === 1) entryStart = i;   // 数组内第 1 层 { 即条目起点
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 1) entryEnd = i;     // 条目对象闭合
    } else if (c === '[') {
      depth++;
    } else if (c === ']') {
      depth--;
      if (depth === 0) {
        // 数组结束：最后一个条目在 ] 之前
        spans.push({ entryStart, entryEnd, keysSpan: findArrayField(src, entryStart, entryEnd, 'keys'), entsSpan: findArrayField(src, entryStart, entryEnd, 'ents') });
        return spans;
      }
    } else if (c === ',' && depth === 1 && entryStart >= 0) {
      spans.push({ entryStart, entryEnd, keysSpan: findArrayField(src, entryStart, entryEnd, 'keys'), entsSpan: findArrayField(src, entryStart, entryEnd, 'ents') });
      entryStart = -1;
      entryEnd = -1;
    }
  }
  throw new Error('数组扫描未正常结束');
}

function makeEntrySpan(src, start, end) {
  // 去掉前后空白，只保留 {…} 对象本体
  let s = start, e = end;
  while (s < e && /\s/.test(src[s])) s++;
  while (e > s && /\s/.test(src[e - 1])) e--;
  return {
    entryStart: s,
    entryEnd: e,
    keysSpan: findArrayField(src, s, e, 'keys'),
    entsSpan: findArrayField(src, s, e, 'ents')
  };
}

/**
 * 在 [start,end) 内查找字段 field: [ … ] 的 value 跨度。
 */
function findArrayField(src, start, end, field) {
  const re = new RegExp('\\b' + field + '\\s*:');
  const m = re.exec(src.slice(start, end));
  if (!m) return null;
  let i = start + m.index + m[0].length;
  // 跳过空白到 [
  while (i < end && /\s/.test(src[i])) i++;
  if (src[i] !== '[') return null;
  let depth = 0;
  let inStr = null;
  for (let j = i; j < end; j++) {
    const c = src[j];
    if (inStr) {
      if (c === '\\') { j++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return { start: i, end: j + 1 }; }
  }
  return null;
}

/**
 * 在 [start,end) 内查找标量字符串字段 field: '…' / "…" 的 value 跨度（含引号）。
 */
function findScalarField(src, start, end, field) {
  const re = new RegExp('\\b' + field + '\\s*:');
  const m = re.exec(src.slice(start, end));
  if (!m) return null;
  let i = start + m.index + m[0].length;
  while (i < end && /\s/.test(src[i])) i++;
  const q = src[i];
  if (q !== "'" && q !== '"' && q !== '`') return null;
  for (let j = i + 1; j < end; j++) {
    const c = src[j];
    if (c === '\\') { j++; continue; }
    if (c === q) return { start: i, end: j + 1 };
  }
  return null;
}

/**
 * 应用清洗清单：把指定条目 index 的 keys/ents 数组 或 answer/detail 字符串替换为新内容。
 * @param {string} html
 * @param {Array<{index:number, new_keys?:string[], new_ents?:string[], new_answer?:string, new_detail?:string}>} changes
 * @returns {string} 新 html
 */
function applyManifest(html, changes) {
  let cur = html;
  for (const ch of changes) {
    const { src, start } = extractFAQArray(cur);
    const spans = getEntrySpans(src);
    const e = spans[ch.index];
    if (!e) throw new Error('条目索引越界: ' + ch.index + ' (共 ' + spans.length + ' 条)');
    const entrySrc = src.slice(e.entryStart, e.entryEnd);

    // 收集本条目内的编辑，按位置降序应用
    const edits = [];
    if (ch.new_keys !== undefined && e.keysSpan) {
      const s = e.keysSpan.start - e.entryStart;
      const t = e.keysSpan.end - e.entryStart;
      edits.push([s, t, JSON.stringify(ch.new_keys)]);
    }
    if (ch.new_ents !== undefined && e.entsSpan) {
      const s = e.entsSpan.start - e.entryStart;
      const t = e.entsSpan.end - e.entryStart;
      edits.push([s, t, JSON.stringify(ch.new_ents)]);
    }
    if (ch.new_answer !== undefined) {
      const sp = findScalarField(src, e.entryStart, e.entryEnd, 'answer');
      if (sp) edits.push([sp.start - e.entryStart, sp.end - e.entryStart, JSON.stringify(ch.new_answer)]);
    }
    if (ch.new_detail !== undefined) {
      const sp = findScalarField(src, e.entryStart, e.entryEnd, 'detail');
      if (sp) {
        edits.push([sp.start - e.entryStart, sp.end - e.entryStart, JSON.stringify(ch.new_detail)]);
      } else {
        // detail 字段缺失：在 answer 值之后插入 , detail:'…'
        const asp = findScalarField(src, e.entryStart, e.entryEnd, 'answer');
        if (asp) edits.push([asp.end - e.entryStart, asp.end - e.entryStart, ', detail:' + JSON.stringify(ch.new_detail)]);
      }
    }
    edits.sort((a, b) => b[0] - a[0]);
    let newEntry = entrySrc;
    for (const [s, t, rep] of edits) {
      newEntry = newEntry.slice(0, s) + rep + newEntry.slice(t);
    }
    const newSrc = src.slice(0, e.entryStart) + newEntry + src.slice(e.entryEnd);
    cur = cur.slice(0, start) + newSrc + cur.slice(start + src.length);
  }
  return cur;
}

module.exports = {
  DEFAULT_HTML,
  extractFAQArray,
  parseFAQ,
  getEntrySpans,
  applyManifest,
  readHTML(fp) {
    const p = fp || DEFAULT_HTML;
    return fs.readFileSync(p, 'utf8');
  }
};
