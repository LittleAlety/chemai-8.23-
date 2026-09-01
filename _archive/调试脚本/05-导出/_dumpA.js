const fs=require('fs');
const ROOT='C:/Users/Little Alety/Desktop/Claude Code/version7-25/';
const lib=require(ROOT+'scripts/lib-assistant-faq.js');
const CUR=lib.readFAQRuntime(ROOT+'data/faq_runtime.js');
const RX=/三草酸合锰|碘量法|结晶水|保持溶液酸性|铁屑|硫酸亚铁铵的制备|制备.*硫酸亚铁铵|硫酸亚铁铵制备|用废铁屑|浓硫酸.*稀硫酸/;
for(const e of CUR){
  const t=(e.title||'');
  if(RX.test(t)){
    console.log('==== ['+t+']');
    console.log('  keys: '+JSON.stringify(e.keys));
    const a=(e.answer||e.a||'').replace(/\s+/g,' ').slice(0,110);
    if(a) console.log('  ans: '+a);
    console.log('');
  }
}
