// v51: 艺术字美化 → 5 页
const fs = require('fs');
const RULES = `/* === ChemAI 艺术字 v51 === */
/* 主标题: 动态流光渐变 + 光晕 */
.page-head h1,.banner h1,.hero-title,.welcome-title,.section-main-title{
  background:linear-gradient(90deg,#34d399,#2dd4bf,#60a5fa,#a78bfa,#f472b6,#2dd4bf,#34d399);
  background-size:300% 100%;
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  animation:chemaiShine 7s linear infinite;
  filter:drop-shadow(0 2px 16px rgba(45,212,191,.3));
}
@keyframes chemaiShine{0%{background-position:0% 0}100%{background-position:300% 0}}
/* 统计数字: 霓虹光晕 */
.stat-num{filter:drop-shadow(0 0 12px rgba(45,212,191,.45))}
/* 等级徽章 / 徽标数字: 发光 */
.g-tag{text-shadow:0 0 10px currentColor}
.badge b{filter:drop-shadow(0 0 6px rgba(45,212,191,.4))}
/* 面板/分区标题: 柔和光晕 */
.panel-title,.section-title,.sec-title{text-shadow:0 0 16px rgba(45,212,191,.22)}
/* 主按钮文字: 轻微立体光 */
.btn.primary{text-shadow:0 1px 5px rgba(4,18,27,.4)}
/* 关键词高亮 */
.hl{text-shadow:0 0 14px rgba(45,212,191,.35)}
`;
const files = ['assistant.html', 'main.html', 'corpus.html', 'prep.html', 'knowledge.html'];
const ANCHOR = '@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}';
let ok = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('ChemAI 艺术字 v51')) { console.log(f + ': 已存在'); continue; }
  if (s.includes(ANCHOR)) {
    s = s.replace(ANCHOR, RULES + '\n' + ANCHOR);
    fs.writeFileSync(f, s, 'utf8');
    ok++;
    console.log(f + ': ✓ 已注入 v51');
  } else console.log(f + ': ✗ 未找到锚点');
}
console.log('完成 ' + ok + ' 个文件');
