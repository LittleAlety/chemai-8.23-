// v50: 全局版面与可视化打磨块 → 5 页
const fs = require('fs');
const RULES = `/* === ChemAI 全局版面 v50：布局与可视化打磨 === */
/* 进度条渐变光晕 */
.kp-bar i{background:linear-gradient(90deg,#34d399,#2dd4bf,#60a5fa);box-shadow:0 0 8px rgba(45,212,191,.35)}
.ap-bar i{background:linear-gradient(90deg,#34d399,#2dd4bf);box-shadow:0 0 8px rgba(45,212,191,.3)}
.conf-bar .cf-fill{background:linear-gradient(90deg,var(--em),var(--teal));box-shadow:0 0 6px rgba(45,212,191,.3)}
.assess-progress .ap-bar i,.score-bar i{background:linear-gradient(90deg,#34d399,#2dd4bf,#60a5fa)}

/* 报告等级徽章 */
.g-tag{box-shadow:0 2px 8px rgba(2,6,23,.28)}

/* 统计数字渐变 */
.stat-num{font-size:24px;background:linear-gradient(90deg,var(--em),var(--teal),var(--blue));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.stat-icon{filter:drop-shadow(0 2px 5px rgba(16,185,129,.3))}

/* 分区标题装饰条 */
.section-title h2,.sec-title h2,.card-title h2,.panel-title,.rp-sec h3{position:relative;padding-left:14px}
.section-title h2::before,.sec-title h2::before,.card-title h2::before,.rp-sec h3::before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:5px;height:18px;border-radius:3px;background:linear-gradient(180deg,var(--em),var(--teal));box-shadow:0 0 8px rgba(45,212,191,.4)}

/* 知识图谱工具栏徽章 */
.badge{border:1px solid var(--bd2, rgba(148,163,184,.25));background:rgba(16,185,129,.07);padding:4px 11px;border-radius:8px;font-size:12px}
.badge b{color:var(--em)}
.tb-group .tb-label{letter-spacing:.05em}

/* 图表卡片/容器 */
#barChart,.chart-box{background:rgba(2,6,23,.25);border:1px solid var(--bd);border-radius:12px;padding:12px 14px}
`;
const files = ['assistant.html', 'main.html', 'corpus.html', 'prep.html', 'knowledge.html'];
const ANCHOR = '@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}';
let ok = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('ChemAI 全局版面 v50')) { console.log(f + ': 已存在'); continue; }
  if (s.includes(ANCHOR)) {
    s = s.replace(ANCHOR, RULES + '\n' + ANCHOR);
    fs.writeFileSync(f, s, 'utf8');
    ok++;
    console.log(f + ': ✓ 已注入 v50');
  } else console.log(f + ': ✗ 未找到锚点');
}
console.log('完成 ' + ok + ' 个文件');
