// v53: 知识图谱主题对比度修复 + 移动端去拥挤
const fs = require('fs');
const RULES = `/* === ChemAI 知识图谱 v53: 主题对比度 + 移动端 === */
/* 浅色主题: 深色浮层元素强制浅色文字(保持"深色玻璃"观感一致) */
[data-theme="light"] .legend-panel,
[data-theme="light"] #tooltip,
[data-theme="light"] .statsbar,
[data-theme="light"] .stage-hint,
[data-theme="light"] .zoom-ctrl button{color:#e2e8f0}
[data-theme="light"] .legend-panel .leg-title,
[data-theme="light"] .legend-panel .leg-row,
[data-theme="light"] .legend-panel .leg-note,
[data-theme="light"] .legend-panel .leg-toggle,
[data-theme="light"] #tooltip .tt-cat,
[data-theme="light"] .statsbar .st-group,
[data-theme="light"] .statsbar span{color:#cbd5e1}
[data-theme="light"] .legend-panel .leg-sec-title{color:#94a3b8}
[data-theme="light"] .fchip:not(.on){color:#cbd5e1}
[data-theme="light"] .seg button.on{color:#047857}
[data-theme="light"] .statsbar b{color:#fbbf24}
/* 浅色主题: 图例/提示面板背景改浅色(更亮)但文字保持深色? 否——保持深色浮层+浅字(上) */

/* 移动端去拥挤 */
@media (max-width:640px){
  .tb-legend{display:none}            /* 图例chips隐藏(浮动图例面板已含) */
  .legend-note{display:none}
  .search-wrap{flex:1 1 130px;min-width:130px}
  #searchInput{width:100%}
  .stage{height:calc(100vh - 225px)}  /* 工具栏更紧凑 → 图谱舞台更多空间 */
  .zoom-ctrl{left:6px;bottom:6px}
  .legend-panel{max-width:150px}
}
@media (max-width:360px){
  .badge.b-teal,.badge.b-purple{display:none}  /* 仅保留核心统计 */
  .stage{height:calc(100vh - 200px)}
}
`;
const f = 'knowledge.html';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('ChemAI 知识图谱 v53')) { console.log('已存在'); process.exit(0); }
const ANCHOR = '@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}';
if (s.includes(ANCHOR)) {
  s = s.replace(ANCHOR, RULES + '\n' + ANCHOR);
  fs.writeFileSync(f, s, 'utf8');
  console.log('✓ knowledge.html 已注入 v53');
} else console.log('✗ 未找到锚点');
