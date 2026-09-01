/* FAQ 语言逻辑扫描器 — 探测"语言混乱"的机械化信号，供人工复核后批量修复。
   用法: node scripts/faq-language-scan.js [--top N] [--json]
   输出: 每类命中数 + 命中条目样本（含 title/q/片段）。不写回，仅审计。
*/
const fs = require('fs');
const path = require('path');

const _args = process.argv.slice(2);
const SRC = path.join(__dirname, '..', 'data', 'faq_runtime.js');
const TOP = (() => { const i = _args.indexOf('--top'); return i >= 0 ? +_args[i+1] : 25; })();

// 读取并求值，取 window.FAQ 数组
function loadFAQs(src) {
  const raw = fs.readFileSync(src, 'utf8');
  const s = String(raw).replace(/^window\.FAQ\s*=/, '').trim();
  // 去掉末尾多余 ；分号
  const expr = s.replace(/;\s*$/, '');
  const window = {};
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', '"use strict";return (' + expr + ');');
  const arr = fn(window);
  if (!Array.isArray(arr)) throw new Error('window.FAQ 不是数组');
  return arr;
}

// —— 判定掩码所用字符/短语 ——
const MOJIBAKE = ['锛', '銆', '鑻', '鍖', '鍒', '鍜', '閲', '鍚', '鏄', '鏌', '鍙', '鎺', '纭', '鐨', '锘'];
const REDUP_BAD = '的 了 是 在 和 与 及 但 而 或 对 从 到 中 上 下 为 把 被 让 向 给 得 着 过 呢 吗 吧 啊 么 什 怎 这 那 哪 就 都 也 还 又 很 更 最 太 真 好 即 则 却 并 且 因 所 以 之 其 该 此 每 各 某 如 若'.split(' ');
const CONJ_DOUBLE = ['但是但是', '其实其实', '就是就是', '因为因为', '所以所以', '既然既然', '虽然虽然', '并且并且', '然而然而', '不过不过', '而且而且', '不仅不仅', '于是于是', '因此因此', '即是即是', '然而但是', '但是然而', '所以但是', '因此所以', '其实就是但是', '那那么'];
const PLACEHOLDER = [/TODO/i, /undefined/i, /null\b/i, /\bNaN\b/, /\{\{/, /\}\}/, /XXX/i, /xxx/i, /fill in/i, /待补/, /此处留白/, /（[?]{3,}/, /\.\.\.\./];
const BRACKET_UNCLOSED = [/<b>[^<]*$/, /<i>[^<]*$/, /<p>[^<]*$/, /<li>[^<]*$/];

function count(s, re, from = 0) { let n = 0, i = from; while ((i = s.indexOf(re, i)) !== -1) { n++; i += 1; } return n; }

function analyze(a, idx) {
  const f = { idx, title: a.title, q: a.q, subfield: a.subfield };
  const answer = a.answer || '';
  const detail = a.detail || '';
  const full = answer; // 主要评 answer；detail 单独标记

  const hits = {};

  // 1) 乱码
  if (MOJIBAKE.some(c => answer.includes(c) || detail.includes(c))) hits['mojibake'] = snippet_of_mojibake(answer + detail);

  // 2) 重复/多余标点
  const dblPunct = /[。，、；：？!！]{2,}/.exec(answer);
  if (dblPunct) hits['repunct'] = `重复标点 "${dblPunct[0]}"`;

  // 3) 长而无断句（>120 字且句号/逗号/分号/<br> 合计 ≤1）
  const breaks = count(answer, '。') + count(answer, '；') + count(answer, '，');
  if (answer.length > 120 && breaks <= 1) hits['runon'] = `长句无断句(${answer.length}字/${breaks}标点)`;

  // 4) 功能字叠字
  for (const c of REDUP_BAD) {
    const p = c + c;
    if (answer.includes(p)) { hits['redup'] = `叠字 "${p}"`; break; }
  }

  // 5) 关联词重复
  for (const c of CONJ_DOUBLE) if (answer.includes(c)) { hits['conjdouble'] = `关联词重复 "${c}"`; break; }

  // 6) 占位符/未填
  for (const re of PLACEHOLDER) if (re.test(answer)) { hits['placeholder'] = `占位 "${re.source}"`; break; }

  // 7) 残句：以不完整符号开头/结尾
  if (/^[，。、；：！？]/.test(answer.trim())) hits['fragstart'] = '以 "。" 系标点开头';
  if (/[，、：；——]$/.test(answer.trim())) hits['fragend'] = '以不完整连词/标点结尾';

  // 8) 未闭合 HTML/b 等
  for (const re of BRACKET_UNCLOSED) if (re.test(answer)) { hits['unclosedTag'] = `未闭合标签 ${re.source}`; break; }

  // 9) 首句与标题复用（机械复制感）
  // —— 可选：跳过

  // 10) 超级短/空
  if (!answer.trim()) hits['empty'] = 'answer 为空';
  else if (answer.length <= 8) hits['short'] = `answer 过短(${answer.length})`;

  return { f, answer, hits };
}

function snippet_of_mojibake(s) {
  const m = MOJIBAKE.map(c => c).find(c => s.includes(c));
  const i = s.indexOf(m);
  return `疑似乱码 "${m}" ... ${s.slice(Math.max(0, i - 12), i + 18)}`;
}

function main() {
  const faqs = loadFAQs(SRC);
  const total = faqs.length;
  const catCount = {};
  const catItems = {};
  let flaggedTotal = 0;

  for (let i = 0; i < total; i++) {
    const r = analyze(faqs[i], i);
    const keys = Object.keys(r.hits);
    if (keys.length) flaggedTotal++;
    for (const k of keys) {
      catCount[k] = (catCount[k] || 0) + 1;
      (catItems[k] = catItems[k] || []).push({ index: i, title: r.f.title, q: r.f.q, subfield: r.f.subfield, note: r.hits[k], answer: r.answer });
    }
  }

  console.log(`\nFAQ 总数: ${total}  |  命中至少 1 类: ${flaggedTotal}\n`);
  const order = Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a]);
  for (const k of order) {
    console.log(`${k}: ${catCount[k]}`);
  }
  console.log('');
  for (const k of order) {
    const items = catItems[k];
    console.log(`\n=== ${k} (${items.length}) ===`);
    for (const it of items.slice(0, TOP)) {
      const snip = it.answer ? it.answer.slice(0, 90).replace(/\n/g, '↵') : '(空)';
      console.log(`  #${it.index} ${it.subfield || ''} | ${it.title} | ${it.note}`);
      console.log(`      ${snip}`);
    }
    if (items.length > TOP) console.log(`  ... plus ${items.length - TOP} more`);
  }
}

main();
