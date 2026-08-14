'use strict';
/** v44.1 修复：①全站主题切换按钮图标随主题变化 ②corpus/knowledge 白天模式深色残留 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function readF(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
function writeF(f, s) { fs.writeFileSync(path.join(ROOT, f), s, 'utf8'); }

function rep(file, oldS, newS, label) {
  const s = readF(file);
  const n = s.split(oldS).length - 1;
  if (n !== 1) { console.error('❌ [' + file + '] ' + label + ' 命中 ' + n); process.exit(1); }
  writeF(file, s.split(oldS).join(newS));
  console.log('✓ [' + file + '] ' + label);
}

function repRe(file, re, newS, label) {
  const s = readF(file);
  const m = s.match(re);
  if (!m) { console.error('❌ [' + file + '] ' + label + ' 未匹配'); process.exit(1); }
  writeF(file, s.replace(re, newS));
  console.log('✓ [' + file + '] ' + label);
}

// ===== A. 全站 5 页：切换按钮图标随主题 =====
const BTN_OLD = '<button class="theme-toggle" onclick="toggleTheme()" title="切换白天/夜晚" aria-label="切换主题">🌓</button>';
const BTN_NEW = '<button class="theme-toggle" id="themeToggleBtn" onclick="toggleTheme()" title="切换白天/夜晚" aria-label="切换主题"></button>';
const JS_OLD = "<script>function toggleTheme(){var h=document.documentElement,cur=h.getAttribute('data-theme')==='light'?'dark':'light';h.setAttribute('data-theme',cur);try{localStorage.setItem('chemaiTheme',cur);}catch(e){}}</script>";
const JS_NEW = "<script>function setThemeIcon(){var b=document.getElementById('themeToggleBtn');if(b)b.textContent=document.documentElement.getAttribute('data-theme')==='light'?'\u{1F319}':'\u{2600}\u{FE0F}';}function toggleTheme(){var h=document.documentElement,cur=h.getAttribute('data-theme')==='light'?'dark':'light';h.setAttribute('data-theme',cur);try{localStorage.setItem('chemaiTheme',cur);}catch(e){}setThemeIcon();}try{setThemeIcon();}catch(e){}</script>";
['assistant.html', 'main.html', 'corpus.html', 'prep.html', 'knowledge.html'].forEach(f => {
  rep(f, BTN_OLD, BTN_NEW, '按钮图标');
  rep(f, JS_OLD, JS_NEW, '切换JS');
});

// ===== B. corpus 白天面板 =====
rep('corpus.html',
  '[data-theme="light"] .navbar{background:rgba(255,255,255,.82)}',
  '[data-theme="light"] .navbar{background:rgba(255,255,255,.82)}[data-theme="light"] .bar-track,[data-theme="light"] .rg-box,[data-theme="light"] .reco-item,[data-theme="light"] .log-item,[data-theme="light"] .sync-item{background:rgba(226,232,240,.6)}',
  'corpus白天面板');

// ===== C. knowledge 白天修复 =====
// C1. :root 加 kg 画布变量
repRe('knowledge.html', /--radius:16px;(\r?\n)(\})/, '--radius:16px;$1  --kg-pill:rgba(10,14,26,.78);--kg-label-text:rgba(255,255,255,.78);--kg-stroke:rgba(10,14,26,.92);--kg-minimap:rgba(10,14,26,.88);$1$2', 'kg画布变量');
// C2. 白天变量 + 元素覆盖
rep('knowledge.html',
  '[data-theme="light"] .navbar{background:rgba(255,255,255,.82)}',
  '[data-theme="light"] .navbar{background:rgba(255,255,255,.82)}' +
  '[data-theme="light"]{--kg-pill:rgba(255,255,255,.92);--kg-label-text:rgba(31,41,55,.85);--kg-stroke:rgba(255,255,255,.96);--kg-minimap:rgba(255,255,255,.9)}' +
  '[data-theme="light"] .stage{background:radial-gradient(1200px 700px at 50% 42%,#eef2f7 0%,var(--bg) 62%)}' +
  '[data-theme="light"] #miniMap{background:rgba(255,255,255,.9)}' +
  '[data-theme="light"] .panel-close,[data-theme="light"] .doc-path{background:rgba(226,232,240,.6)}' +
  '[data-theme="light"] .ov-code{background:#eef1f6;color:#047857}' +
  '[data-theme="light"] .path-chip.cur{color:#059669}',
  'knowledge白天覆盖');
// C3. 画布颜色主题感知
rep('knowledge.html', "ctx.fillStyle = 'rgba(10,14,26,.78)';", "ctx.fillStyle = kgVar('--kg-pill') || 'rgba(10,14,26,.78)';", '画布pill');
rep('knowledge.html', "ctx.fillStyle = 'rgba(255,255,255,.78)';", "ctx.fillStyle = kgVar('--kg-label-text') || 'rgba(255,255,255,.78)';", '画布label文本');
rep('knowledge.html', "ctx.strokeStyle = 'rgba(10,14,26,.92)';", "ctx.strokeStyle = kgVar('--kg-stroke') || 'rgba(10,14,26,.92)';", '画布stroke');
rep('knowledge.html', "mctx.fillStyle = 'rgba(10,14,26,.88)';", "mctx.fillStyle = kgVar('--kg-minimap') || 'rgba(10,14,26,.88)';", '画布minimap');
// C4. kgVar 助手
rep('knowledge.html', 'function draw(){', "function kgVar(n){try{return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}catch(e){return '';}}\nfunction draw(){", 'kgVar助手');

console.log('全部完成');
