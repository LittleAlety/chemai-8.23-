// 语料库交叉匹配：用 data/corpus.json + corpus_new_entries.json 中已核验的 DOI 锚定 100 条标题
// 仅读取本地文件，无网络请求，0 编造风险。产物：_corpus_match.json
const fs = require('fs');

// ---- 1. 解析 CORPUS_SUPPLEMENT_100.md ----
const md = fs.readFileSync('CORPUS_SUPPLEMENT_100.md', 'utf8');
const rows = md.split('\n').filter(l => /^\|\s*\d{1,3}\s*\|/.test(l) && l.includes('*'));
const targets = rows.map(l => {
  const p = l.split('|').map(s => s.trim());
  return { num: parseInt(p[1]), title: p[2], journal: (p[3] || '').replace(/\*/g, '').trim(), year: p[4] || '' };
});

// ---- 2. 加载语料库 ----
const stripBom = s => String(s).replace(/^﻿/, '');
const corpus = JSON.parse(stripBom(fs.readFileSync('data/corpus.json', 'utf8')));
const cEntries = (corpus.entries || []).map(e => Object.assign({ src: 'corpus.json' }, e));
const newEntries = JSON.parse(stripBom(fs.readFileSync('corpus_new_entries.json', 'utf8'))).map(e => Object.assign({ src: 'corpus_new_entries.json' }, e));
const all = cEntries.concat(newEntries);

// ---- 3. 规范化 ----
const subMap = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+','ᴵ':'i' };
function norm(s) {
  let t = String(s || '');
  for (const k in subMap) t = t.split(k).join(subMap[k]);
  return t.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function stripAnno(s) { return String(s || '').replace(/\s*\([^)]*\)\s*$/, '').trim(); }
function titleSim(a, b) {
  const wa = new Set(norm(stripAnno(a)).split(' ').filter(w => w.length > 2));
  const wb = new Set(norm(b).split(' ').filter(w => w.length > 2));
  if (!wa.size || !wb.size) return { jac: 0, contain: 0 };
  let inter = 0; wa.forEach(w => { if (wb.has(w)) inter++; });
  const jac = inter / (wa.size + wb.size - inter);
  const contain = inter / wa.size;
  return { jac, contain };
}
function extractDoi(e) {
  for (const k of ['doi', 'source_url', 'path']) {
    const v = e[k] || '';
    const m = String(v).match(/10\.\d{4,9}\/[^\/\s?#]*[^\s?#]/i);
    if (m) return m[0].replace(/[.)]$/, '');
  }
  return '';
}
function extractYear(e) {
  if (e.year) return String(e.year).match(/\d{4}/)?.[0] || '';
  const v = e['volume/issue/pages'] || '';
  const m = String(v).match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : '';
}

// ---- 4. 匹配 ----
const out = [];
let strong = 0;
for (const t of targets) {
  const cands = [];
  for (const e of all) {
    const { jac, contain } = titleSim(t.title, e.title || '');
    if (jac >= 0.55 || (contain >= 0.8 && jac >= 0.45)) {
      cands.push({ title: e.title, journal: e.journal || '', year: extractYear(e), doi: extractDoi(e), src: e.src, jac: +jac.toFixed(2), contain: +contain.toFixed(2) });
    }
  }
  cands.sort((a, b) => b.jac - a.jac);
  const best = cands[0] || null;
  if (best && best.doi && best.jac >= 0.7) strong++;
  out.push({ num: t.num, orig: t.title, oJ: t.journal, oY: t.year, best, top: cands.slice(0, 3) });
}
fs.writeFileSync('_corpus_match.json', JSON.stringify(out, null, 1), 'utf8');

// ---- 5. 摘要 ----
console.log('目标条目: ' + targets.length + ' | 语料库条目: ' + all.length);
console.log('强匹配(jac>=0.7 且含DOI): ' + strong + ' / 100\n');
for (const o of out) {
  const b = o.best;
  const mark = b && b.doi && b.jac >= 0.7 ? '✓' : (b ? '·' : ' ');
  console.log(mark + ' #' + o.num + ' [' + (b ? b.jac : '-') + '] ' + o.orig.slice(0, 48));
  if (b) console.log('    → ' + (b.title || '').slice(0, 55) + ' | ' + (b.journal || '').slice(0, 25) + ' ' + b.year + ' | ' + (b.doi || '无DOI'));
}
