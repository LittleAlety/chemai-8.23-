// v49b：网格轨道改为 minmax(0,1fr)，根治窄屏横向溢出
const fs = require('fs');
const OLD = `@media (max-width:1080px){
  .tabs{overflow-x:auto;scrollbar-width:none;flex-wrap:nowrap;-webkit-overflow-scrolling:touch}
  .tabs::-webkit-scrollbar{display:none}
  .tab{flex:1 0 auto;min-width:150px}
}`;
const NEW = `@media (max-width:1080px){
  .grid{grid-template-columns:minmax(0,1fr)}
  .grid>*{min-width:0}
  .tabs{overflow-x:auto;scrollbar-width:none;flex-wrap:nowrap;-webkit-overflow-scrolling:touch}
  .tabs::-webkit-scrollbar{display:none}
  .tab{flex:1 0 auto;min-width:150px}
}`;
const files = ['assistant.html', 'main.html', 'corpus.html', 'prep.html', 'knowledge.html'];
let ok = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes(OLD) && !s.includes('minmax(0,1fr)')) {
    s = s.replace(OLD, NEW);
    fs.writeFileSync(f, s, 'utf8');
    ok++;
    console.log(f + ': ✓ 已升级网格修复');
  } else if (s.includes('minmax(0,1fr)')) {
    console.log(f + ': 已含修复，跳过');
  } else {
    console.log(f + ': ✗ 未找到 v49 tab 块');
  }
}
console.log('完成 ' + ok + ' 个文件');
