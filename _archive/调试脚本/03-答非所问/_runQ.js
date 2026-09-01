// Driver: run a list of questions through the REAL matchFAQ (oracle) and dump winner + score breakdown.
// usage: node _runQ.js _questions.json  ->  _results.json
const fs=require('fs'),vm=require('vm');
const ROOT='C:/Users/Little Alety/Desktop/Claude Code/version7-25/';
function brace(s,r){const b=s.indexOf('{',s.search(r));let d=0;for(let i=b;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'){d--;if(d===0)return s.slice(s.search(r),i+1);}}}
const QUEST=JSON.parse(fs.readFileSync(ROOT+(process.argv[2]||'_questions.json'),'utf8'));
const CUR=require(ROOT+'scripts/lib-assistant-faq.js').readFAQRuntime(ROOT+'data/faq_runtime.js');
const S=fs.readFileSync(ROOT+'assistant.html','utf8');
const SUB=S.match(/(?:const|var)\s+SUBMAP\s*=\s*\{.*?\};/s)[0];
const TYPO=S.match(/(?:var|let|const)\s+_typoFix\s*=\s*\{[\s\S]*?\};/)[0];
const FIX=brace(S,/function fixTypos\(q\)/);
const NORM=S.match(/const\s+norm\s*=\s*[^\n]+/)[0];
let MFQ=brace(S,/function matchFAQ\(q\)/);
const anchor='if(score>bestScore){bestScore=score;best=f;}';
const idx=MFQ.indexOf(anchor);
const cand="\n    {__C.push({title:(f&&f.title)||'',score:score,keyScore:keyScore,entScore:entScore,longKey:longKey,lenBonus:lenBonus,titleTopical:titleTopical,distinctHits:distinctHits,total:score});}\n    ";
MFQ=MFQ.slice(0,idx)+cand+MFQ.slice(idx);
const c=vm.createContext({console:console, window:{}, FAQ:CUR});  // FAQ as host object, no huge JSON embed
c.window.FAQ=CUR;
vm.runInContext('var __L=[],__C=[];\n'+SUB+'\n'+NORM+'\n'+TYPO+'\n'+FIX+'\n'+MFQ+'\n;this.__norm=norm;', c);
const results=[];
for(const item of QUEST){
  const q=typeof item==='string'?item:item.q;
  const exp=typeof item==='string'?null:(item.expected_topic||null);
  c.__L=[]; c.__C=[];
  c.matchFAQ(q);
  const top=c.__C.slice().sort((a,b)=>b.score-a.score).slice(0,5);
  results.push({q:q, expected_topic:exp, winner:(top[0]&&top[0].title)||'', top:top});
}
fs.writeFileSync(ROOT+(process.argv[3]||'_results.json'),JSON.stringify(results,null,2));
console.log('wrote _results.json for '+results.length+' questions');
