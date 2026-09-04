'use strict';
/**
 * 本地 assistant 命中捕获（无浏览器，纯 Node）。
 * 给定 <queries.json> = [{qid, faq_verify, rephrased}, ...]，
 * 对每个 qid 用 rag.matchFAQ 求 faq_verify 与 rephrased 各自命中的 FAQ 条目（index/title/answer 前缀），
 * 供比对 agent 判断"换个问法后是否仍命中同一条目"。
 * 用法: node scripts/assistant_capture.js <queries.json>
 * 输出: stdout 一段 JSON
 */
const fs = require('fs');
const rag = require('./rag-utils.js');
const { readFAQRuntime } = require('./lib-assistant-faq.js');

function readJson(fp) {
  let r = fs.readFileSync(fp, 'utf8');
  if (r.charCodeAt(0) === 0xFEFF) r = r.slice(1);
  return JSON.parse(r);
}

function main() {
  const fp = process.argv[2];
  if (!fp) { console.error('用法: node assistant_capture.js <queries.json>'); process.exit(1); }
  const queries = readJson(fp);
  const faq = readFAQRuntime();
  function cap(q) {
    const m = rag.matchFAQ(q, faq);
    const i = m ? faq.indexOf(m) : -1;
    return {
      index: i,
      title: m ? String(m.title || '') : '(无命中)',
      answer: m ? String(m.answer || '').slice(0, 140) : ''
    };
  }
  const results = queries.map(it => {
    const v = cap(it.faq_verify);
    const r = cap(it.rephrased);
    return {
      qid: it.qid,
      verifyMatch: v,
      rephraseMatch: r,
      agree: v.index >= 0 && r.index === v.index
    };
  });
  process.stdout.write(JSON.stringify(results, null, 1));
}
main();
