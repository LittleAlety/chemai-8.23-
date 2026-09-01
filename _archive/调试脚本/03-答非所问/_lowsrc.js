'use strict';
const fs = require('fs'), path = require('path');
const la = require(path.join(process.cwd(), '训练管道/local_answer.js')); la.init();
const faqLib = require(path.join(process.cwd(), 'scripts/lib-assistant-faq.js'));
const arr = faqLib.readFAQRuntime();
const byTitle = {}; arr.forEach((e, i) => { if (!byTitle[e.title]) byTitle[e.title] = i; });
const bank = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'Agent工作区/Agent-B-问题生成/self_train_q_proc200_final.json'), 'utf8'));
const scores = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'Agent工作区/Agent-报告/self_train_baseline_scores.json'), 'utf8'));
const sc = {}; scores.forEach(s => sc[s.id] = s.score);
function norm(s){return String(s||'').toLowerCase().replace(/\s+/g,'');}

// 答非所问：score<=4 的题，看它命中条目的 keys 是否有机械滑窗 n-gram
const lows = bank.filter(q => (sc[q.id] ?? 0) <= 4 && q.referenceAnswer);
lows.forEach(q => {
  const r = la.answer(q.question);
  const t = (r.matchedFAQ && r.matchedFAQ.title) || '(none)';
  const idx = byTitle[t];
  const e = idx != null ? arr[idx] : null;
  const keys = (e && e.keys) || [];
  // 严格滑窗检测：两 key 互为子串, 或 LCS>=min(len)-1(相邻滑窗)
  function wchain(kk){
    const k=[...new Set(kk.map(norm).filter(x=>x.length>=4))];
    const parent={};k.forEach(x=>parent[x]=x);
    function find(x){return parent[x]===x?x:(parent[x]=find(parent[x]));}
    function uni(a,b){parent[find(a)]=find(b);}
    function lcs(a,b){let best=0;for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){let l=0;while(i+l<a.length&&j+l<b.length&&a[i+l]===b[j+l])l++;if(l>best)best=l;}return best;}
    for(let i=0;i<k.length;i++)for(let j=i+1;j<k.length;j++){const a=k[i],b=k[j];
      let ov=a.includes(b)||b.includes(a);
      if(!ov){const m=Math.min(a.length,b.length);if(lcs(a,b)>=Math.max(4,m-1))ov=true;}
      if(ov)uni(a,b);}
    const g={};k.forEach(x=>{const r=find(x);(g[r]=g[r]||[]).push(x);});
    let max=0,big=null;for(const r in g){if(g[r].length>max){max=g[r].length;big=g[r];}}
    return {max,big};
  }
  const w = e ? wchain(keys) : {max:0,big:null};
  console.log('\n['+q.id+' s='+sc[q.id]+'] 题: '+q.question.slice(0,70));
  console.log('  命中 -> '+t.slice(0,42)+'  (idx#'+idx+')');
  if (e) console.log('  keysLen='+keys.length+' 滑窗族='+w.max+' 窗口keys:'+JSON.stringify(w.big||[]));
  else console.log('  (未在FAQ定位到该标题)');
});
