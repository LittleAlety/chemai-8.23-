const fs=require('fs');
const ROOT='C:/Users/Little Alety/Desktop/Claude Code/version7-25/';
for(const f of ['_r2.json','_rg.json','_prb.json']){
  console.log('===== '+f);
  const R=JSON.parse(fs.readFileSync(ROOT+f,'utf8'));
  for(const r of R){
    const w=(r.winner||'').split('→')[0].slice(0,34);
    const exp=r.expected_topic?('  |EXP: '+r.expected_topic.slice(0,24)):'';
    console.log('  '+(r.q||'').slice(0,40)+'  =>  '+w+exp);
  }
}
