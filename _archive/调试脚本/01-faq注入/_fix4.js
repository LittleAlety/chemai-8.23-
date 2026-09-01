const fs=require('fs');
const ROOT='C:/Users/Little Alety/Desktop/Claude Code/version7-25/';
const lib=require(ROOT+'scripts/lib-assistant-faq.js');
const FP=ROOT+'data/faq_runtime.js';
const CUR=lib.readFAQRuntime(FP);
const TWO=['高锰酸钾-草酸反应的自催化化学发光','高锰酸钾-草酸反应的经典动力学'];
for(const e of CUR.filter(e=>TWO.includes(e.title))){
  const before=e.keys.length;
  e.keys=e.keys.filter(k=>k!=='高锰酸钾'&&k!=='kmno4');
  console.log('TRIMMED ['+e.title+'] keys '+before+'->'+e.keys.length);
}
lib.writeFAQRuntime(CUR, FP);
console.log('wrote');
