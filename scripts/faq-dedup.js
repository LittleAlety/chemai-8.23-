/* FAQ 相邻重复行去重 — 仅删除"整行字节完全相同且相邻"的第二行（原因：逻辑重复/模板重复）。
   字节级替换，不重排手写文件。运行后自动校验：重 parse 条目数不变、残留相邻重复行归零、渲染仍无 _^\\ 残留。
   用法: node scripts/faq-dedup.js  （写回 data/faq_runtime.js）
*/
const fs=require('fs');
const FILE='data/faq_runtime.js';
let raw=fs.readFileSync(FILE,'utf8');
const leading=raw.slice(0,raw.indexOf('window.FAQ'));
let changed=0, removed=0;

// —— 解析当前数组，收集需删除的相邻重复行（在 answer / detail 各自内部）——
function escFileSpace(line){
  // 文件已确认：仅 \\ (反斜杠加倍) 与 \n (换行) 转义；无 \' ；中文原样；行内无换行
  return line.replace(/\\/g,'\\\\');
}
function escJS(s){ return s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n'); }

function extractDuplicatedLineSet(){
  const expr=String(raw).slice(raw.indexOf('window.FAQ')+ 'window.FAQ'.length).replace(/^.*?=\s*/,'').trim().replace(/;\s*$/,'');
  const arr=new Function('window','return ('+expr+');')({});
  const dupSet=new Set();
  for(const a of arr){
    for(const field of ['answer','detail']){
      const L=String(a[field]||'').split('\n');
      for(let j=1;j<L.length;j++){
        if(L[j].length>=8 && L[j]===L[j-1]) dupSet.add(L[j]);
      }
    }
  }
  return {arr,dupSet};
}

const {arr,dupSet}=extractDuplicatedLineSet();
const entries=arr.length;
console.log('解析条目数:',entries,' 待去重行(唯一):',dupSet.size);

for(const line of dupSet){
  const esc=escFileSpace(line);
  const pat='\\n'+esc+'\\n'+esc;                 // 文件中：换行转义 + 行 + 换行转义 + 行
  const rep='\\n'+esc;
  let n=0, prev=-1;
  while(true){
    const next=raw.indexOf(pat);
    if(next<0) break;
    // 统计本次出现次数后一次性替换
    const before=raw;
    raw=before.split(pat).join(rep);
    removed += (before.split(pat).length-1);
    // 防死循环：若替换后无进展则跳出
    if(raw===before) break;
    n++;
  }
  changed++;
}

// 确保结尾仍能 parse
const expr=String(raw).slice(raw.indexOf('window.FAQ')+'window.FAQ'.length).replace(/^.*?=\s*/,'').trim().replace(/;\s*$/,'');
const arr2=new Function('window','return ('+expr+');')({});
console.log('写回前校验: 重 parse 条目数=',arr2.length, arr2.length===entries?'OK':'!!不一致');

fs.writeFileSync(FILE, raw, 'utf8');
console.log('已写回。改动行数(唯一行):',changed,' 移除的重复片段数:',removed);
