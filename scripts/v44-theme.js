'use strict';
/** v44 主题模式（白天/夜晚）+ 页面淡入美化 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const PRE_PAINT = '<script>(function(){try{var t=localStorage.getItem(\'chemaiTheme\');if(t===\'light\'||t===\'dark\'){document.documentElement.setAttribute(\'data-theme\',t);}}catch(e){}})();</script>';
const LIGHT_CSS = '[data-theme="light"]{color-scheme:light;--bg:#f5f7fa;--bg2:#eaeef4;--card:#ffffff;--hover:#e8ecf2;--card-hover:#e8ecf2;--t1:#1f2937;--t2:#475569;--t3:#64748b;--txt:#1f2937;--txt2:#475569;--txt3:#64748b;--bd:rgba(15,23,42,.08);--bd2:rgba(15,23,42,.16);--border:rgba(15,23,42,.08);--border2:rgba(15,23,42,.16);--shadow:0 8px 24px rgba(15,23,42,.08)}';
const EXTRA_CSS = '[data-theme="light"] .navbar{background:rgba(255,255,255,.82)}';
const TOGGLE_CSS = '.theme-toggle{background:var(--bg2);border:1px solid var(--bd2);color:var(--t2);width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:15px;display:inline-flex;align-items:center;justify-content:center;transition:.25s;flex-shrink:0;line-height:1}.theme-toggle:hover{border-color:var(--em);color:var(--em);transform:translateY(-1px)}';
const FADE_CSS = 'body{animation:chemaiFade .45s ease}@keyframes chemaiFade{from{opacity:0}to{opacity:1}}';
const TOGGLE_BTN = '\n    <button class="theme-toggle" onclick="toggleTheme()" title="切换白天/夜晚" aria-label="切换主题">🌓</button>';
const FOOT_JS = '<script>function toggleTheme(){var h=document.documentElement,cur=h.getAttribute(\'data-theme\')===\'light\'?\'dark\':\'light\';h.setAttribute(\'data-theme\',cur);try{localStorage.setItem(\'chemaiTheme\',cur);}catch(e){}}</script>';

const PAGES = [
  { file: 'assistant.html', navAnchor: '      <a href="corpus.html">语料库</a>\n    </div>', insertAfter: '      <a href="corpus.html">语料库</a>\n    </div>\n    ' },
  { file: 'main.html',      navAnchor: '      <a href="corpus.html">语料库</a>\n    </div>', insertAfter: '      <a href="corpus.html">语料库</a>\n    </div>\n    ' },
  { file: 'corpus.html',    navAnchor: '      <a href="corpus.html" class="active">语料库</a>\n    </div>', insertAfter: '      <a href="corpus.html" class="active">语料库</a>\n    </div>\n    ' },
  { file: 'prep.html',      navAnchor: '      <a href="corpus.html">语料库</a>\n    </div>', insertAfter: '      <a href="corpus.html">语料库</a>\n    </div>\n    ' },
  { file: 'knowledge.html', navAnchor: '    <a class="nav-link" href="corpus.html">语料库</a>\n  </div>', insertAfter: '    <a class="nav-link" href="corpus.html">语料库</a>\n  </div>\n  ' }
];

function rep(s, oldS, newS, label, file) {
  const n = s.split(oldS).length - 1;
  if (n !== 1) { console.error('❌ [' + file + '] ' + label + ' 命中 ' + n); process.exit(1); }
  return s.split(oldS).join(newS);
}

for (const p of PAGES) {
  const fp = path.join(ROOT, p.file);
  let s = fs.readFileSync(fp, 'utf8');
  // 混合行尾问题：锚点/插入一律用 LF（nav 区域为 LF），git 提交时统一归一化
  const EOL = '\n';
  // 导航锚点（LF）
  const navAnchor = p.navAnchor;

  // 1. html 加 data-theme
  s = rep(s, '<html lang="zh-CN">', '<html lang="zh-CN" data-theme="dark">', 'html data-theme', p.file);
  // 2. 真实 <head>（后跟换行）前插预加载主题脚本
  const headRe = /<head>(\r?\n)/;
  const hm = s.match(headRe);
  if (!hm) { console.error('❌ [' + p.file + '] 未找到真实 <head>'); process.exit(1); }
  s = s.replace(headRe, '<head>' + hm[1] + PRE_PAINT + hm[1]);
  // 3. :root 后插白天变量
  const rootRe = /:root\{[^}]*\}(\r?\n)/;
  const rm = s.match(rootRe);
  if (!rm) { console.error('❌ [' + p.file + '] 未找到 :root 块'); process.exit(1); }
  s = s.replace(rootRe, rm[0] + LIGHT_CSS + EXTRA_CSS + TOGGLE_CSS + FADE_CSS + EOL);
  // 4. 导航里插切换按钮（用 LF 锚点 + \r?\n 兜底）
  const navRe = new RegExp(p.navAnchor.replace(/\n/g, '\\r?\\n'));
  const nm = s.match(navRe);
  if (!nm || nm.length !== 1) { console.error('❌ [' + p.file + '] 导航锚点命中 ' + (nm ? nm.length : 0)); process.exit(1); }
  s = s.replace(navRe, p.insertAfter + '<button class="theme-toggle" onclick="toggleTheme()" title="切换白天/夜晚" aria-label="切换主题">🌓</button>');
  // 5. 真实 </body>（后跟换行 </html>）前插切换 JS
  const bodyRe = /<\/body>(\r?\n)(<\/html>)/;
  const bm = s.match(bodyRe);
  if (!bm) { console.error('❌ [' + p.file + '] 未找到真实 </body>'); process.exit(1); }
  s = s.replace(bodyRe, FOOT_JS + bm[1] + '</body>' + bm[1] + '</html>');

  fs.writeFileSync(fp, s, 'utf8');
  console.log('✓ ' + p.file);
}
console.log('完成');
