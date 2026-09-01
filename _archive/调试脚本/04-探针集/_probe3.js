// Test: removing bare '高锰酸钾' key from chemiluminescence/kinetics entries — fixes the
// KMnO4-substitution magnet while keeping legit luminescence queries. In-memory, no write.
const fs=require('fs'),vm=require('vm');
const ROOT='C:/Users/Little Alety/Desktop/Claude Code/version7-25/';
function brace(s,r){const b=s.indexOf('{',s.search(r));let d=0;for(let i=b;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'){d--;if(d===0)return s.slice(s.search(r),i+1);}}}
const CUR=require(ROOT+'scripts/lib-assistant-faq.js').readFAQRuntime(ROOT+'data/faq_runtime.js');
// in-memory: strip bare '高锰酸钾' key from the two magnet entries
for(const e of CUR){
  if((e.title||'').includes('高锰酸钾-草酸反应的自催化化学发光')||(e.title||'').includes('高锰酸钾-草酸反应的经典动力学')){
    e.keys=e.keys.filter(k=>k!=='高锰酸钾');
  }
}
const S=fs.readFileSync(ROOT+'assistant.html','utf8');
const SUB=S.match(/(?:const|var)\s+SUBMAP\s*=\s*\{.*?\};/s)[0];
const TYPO=S.match(/(?:var|let|const)\s+_typoFix\s*=\s*\{[\s\S]*?\};/)[0];
const FIX=brace(S,/function fixTypos\(q\)/);
const NORM=S.match(/const\s+norm\s*=\s*[^\n]+/)[0];
let MFQ=brace(S,/function matchFAQ\(q\)/);
const anchor='if(score>bestScore){bestScore=score;best=f;}';
const idx=MFQ.indexOf(anchor);
MFQ=MFQ.slice(0,idx)+"\n    {__C.push({title:(f&&f.title)||'',score:score,keyScore:keyScore,entScore:entScore,longKey:longKey,lenBonus:lenBonus,titleTopical:titleTopical,distinctHits:distinctHits});}\n    "+MFQ.slice(idx);
const c=vm.createContext({console:console, window:{}, FAQ:CUR});
vm.runInContext('var __C=[];\n'+SUB+'\n'+NORM+'\n'+TYPO+'\n'+FIX+'\n'+MFQ+'\n;this.__norm=norm;', c);
const QUESTIONS=['能换成高锰酸钾吗加多少','高锰酸钾要加多少','能不能用高锰酸钾氧化','高锰酸钾代替双氧水行吗','为什么高锰酸钾和草酸会发光','高锰酸钾氧化草酸为什么会发光','高锰酸钾和草酸的反应','高锰酸钾-草酸自催化'];
for(const q of QUESTIONS){
  c.__C=[]; c.matchFAQ(q);
  const top=c.__C.slice().sort((a,b)=>b.score-a.score).slice(0,3).map(t=>'['+t.score.toFixed(1)+'] '+(t.title||'').split('→')[0].slice(0,26));
  console.log(q+' =>\n   '+top.join('\n   '));
}
