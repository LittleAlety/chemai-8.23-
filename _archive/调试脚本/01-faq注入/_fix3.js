const fs=require('fs');
const ROOT='C:/Users/Little Alety/Desktop/Claude Code/version7-25/';
const lib=require(ROOT+'scripts/lib-assistant-faq.js');
const FP=ROOT+'data/faq_runtime.js';
const CUR=lib.readFAQRuntime(FP);
let total=0;
function addKeys(match, add){
  for(const e of CUR.filter(e=>(e.title||'').includes(match))){
    let d=0;
    for(const k of add){ if(!e.keys.includes(k)){e.keys.push(k);d++;} }
    if(d){console.log('UPD ['+e.title+'] +'+d); total+=d;}
  }
}
addKeys('为什么用H2O2而不用KMnO4', [
  '能不能用高锰酸钾','能不能用高锰酸钾氧化','高锰酸钾能不能',
  '高锰酸钾代替双氧水','高锰酸钾替代双氧水','高锰酸钾替换双氧水','代替双氧水','替代双氧水',
  '用高锰酸钾做氧化剂','用高锰酸钾氧化','高锰酸钾做氧化剂','高锰酸钾作氧化剂',
  '高锰酸钾代替','不用双氧水用高锰酸钾','直接加高锰酸钾','用高锰酸钾可以吗',
]);
addKeys('植物与光合作用', [
  '植物是绿色的原因','植物是绿色','植物为什么是绿色',
  '叶子是绿色','叶子为什么是绿色','为什么叶子是绿色','植物叶子为什么是绿色','叶子怎么是绿色',
]);
lib.writeFAQRuntime(CUR, FP);
console.log('total added: '+total+' -> wrote');
