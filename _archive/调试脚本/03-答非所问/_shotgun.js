'use strict';
const faqLib = require('./scripts/lib-assistant-faq.js');
const arr = faqLib.readFAQRuntime();
function norm(s){return String(s||'').toLowerCase().replace(/\s+/g,'');}
function isShotgun(keys){
  const k=[...new Set(keys.map(norm).filter(x=>x.length>=4))];
  if(k.length<3)return 0;
  const parent={}; k.forEach(x=>parent[x]=x);
  function find(x){return parent[x]===x?x:(parent[x]=find(parent[x]));}
  function uni(a,b){parent[find(a)]=find(b);}
  for(let i=0;i<k.length;i++)for(let j=i+1;j<k.length;j++){
    const a=k[i],b=k[j]; let overlap=false;
    if(a.includes(b)||b.includes(a))overlap=true;
    else {for(let L=5;L<=Math.min(a.length,b.length);L++){let f=false;for(let s=0;s+L<=a.length;s++){const sub=a.slice(s,s+L);if(b.includes(sub)){f=true;break;}}if(f){overlap=true;break;}}}
    if(overlap)uni(a,b);
  }
  const groups={}; k.forEach(x=>{const r=find(x);(groups[r]=groups[r]||[]).push(x);});
  let max=0; for(const g in groups){if(groups[g].length>max)max=groups[g].length;}
  return max;
}
let flagged=[];
for(let i=0;i<arr.length;i++){
  const keys=arr[i].keys||[];
  if(keys.length<3)continue;
  const m=isShotgun(keys);
  if(m>=3)flagged.push({i,m,title:arr[i].title,keys:keys.filter(x=>norm(x).length>=4)});
}
flagged.sort((a,b)=>b.m-a.m);
console.log('共 '+flagged.length+' 条疑似 n-gram shotgun：');
flagged.slice(0,40).forEach(f=>{
  console.log('#'+f.i+' ['+f.m+' keys族] '+f.title.slice(0,42));
  console.log('    keys: '+JSON.stringify(f.keys.slice(0,14)));
});
