const fs=require('fs');
const ROOT='C:/Users/Little Alety/Desktop/Claude Code/version7-25/';
for(const f of ['_prb5.json','_prb4b.json']){
  console.log('===== '+f);
  const R=JSON.parse(fs.readFileSync(ROOT+f,'utf8'));
  for(const r of R){
    console.log('  '+(r.q||'').slice(0,36)+'  =>  '+(r.winner||'').split('→')[0].slice(0,30)+'  |EXP:'+((r.expected_topic||'').slice(0,18)));
  }
}
