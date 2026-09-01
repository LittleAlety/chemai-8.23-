'use strict';
/**
 * ChemAI 外层守卫 · 乱码清理
 *
 * 清理 data/faq_runtime.js 中可能出现的编码垃圾：BOM(U+FEFF)、替换符 �(U+FFFD)、
 * 控制字符(除 \t\r\n 的 C0 + 0x7F)、孤代理。这些是 LLM 内容/文件读写中产生的乱码，
 * 会在网页上渲染成问号/方块/异常空格。清理为"仅移除垃圾字符"，不臆造内容、不改语序，
 * 经 writeFAQRuntime 干净序列化（无 BOM）。
 *
 * 用法：
 *   node 训练管道/clean_garbled.js --check   # 仅扫描报告（默认）
 *   node 训练管道/clean_garbled.js --apply   # 扫描 + 回写 data/faq_runtime.js
 * 退出码：0=无乱码；1=有乱码（--apply 时已清理）。
 */
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
const { readFAQRuntime, writeFAQRuntime } = require(path.join(root, 'scripts', 'lib-assistant-faq.js'));

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--apply');

function isGarbage(cp) {
  if (cp === 0xFEFF) return true;                       // BOM
  if (cp === 0xFFFD) return true;                       // 替换符
  if (cp === 0x7F) return true;                         // DEL
  if (cp < 0x20 && cp !== 0x09 && cp !== 0x0A && cp !== 0x0D) return true; // C0 控制符(留 \t\r\n)
  if (cp >= 0xD800 && cp <= 0xDFFF) return true;        // 孤代理
  return false;
}
function cleanString(s) {
  const str = String(s || '');
  let out = '', n = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (isGarbage(cp)) { n++; continue; }
    out += ch;
  }
  return { value: out, bad: n };
}
function cleanArr(arr) {
  let bad = 0;
  const out = [];
  for (const v of arr || []) { const r = cleanString(v); bad += r.bad; out.push(r.value); }
  return { value: out, bad };
}

function main() {
  const faq = readFAQRuntime();
  let totalBad = 0;
  const changed = [];
  const cleaned = faq.map((e, i) => {
    let eBad = 0;
    const e2 = Object.assign({}, e);
    const fields = ['title', 'q', 'answer', 'detail', 'subfield', 'knode'];
    for (const fk of fields) {
      const r = cleanString(e[fk]); eBad += r.bad; if (r.bad) { e2[fk] = r.value; }
    }
    const rk = cleanArr(e.keys); eBad += rk.bad; if (rk.bad) e2.keys = rk.value;
    const re = cleanArr(e.ents); eBad += re.bad; if (re.bad) e2.ents = re.value;
    if (eBad) { totalBad += eBad; changed.push({ index: i, bad: eBad, title: String(e.title || '').slice(0, 24) }); }
    return e2;
  });

  console.log('=== 乱码清理 ===');
  console.log('条目: ' + faq.length + ' | 乱码字符: ' + totalBad + ' | 受影响条目: ' + changed.length);
  changed.slice(0, 12).forEach(c => console.log('  [' + c.index + '] 乱码' + c.bad + ' 处 ← ' + c.title));
  if (changed.length > 12) console.log('  ... 还有 ' + (changed.length - 12) + ' 条');

  if (totalBad > 0 && APPLY) {
    writeFAQRuntime(cleaned);
    // 回写后确认干净
    const recheck = readFAQRuntime();
    let leftover = 0;
    for (const e of recheck) for (const v of [e.title, e.q, e.answer, e.detail]) if (v) { for (const ch of String(v)) if (isGarbage(ch.codePointAt(0))) leftover++; }
    console.log('已回写 data/faq_runtime.js。回写后残留乱码: ' + leftover + '。');
    console.log('回写前 ' + fs.statSync(path.join(root, 'data', 'faq_runtime.js')).size + ' 字节。');
  } else if (totalBad > 0) {
    console.log('(未回写，用 --apply 才写盘)');
  } else {
    console.log('干净，无需清理。');
  }
  process.exit(totalBad > 0 ? 1 : 0);
}
main();
