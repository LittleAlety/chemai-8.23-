'use strict';
/** v68：修复科普探索页卡片图片压缩畸变 + 填充生活化学两张空卡图
 *  1) Rlt(实验现象画廊) 横幅图：去掉被拉伸的 w-full+h-40+object-cover(后者在编译 CSS 中无 .object-cover 规则，导致 fill 拉伸)，
 *     改用 w-full + 内联 style {aspectRatio:'4/3', objectFit:'cover'} → 等比覆盖裁切，不再畸变。
 *  2) jlt(生活中的化学) 给 光敏材料(#10b981)、催化剂(#f59e0b) 补 img（用户本轮改为要加图；"更精细"条目用 docx 图）。
 *  每处必须唯一命中，否则中止。 */

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

// 1. Rlt 画廊横幅图：修畸变（覆盖裁切，不再 fill 拉伸）
rep(
  'b.jsx("img",{src:e.img,alt:e.title,className:"w-full h-40 object-cover"})',
  'b.jsx("img",{src:e.img,alt:e.title,className:"w-full",style:{aspectRatio:"4/3",objectFit:"cover"}})',
  'Rlt横幅图覆盖裁切'
);

// 2. 光敏材料 卡补图（用唯一描述结尾锚点；纯 color:#10b981 在 bundle 中命中 22 次，不可用）
rep('图案转移。",color:"#10b981"}',  '图案转移。",color:"#10b981",img:"assets/images/explore/cyanotype-botanical.jpg"}', '光敏材料img');

// 3. 催化剂 卡补图
rep('让工业生产更高效节能。",color:"#f59e0b"}', '让工业生产更高效节能。",color:"#f59e0b",img:"assets/images/explore/fe-oxalato-structure.jpg"}', '催化剂img');

fs.writeFileSync(FILE, s, 'utf8');
console.log('✓ 已写入 bundle，新长度 ' + s.length);
