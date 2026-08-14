'use strict';
/** v44：向 SPA 编译产物注入本地视频（视频资源库页 /videos）
 *  4 处替换，每处必须唯一命中，否则中止。 */

const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'assets', 'index-B-pT4Snc.js');
let s = fs.readFileSync(FILE, 'utf8');

function rep(oldS, newS, label) {
  const count = s.split(oldS).length - 1;
  if (count !== 1) { console.error('❌ [' + label + '] 命中 ' + count + ' 次，预期 1'); process.exit(1); }
  s = s.split(oldS).join(newS);
  console.log('✓ [' + label + ']');
}

// A. 在 apt 数组开头插入 4 个本地视频条目（置顶，唯一 bvid 作 React key）
rep(
  'const apt=[{bvid:"BV18f4y1q7gy",title:"三草酸合铁酸钾的制备",author:"宁理理化学院"',
  'const apt=[' +
    '{bvid:"LOCAL0",local:1,title:"三草酸合铁酸钾制备（王志勇）",author:"站内教学视频",views:"本地",description:"本地录制 · 制备全流程",src:"三草酸合铁酸钾资料/三草酸合铁酸钾视频资料/三草酸合铁酸钾制备 王志勇.mp4"},' +
    '{bvid:"LOCAL1",local:1,title:"三草酸合铁酸钾性质与配离子电荷（王志勇）",author:"站内教学视频",views:"本地",description:"性质验证与配离子电荷测定",src:"三草酸合铁酸钾资料/三草酸合铁酸钾视频资料/三草酸合铁酸钾性质与配离子电荷 王志勇.mp4"},' +
    '{bvid:"LOCAL2",local:1,title:"三草酸合铁酸钾制备（上）·胡锴",author:"站内教学视频",views:"本地",description:"制备流程（上）",src:"三草酸合铁酸钾资料/三草酸合铁酸钾视频资料/三草酸合铁酸钾（上） 胡锴.mp4"},' +
    '{bvid:"LOCAL3",local:1,title:"三草酸合铁酸钾制备（下）·胡锴",author:"站内教学视频",views:"本地",description:"制备流程（下）",src:"三草酸合铁酸钾资料/三草酸合铁酸钾视频资料/三草酸合铁酸钾（下） 胡锴.mp4"},' +
    '{bvid:"BV18f4y1q7gy",title:"三草酸合铁酸钾的制备",author:"宁理理化学院"',
  'A-插入本地条目'
);

// B. iframe 渲染 → 本地条目渲染 <video>，否则保留 bilibili iframe
rep(
  'b.jsx("iframe",{"code-path":"src/pages/Videos.tsx:92:9",src:`//player.bilibili.com/player.html?bvid=${t.bvid}&page=1&high_quality=1&danmaku=0&autoplay=0`,className:"absolute inset-0 w-full h-full",style:{border:"none"},allowFullScreen:!0,onLoad:()=>n(!0)})',
  't.local?b.jsx("video",{"code-path":"src/pages/Videos.tsx:92:9",src:t.src,controls:!0,preload:"metadata",className:"absolute inset-0 w-full h-full",style:{background:"#000"},onLoadedData:()=>n(!0)}):b.jsx("iframe",{"code-path":"src/pages/Videos.tsx:92:9",src:`//player.bilibili.com/player.html?bvid=${t.bvid}&page=1&high_quality=1&danmaku=0&autoplay=0`,className:"absolute inset-0 w-full h-full",style:{border:"none"},allowFullScreen:!0,onLoad:()=>n(!0)})',
  'B-iframe条件渲染'
);

// C. 加载遮罩对本地视频跳过
rep(
  '!r&&b.jsx("div",{"code-path":"src/pages/Videos.tsx:100:11"',
  '!r&&!t.local&&b.jsx("div",{"code-path":"src/pages/Videos.tsx:100:11"',
  'C-遮罩跳过本地'
);

// D. B站链接对本地条目显示"站内"（无 bvid 不链 B站）
rep(
  'b.jsxs("a",{"code-path":"src/pages/Videos.tsx:127:11",href:`https://www.bilibili.com/video/${t.bvid}`,target:"_blank",rel:"noopener noreferrer",className:"flex items-center gap-1 text-xs transition-colors hover:text-[var(--accent-primary)]",style:{color:"var(--text-muted)"},children:[b.jsx(wNe,{"code-path":"src/pages/Videos.tsx:134:13",size:12}),"B站"]})',
  't.local?b.jsxs("span",{"code-path":"src/pages/Videos.tsx:127:11",className:"flex items-center gap-1 text-xs",style:{color:"var(--accent-primary)"},children:[b.jsx(wNe,{"code-path":"src/pages/Videos.tsx:134:13",size:12}),"站内"]}):b.jsxs("a",{"code-path":"src/pages/Videos.tsx:127:11",href:`https://www.bilibili.com/video/${t.bvid}`,target:"_blank",rel:"noopener noreferrer",className:"flex items-center gap-1 text-xs transition-colors hover:text-[var(--accent-primary)]",style:{color:"var(--text-muted)"},children:[b.jsx(wNe,{"code-path":"src/pages/Videos.tsx:134:13",size:12}),"B站"]})',
  'D-链接条件'
);

fs.writeFileSync(FILE, s, 'utf8');
console.log('✓ 已写入 bundle，新长度 ' + s.length);
