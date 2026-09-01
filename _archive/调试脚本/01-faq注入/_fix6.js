const fs=require('fs');
const ROOT='C:/Users/Little Alety/Desktop/Claude Code/version7-25/';
const lib=require(ROOT+'scripts/lib-assistant-faq.js');
const FP=ROOT+'data/faq_runtime.js';
const CUR=lib.readFAQRuntime(FP);
// #14 REGRESSION FIX: drop the generic 碘量法/高锰酸钾滴定/草酸根含量 keys from the Mn-prep entry
// (they were magnets that stole the iron-complex #14 query). KEEP only 锰-specific keys.
for(const e of CUR.filter(e=>(e.title||'').includes('三草酸合锰(III)酸钾的制备'))){
  e.keys=e.keys.filter(k=>!['碘量法','高锰酸钾滴定','草酸根含量','不是高锰酸钾','用碘量法'].includes(k));
  console.log('  -[三草酸合锰(III)酸钾的制备] keys now: '+JSON.stringify(e.keys));
}
// #9 LIGHT ATTEMPT: water-count query phrases (contiguous in the query) onto 莫尔盐摩尔质量
for(const e of CUR.filter(e=>(e.title||'').includes('莫尔盐摩尔质量'))){
  for(const k of ['带几个结晶水','几个结晶水','莫尔盐带几个水']){ if(!e.keys.includes(k)){e.keys.push(k); console.log('  +['+e.title+'] +'+k);} }
}
lib.writeFAQRuntime(CUR, FP);
console.log('wrote _fix6');
