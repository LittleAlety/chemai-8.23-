// v48：在 5 页 v47 块中插入"按键边界清晰化"规则（不产生布局位移：边框均已预留）
const fs = require('fs');

const RULES = `/* —— 按键边界清晰化 —— */
.btn.ghost{background:rgba(148,163,184,.07);border-color:rgba(148,163,184,.4);color:var(--t2);box-shadow:0 1px 2px rgba(2,6,23,.25)}
.btn.ghost:hover{background:rgba(148,163,184,.14);border-color:rgba(148,163,184,.62);color:var(--t1)}
.btn.warn{border-color:rgba(251,191,36,.6);background:rgba(251,191,36,.14)}
.tab{background:rgba(148,163,184,.05);border:1px solid rgba(148,163,184,.22);color:var(--t2)}
.tab:hover{background:rgba(148,163,184,.12);border-color:rgba(148,163,184,.45);color:var(--t1)}
.tab.on{background:linear-gradient(135deg,rgba(16,185,129,.22),rgba(45,212,191,.14),rgba(96,165,250,.14));border-color:rgba(16,185,129,.55);box-shadow:0 0 14px rgba(16,185,129,.2)}
.chip{background:var(--bg2);border:1px solid rgba(148,163,184,.4);box-shadow:0 1px 2px rgba(2,6,23,.25)}
.chip:hover{background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.6)}
`;

const files = ['assistant.html', 'main.html', 'corpus.html', 'prep.html', 'knowledge.html'];
const ANCHOR = '@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}';

let ok = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes(RULES) && s.includes(ANCHOR)) {
    s = s.replace('/* === ChemAI 全局美化 v47：动态效果强化 === */', '/* === ChemAI 全局美化 v48：动态效果强化 + 按键边界清晰 === */');
    s = s.replace(ANCHOR, RULES + '\n' + ANCHOR);
    fs.writeFileSync(f, s, 'utf8');
    ok++;
    console.log(f + ': ✓ 已插入 v48 按键边界规则');
  } else if (s.includes(RULES)) {
    console.log(f + ': 已存在，跳过');
  } else {
    console.log(f + ': ✗ 未找到锚点');
  }
}
console.log('完成 ' + ok + ' 个文件');
