'use strict';
/** v67：为科普探索页 /explore 的卡片注入图片
 *  Rlt(实验现象画廊) 6 卡：顶部横幅图（w-full h-40）
 *  jlt(生活中的化学) 4 卡：描述下方条件缩略图（光敏材料/催化剂按用户要求无图 → e.img?…:null）
 *  数据对象加 img 字段 + 2 个 JSX 模板加 <img>；每处必须唯一命中，否则中止。 */

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

// A. Rlt(实验现象画廊) 6 卡数据对象加 img（Rlt 用 iconColor 前缀，各颜色唯一）
rep('iconColor:"#f59e0b"}',  'iconColor:"#f59e0b",img:"assets/images/FeC2O4-2H2O制备图1.png"}',         'A1-黄色沉淀img');
rep('iconColor:"#f97316"}',  'iconColor:"#f97316",img:"assets/images/加入过氧化氢后颜色1.jpg"}',          'A2-氧化魔法img');
rep('iconColor:"#10b981"}',  'iconColor:"#10b981",img:"assets/images/explore/emerald-crystal.jpg"}',      'A3-翠绿晶体img');
rep('iconColor:"#84cc16"}',  'iconColor:"#84cc16",img:"assets/images/explore/green-crystal.jpg"}',        'A4-阳光变色img');
rep('iconColor:"#3b82f6"}',  'iconColor:"#3b82f6",img:"assets/images/explore/cyanotype.jpg"}',            'A5-蓝晒浪漫img');
rep('iconColor:"#a855f7"}',  'iconColor:"#a855f7",img:"assets/images/氯化铁溶液与产品溶液加硫氰化钾.jpg"}','A6-配合物img');

// B. jlt(生活中的化学) 2 卡数据对象加 img（光敏材料#10b981、催化剂#f59e0b 按用户要求不加）
rep('蓝色影像作品。",color:"#3b82f6"}', '蓝色影像作品。",color:"#3b82f6",img:"assets/images/explore/blueprint.jpg"}',     'B1-蓝晒摄影术img');
rep('治疗工具。",color:"#a855f7"}',     '治疗工具。",color:"#a855f7",img:"assets/images/explore/vitamin-b12.png"}',       'B2-药物化学img');

// C. Rlt 卡片模板：渐变层后插入顶部横幅图（卡片 overflow-hidden 裁剪圆角）
rep(
  'b.jsx("div",{"code-path":"src/pages/Explore.tsx:211:15",className:`absolute inset-0 bg-gradient-to-br ${e.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`})',
  'b.jsx("div",{"code-path":"src/pages/Explore.tsx:211:15",className:`absolute inset-0 bg-gradient-to-br ${e.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}),b.jsx("img",{src:e.img,alt:e.title,className:"w-full h-40 object-cover"})',
  'C-Rlt顶部横幅img'
);

// D. jlt 卡片模板：描述后插入条件缩略图（无图卡为 null）
rep(
  'b.jsx("p",{"code-path":"src/pages/Explore.tsx:309:21",className:"text-sm leading-relaxed",style:{color:"var(--text-secondary)"},children:e.desc})',
  'b.jsx("p",{"code-path":"src/pages/Explore.tsx:309:21",className:"text-sm leading-relaxed",style:{color:"var(--text-secondary)"},children:e.desc}),e.img?b.jsx("img",{src:e.img,alt:e.title,className:"w-full h-36 object-cover rounded-lg mt-3"}):null',
  'D-jlt条件缩略图'
);

fs.writeFileSync(FILE, s, 'utf8');
console.log('✓ 已写入 bundle，新长度 ' + s.length);
