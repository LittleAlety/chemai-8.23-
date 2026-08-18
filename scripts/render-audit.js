'use strict';
/** FAQ 渲染审计（供 check-all 调用，也可单独跑） */
const { readHTML, readFAQRuntime } = require('./lib-assistant-faq.js');
const html = readHTML();
function grab(name) {
  const re = new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}\\r?\\n');
  const m = html.match(re);
  if (!m) throw new Error('未找到 ' + name);
  return m[0];
}
const code = 'const esc=s=>String(s==null?\'\':s).replace(/[&<>"\']/g,c=>({\'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\',\'"\':\'&quot;\',"\'":\'&#39;\'}[c]));' +
  grab('renderLatexToUnicode') + grab('renderLatexBody') + grab('inlineRich') + grab('renderRichAnswer');
const fn = new Function('return (function(){' + code + ';return {renderRichAnswer:renderRichAnswer};})();')();
const faq = readFAQRuntime();
let bad = 0, total = 0;
for (const f of faq) {
  for (const k of ['answer', 'detail']) {
    if (!f[k]) continue;
    total++;
    const out = fn.renderRichAnswer(f[k]);
    if (out.includes('�') || out.includes('&lt;sub') || out.includes('&lt;sup') || /<p><div/.test(out)) {
      bad++;
      if (bad <= 5) console.log('❌ ' + (f.title || '?') + ' [' + k + '] ' + JSON.stringify(f[k].slice(0, 50)));
    }
  }
}
console.log('FAQ ' + faq.length + ' | 渲染 ' + total + ' 段 | 问题 ' + bad + ' 段');
console.log(bad === 0 ? '✅ 渲染干净' : '❌ ' + bad + ' 段问题');
