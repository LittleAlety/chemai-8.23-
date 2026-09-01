const fs=require('fs');
const ROOT='C:/Users/Little Alety/Desktop/Claude Code/version7-25/';
const lib=require(ROOT+'scripts/lib-assistant-faq.js');
const CUR=lib.readFAQRuntime(ROOT+'data/faq_runtime.js');
const WANT=['6%H2O2用量','配位用草酸浓度','试剂用量一览','产物名称与化学式','为何逐滴加入过氧化氢','草酸为何逐滴加入','莫尔盐摩尔质量','为什么保持溶液酸性','摩尔盐的制备原理','三草酸合锰(III)酸钾','莫尔盐','理论产量6.26g推导及额外结晶水对产率的影响','产物草酸根含量与纯度的滴定'];
for(const e of CUR){
  const t=(e.title||'');
  if(WANT.some(w=>t.includes(w))){
    console.log('==== ['+t+']');
    console.log('  keys: '+JSON.stringify(e.keys));
    if(e.ents) console.log('  ents: '+JSON.stringify(e.ents));
    const a=(e.answer||e.a||'').replace(/\s+/g,' ').slice(0,90);
    if(a) console.log('  ans: '+a);
  }
}
