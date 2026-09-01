const fs=require('fs');
const ROOT='C:/Users/Little Alety/Desktop/Claude Code/version7-25/';
const lib=require(ROOT+'scripts/lib-assistant-faq.js');
const CUR=lib.readFAQRuntime(ROOT+'data/faq_runtime.js');
// list ALL titles mentioning 6% or H2O2用量/浓度 or 8mL
for(const e of CUR){
  const t=(e.title||'');
  if(/6\s*%|H2O2\s*8|过氧化氢.*(8|用量|浓度)|H₂O₂.*(8|用量|浓度)|6%/.test(t) && /过氧化氢|H2O2|H₂O₂|双氧水/.test(t)){
    console.log('['+t+']');
    console.log('  keys: '+JSON.stringify(e.keys));
    console.log('  ans: '+(e.answer||e.a||'').replace(/\s+/g,' ').slice(0,80));
    console.log('');
  }
}
