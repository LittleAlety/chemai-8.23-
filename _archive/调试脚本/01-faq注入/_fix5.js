const fs=require('fs');
const ROOT='C:/Users/Little Alety/Desktop/Claude Code/version7-25/';
const lib=require(ROOT+'scripts/lib-assistant-faq.js');
const FP=ROOT+'data/faq_runtime.js';
const CUR=lib.readFAQRuntime(FP);
let adds=0, dels=0;
function addKeys(sub, keys){ for(const e of CUR.filter(e=>(e.title||'').includes(sub))){ let d=0; for(const k of keys){ if(!e.keys.includes(k)){e.keys.push(k);d++;} } if(d){console.log('  +['+e.title+'] +'+d); adds+=d;} } }
function delKeys(sub, keys){ for(const e of CUR.filter(e=>(e.title||'').includes(sub))){ let d=0; for(const k of keys){ const i=e.keys.indexOf(k); if(i>=0){e.keys.splice(i,1);d++;} } if(d){console.log('  -['+e.title+'] -'+d); dels+=d;} } }
function addSent(sub, sent){ for(const e of CUR.filter(e=>(e.title||'').includes(sub))){ const a=e.answer||e.a||''; if(a.indexOf(sent)<0){ if(e.answer!=null) e.answer=a+sent; else e.a=a+sent; console.log('  ~['+e.title+'] answer append'); } } }

console.log('#3 6%浓度');
addKeys('过氧化氢浓度规格', ['双氧水是百分之几','双氧水百分之几','过氧化氢是百分之几','百分之几','30%的规格','见过30%','双氧水浓度是多少','过氧化氢浓度是多少']);
addKeys('6% H2O2 8mL具体用量', ['双氧水是百分之几','百分之几']);
console.log('#2 8mL用量');
addKeys('6% H2O2 8mL具体用量', ['过氧化氢要滴加多少','滴加多少毫升','要滴加多少毫升','过氧化氢滴加多少','加过氧化氢多少毫升','过氧化氢加多少毫升','滴加多少']);
addKeys('过氧化氢浓度用量', ['滴加多少毫升','过氧化氢要滴加多少']);
console.log('#4 0.5mol/L草酸');
addKeys('配位用草酸浓度', ['0.5摩尔每升','0.5摩尔','草酸浓度是多少','0.5还是0.05','草酸浓度0.5','草酸0.5','0.5mol/L','草酸浓度要用多少','浓度要用多少']);
console.log('#1 5.0g莫尔盐');
addKeys('本实验称取莫尔盐的质量', ['莫尔盐一般要称多少','要称多少克','莫尔盐要称多少','称多少克莫尔盐','莫尔盐称多少克','莫尔盐称多少','莫尔盐一般称多少','多少克莫尔盐']);
addKeys('第一步莫尔盐用量', ['莫尔盐一般要称多少','要称多少克','莫尔盐要称多少','称多少克莫尔盐']);
console.log('#9 莫尔盐6结晶水');
addKeys('莫尔盐摩尔质量', ['莫尔盐结晶水','莫尔盐几个结晶水','莫尔盐带几个结晶水','硫酸亚铁铵结晶水','莫尔盐几个水','6个结晶水','莫尔盐6个水','莫尔盐几个水分子']);
addSent('莫尔盐摩尔质量', ' 莫尔盐含6个结晶水（·6H₂O，六水合物）。');
console.log('#16 双氧水逐滴');
addKeys('为何逐滴加入过氧化氢', ['双氧水为什么要逐滴','过氧化氢为什么要逐滴','双氧水逐滴','过氧化氢逐滴','双氧水不能一次','过氧化氢不能一次','边加边搅拌','一口气全倒','双氧水一口气','双氧水为什么逐滴加']);
delKeys('草酸为何逐滴加入', ['全倒进去','一口气','倒进去']);
console.log('#8 摩尔盐制备酸性/铁屑过量');
addKeys('制备硫酸亚铁铵时为什么要保持溶液酸性？', ['制备摩尔盐','铁屑过量','制备硫酸亚铁铵','溶液保持酸性','让铁屑过量']);
addKeys('为什么制备硫酸亚铁铵要用废铁屑并让铁屑过量？', ['保持酸性','制备摩尔盐','制备硫酸亚铁铵','溶液保持酸性','把溶液保持酸性']);
console.log('#10 三草酸合锰酸钾碘量法');
addKeys('三草酸合锰(III)酸钾的制备', ['三草酸合锰酸钾','碘量法','高锰酸钾滴定','草酸根含量','锰配合物','不是高锰酸钾','用碘量法']);

lib.writeFAQRuntime(CUR, FP);
console.log('DONE adds='+adds+' dels='+dels+' -> wrote');
