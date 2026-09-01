const fs=require('fs');
const ROOT='C:/Users/Little Alety/Desktop/Claude Code/version7-25/';
const lib=require(ROOT+'scripts/lib-assistant-faq.js');
const FP=ROOT+'data/faq_runtime.js';
const CUR=lib.readFAQRuntime(FP);
for(const e of CUR.filter(e=>(e.title||'').includes('莫尔盐摩尔质量'))){
  if(!e.keys.includes('硫酸亚铁铵')){e.keys.push('硫酸亚铁铵');console.log('  +[莫尔盐摩尔质量] +硫酸亚铁铵');}
}
lib.writeFAQRuntime(CUR, FP);
console.log('wrote _fix7');
