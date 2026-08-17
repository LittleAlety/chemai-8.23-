// v49：移动端 tab 栏横向滚动，修复窄屏横向溢出（撑破网格列）
const fs = require('fs');
const RULES = `/* —— 移动端 tab 栏横向滚动（避免窄屏溢出）—— */
@media (max-width:1080px){
  .tabs{overflow-x:auto;scrollbar-width:none;flex-wrap:nowrap;-webkit-overflow-scrolling:touch}
  .tabs::-webkit-scrollbar{display:none}
  .tab{flex:1 0 auto;min-width:150px}
}
`;
const files = ['assistant.html', 'main.html', 'corpus.html', 'prep.html', 'knowledge.html'];
const ANCHOR = '@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}';
let ok = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes(RULES)) { console.log(f + ': 已存在，跳过'); continue; }
  if (s.includes(ANCHOR)) {
    s = s.replace('/* === ChemAI 全局美化 v48：动态效果强化 + 按键边界清晰 === */', '/* === ChemAI 全局美化 v49：动态效果强化 + 按键边界清晰 + 移动端tab滚动 === */');
    s = s.replace(ANCHOR, RULES + '\n' + ANCHOR);
    fs.writeFileSync(f, s, 'utf8');
    ok++;
    console.log(f + ': ✓ 已插入 v49 移动端tab规则');
  } else {
    console.log(f + ': ✗ 未找到锚点');
  }
}
console.log('完成 ' + ok + ' 个文件');
