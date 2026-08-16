// v55: 精致化重构 — 修复--em统计数字/语料概览布局 + 品牌化标题/卡片/浅色主题 → 4页(assistant稍后)
// 用法: node _v55_apply.js [assistant|main|corpus|prep|knowledge]... (默认 main corpus prep knowledge)
const fs = require('fs');
const RULES = `/* === ChemAI 精致统一 v55 === */
/* A) 修复: main/corpus/prep 的 :root 未定义 --em → .stat-num 渐变与分区装饰条失效(数字不可见) */
:root{--em:#10b981}
/* B) 修复: 语料库概览 5 张统计卡在 2 列布局下第 5 张落单 → 奇数末卡占满整行 */
@media (max-width:960px){.stats .stat:last-child:nth-child(odd){grid-column:1/-1}}
/* C) 标题: 7色彩虹 → 品牌三色流光(翠绿-青-蓝), 更沉稳克制 */
.page-head h1,.banner h1,.hero-title,.welcome-title,.section-main-title{
  background:linear-gradient(90deg,#34d399,#2dd4bf,#60a5fa,#2dd4bf,#34d399);
  background-size:300% 100%;
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  animation:chemaiShine 8s linear infinite;
  filter:drop-shadow(0 2px 14px rgba(45,212,191,.22));
}
/* D) 卡片悬浮: 去掉 scale 抖动, 优雅抬升 + 光晕收敛 */
.card:hover,.side-card:hover,.calc-card:hover,.wrong-item:hover,.doc-card:hover,.qcard:hover,.learn-card:hover,.stat-card:hover{
  transform:translateY(-4px);
  box-shadow:0 18px 44px rgba(2,6,23,.42),0 0 0 1px rgba(16,185,129,.16),0 0 22px rgba(16,185,129,.12);
  border-color:rgba(16,185,129,.45);
}
/* E) 卡片顶部发丝高光(悬浮显现) */
.card,.side-card,.calc-card,.doc-card,.qcard,.stat{position:relative}
.card::before,.side-card::before,.calc-card::before,.doc-card::before,.qcard::before,.stat::before{
  content:"";position:absolute;top:0;left:14px;right:14px;height:1px;border-radius:999px;
  background:linear-gradient(90deg,transparent,rgba(45,212,191,.4),transparent);
  opacity:0;transition:opacity .3s ease;pointer-events:none;
}
.card:hover::before,.side-card:hover::before,.calc-card:hover::before,.doc-card:hover::before,.qcard:hover::before,.stat:hover::before{opacity:1}
/* F) 浅色主题精致化: 柔和分层阴影 + 细边框 */
[data-theme="light"] .card,[data-theme="light"] .stat,[data-theme="light"] .side-card,
[data-theme="light"] .calc-card,[data-theme="light"] .doc-card,[data-theme="light"] .qcard{
  box-shadow:0 1px 2px rgba(15,23,42,.04),0 10px 28px rgba(15,23,42,.05);
  border-color:rgba(15,23,42,.09);
}
[data-theme="light"] .navbar{background:rgba(255,255,255,.86)}
[data-theme="light"] ::-webkit-scrollbar-thumb{background:rgba(15,23,42,.2);border:2px solid transparent;background-clip:content-box;border-radius:7px}
[data-theme="light"] .bar-track{background:rgba(15,23,42,.08)}
`;
const ANCHOR = '@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}';
const args = process.argv.slice(2);
const files = args.length ? args : ['main', 'corpus', 'prep', 'knowledge'];
let ok = 0;
for (const name of files) {
  const f = name.endsWith('.html') ? name : name + '.html';
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('ChemAI 精致统一 v55')) { console.log(f + ': 已存在'); continue; }
  if (s.includes(ANCHOR)) {
    s = s.replace(ANCHOR, RULES + '\n' + ANCHOR);
    fs.writeFileSync(f, s, 'utf8');
    ok++;
    console.log(f + ': ✓ 已注入 v55');
  } else console.log(f + ': ✗ 未找到锚点');
}
console.log('完成 ' + ok + ' 个文件');
