// v52: 全局显示效果与版面增强 → 5 页
const fs = require('fs');
const RULES = `/* === ChemAI 全局显示 v52 === */
/* 环境光斑(固定层, 不挡交互) */
body::after{content:"";position:fixed;inset:auto;width:560px;height:560px;left:-180px;top:-140px;z-index:0;pointer-events:none;border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,.16),transparent 68%);filter:blur(70px);animation:chemaiDrift 26s ease-in-out infinite}
@keyframes chemaiDrift{0%,100%{transform:translate(0,0)}33%{transform:translate(90px,60px) scale(1.08)}66%{transform:translate(30px,-50px)}}
/* 导航: 更透毛玻璃 + 激活/悬浮下划线动画 */
.navbar{backdrop-filter:blur(20px) saturate(1.5);-webkit-backdrop-filter:blur(20px) saturate(1.5);border-bottom:1px solid rgba(45,212,191,.14)}
.nav-links a{position:relative;isolation:isolate}
.nav-links a::after{content:"";position:absolute;left:11px;right:11px;bottom:3px;height:2px;border-radius:2px;background:linear-gradient(90deg,var(--em,var(--emerald,#10b981)),var(--teal,#2dd4bf));transform:scaleX(0);transform-origin:left;transition:transform .3s cubic-bezier(.2,.8,.3,1);box-shadow:0 0 10px rgba(45,212,191,.55)}
.nav-links a:hover::after,.nav-links a.active::after{transform:scaleX(1)}

/* 滚动条: 渐变滑块 */
::-webkit-scrollbar{width:11px;height:11px}
::-webkit-scrollbar-thumb{background:linear-gradient(180deg,rgba(45,212,191,.5),rgba(96,165,250,.5));border-radius:7px;border:2px solid transparent;background-clip:content-box}
::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,rgba(45,212,191,.8),rgba(96,165,250,.8));background-clip:content-box;border:2px solid transparent}

/* 键盘可达性: 焦点环 */
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid rgba(45,212,191,.7);outline-offset:2px;border-radius:6px}

/* 卡片悬浮: 彩色光晕边框 */
.card:hover,.side-card:hover,.stat-card:hover,.calc-card:hover,.doc-card:hover,.qcard:hover{box-shadow:0 12px 34px rgba(2,6,23,.4),0 0 0 1px rgba(45,212,191,.18),0 0 26px rgba(16,185,129,.13)}

/* 版面节奏: 标题字距 + 容器一致性 */
.page-head h1,.banner h1,.page-title,section h2{letter-spacing:.02em}
.wrap,.page,.container{scroll-margin-top:80px}

/* 页脚: 顶部光晕分隔 */
footer{border-top:1px solid rgba(45,212,191,.15);background:linear-gradient(180deg,transparent,rgba(10,14,26,.6));padding-top:22px;margin-top:30px}
`;
const files = ['assistant.html', 'main.html', 'corpus.html', 'prep.html', 'knowledge.html'];
const ANCHOR = '@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}';
let ok = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('ChemAI 全局显示 v52')) { console.log(f + ': 已存在'); continue; }
  if (s.includes(ANCHOR)) {
    s = s.replace(ANCHOR, RULES + '\n' + ANCHOR);
    fs.writeFileSync(f, s, 'utf8');
    ok++;
    console.log(f + ': ✓ 已注入 v52');
  } else console.log(f + ': ✗ 未找到锚点');
}
console.log('完成 ' + ok + ' 个文件');
