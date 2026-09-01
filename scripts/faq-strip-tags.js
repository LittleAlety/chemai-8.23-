/* FAQ 剥离答案/详解「字段最值前端」的【类目标签】前缀 — 类目标签是内容管理元信息（如【制备原理深度解析·第一步】、
   【化合物性质详解·物理性质】），冗余于标题且作为正文首行会显式泄漏给读者，读起来像机器注记。

   只剥离「字段值开头」的【...】标签；内部作为小标题的【...】（如 #22 的【第一步·沉淀(复分解反应)】、
   #96 的【莫尔盐】）与化学式方括号 [] 一律不动。字节级原地替换，不重排手写文件。
   守门：剥离后须有实义内容(≥20字)且不以另一个【 开头。

   运行后校验：重 parse 条目数不变、残留「开头的【】」归零、node --check。
   用法: node scripts/faq-strip-tags.js  （写回 data/faq_runtime.js）
*/
const fs = require('fs');
const FILE = 'data/faq_runtime.js';
let raw = fs.readFileSync(FILE, 'utf8');

function parse() {
  const expr = raw.slice(raw.indexOf('window.FAQ') + 'window.FAQ'.length).replace(/^.*?=\s*/, '').trim().replace(/;\s*$/, '');
  return new Function('window', 'return (' + expr + ');')({});
}
let arr = parse();
const entries = arr.length;

// 字段值 -> 文件内表示（仅 \\ 与 \n 转义，中文原样）
function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n'); }

// 剥离字段值开头的【类目标签】；不适用则返回 null
function stripLead(v) {
  const s = String(v || '');
  const m = s.match(/^\s*【[^】\r\n]{1,60}】/);
  if (!m) return null;
  const rest = s.slice(m[0].length);
  if (rest.trim().length < 20) return null;   // 剥离后须有实义内容
  if (/^\s*【/.test(rest)) return null;       // 不以另一个【 开头（避免剥离连续标签）
  return rest.replace(/^\s+/, '');            // 去标签后残余前导空白
}

let changed = 0;
const log = [];
for (let idx = 0; idx < arr.length; idx++) {
  const a = arr[idx];
  for (const field of ['answer', 'detail']) {
    const old = String(a[field] == null ? '' : a[field]);
    const nw = stripLead(old);
    if (nw == null) continue;
    const tag = (old.match(/^\s*【([^】\r\n]+)】/) || [, ''])[1];
    // 字段边界锚定：raw 里值为 answer:'…' / detail:'…'，只剥紧跟字段名之后的标签。
    // 这样即使两条目共享同一 value（同值不同题），也在各自字段边界各剥一次，不会误伤正文里作小标题的【…】。
    const anchor = field + ":'" + esc(tag);
    const rep = field + ":'";
    const count = raw.split(anchor).length - 1;
    if (count < 1) { log.push('SKIP #' + idx + ' ' + field + ' (未找到字段边界)'); continue; }
    raw = raw.split(anchor).join(rep);
    changed++;
    log.push('OK  #' + idx + ' ' + field + ' | ' + String(a.title).slice(0, 24) + ' | 剥离【' + tag.slice(0, 20) + '】 -> ' + nw.slice(0, 36));
  }
}

arr = parse();
console.log('剥离标签前缀数:', changed, '  条目数:', entries, '->', arr.length, arr.length === entries ? 'OK' : '!!不一致');
let leadLeft = 0;
for (const a of arr) for (const f of ['answer', 'detail']) if (/^\s*【[^】]{1,60}】/.test(String(a[f] || ''))) leadLeft++;
console.log('残留「以【】开头的字段」:', leadLeft);
for (const l of log) console.log(l);
fs.writeFileSync(FILE, raw, 'utf8');
console.log('已写回 data/faq_runtime.js');
