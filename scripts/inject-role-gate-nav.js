'use strict';
/** 角色化受众门控：SPA 顶部导航按身份过滤 科普探索(/explore)/报告评估(/report)。
 *  - 桌面导航 (hidden lg:flex) 与移动导航 (px-4 py-3) 都渲染 qZ，公共前缀恰好出现 2 次。
 *  - 两处都校验：/report 仅 teacher、/explore 仅 non-chemistry，其余恒显。
 *  - n = Zc(h=>h.role)（当前角色）已在两个 qZ.map 调用前定义（已验证）。
 *  公共前缀必须唯一命中，否则中止。 */

const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'assets', 'index-B-pT4Snc.js');
let s = fs.readFileSync(FILE, 'utf8');

const PREFIX = 'qZ.map(h=>{const v=t.pathname';
const SUFFIX = 'qZ.filter(h=>h.path!=="/report"||n==="teacher").filter(h=>h.path!=="/explore"||n==="non-chemistry").map(h=>{const v=t.pathname';

const count = s.split(PREFIX).length - 1;
if (count !== 2) { console.error('❌ [spa-nav] 公共前缀命中 ' + count + ' 次，预期 2，中止'); process.exit(1); }
s = s.split(PREFIX).join(SUFFIX);
fs.writeFileSync(FILE, s, 'utf8');
console.log('✓ [spa-nav] 桌面+移动两处 qZ 导航已按角色过滤（/report→teacher, /explore→non-chemistry），新长度 ' + s.length);
