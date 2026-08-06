'use strict';
const fs = require('fs');
const path = require('path');

const FAQ_PATH = path.join(__dirname, '..', 'data', 'faq_unified.json');
const FAQ = JSON.parse(fs.readFileSync(FAQ_PATH, 'utf8').replace(/^\uFEFF/, ''));

const KEY_FIXES = {
  '为何加稀硫酸溶解莫尔盐': ['3 mol/L H2SO4', '3mol/L硫酸', '加入数滴硫酸', '第一步加硫酸', '为什么要加硫酸', '防止Fe²⁺水解', '抑制Fe²⁺氧化'],
  '洗涤至无硫酸根': ['SO4²⁻', '无SO4²⁻', 'BaCl₂检验', '检验方法', '判断标准', '怎么检验洗净', '检验沉淀洗净'],
  '为何煮沸除双氧水': ['H2O2滴加完毕后', '加热至沸', '保持2分钟', '煮沸2分钟', '除尽H2O2', '氧化完成后'],
  '内外界确定方法': ['实验验证', '设计一种方法', '设计实验', '内界还是外界', '草酸根处于内界', '草酸根处于外界', '内界外界', '离子交换', '电导法'],
  '内外界确定方法（三种实验验证）': ['实验验证', '设计一种方法', '设计实验', '内界还是外界', '草酸根处于内界', '草酸根处于外界', '离子交换', '电导法'],
  '产率过低原因': ['低于60%', '产率偏低', '偏低原因', '改进措施', '如何提高产率', '三种原因'],
  '眼睛溅入处理': ['H2O2溅入眼中', '溅入眼中', '眼中', '应急措施', '紧急处理', '洗眼'],
  '氧化完全检验方法': ['检验Fe²⁺是否氧化完全', 'K₃[Fe(CN)₆]', '铁氰化钾检验', '无蓝色', '蓝色沉淀'],
  'H2O2安全': ['6% H2O2', '双氧水安全', '过氧化氢安全', '腐蚀', '氧化性'],
  '火灾应急': ['初期小火', 'CO₂', '干粉灭火器', '疏散', '119'],
  'Fe(OH)3的颜色': ['红棕色', '棕褐色', '氢氧化铁颜色'],
  'FeC2O4的颜色': ['黄色沉淀', '草酸亚铁颜色'],
  '水合Fe2+的颜色': ['浅绿色', '亚铁离子颜色'],
  '铁氰化钾的颜色': ['红色', '铁氰化钾颜色'],
  '黄血盐的颜色': ['黄色', '亚铁氰化钾颜色'],
  'Fe(SCN)3的颜色': ['血红色', '硫氰合铁颜色'],
  'FeF6的颜色': ['无色', '氟合铁颜色'],
  'Fe2O3的颜色': ['红棕色', '氧化铁颜色']
};

const CATEGORY_FIXES = {
  '实验教学目标': '实验教学',
  '实验涉及哪几类反应': '反应原理',
  '完整操作流程': '合成制备',
  '温度对配位平衡影响': '配位化学理论',
  '颜色与dd跃迁': '配位化学理论',
  'H2O2安全': '安全与废物处理',
  '产率优化策略': '合成制备',
  '产率过低原因': '合成制备',
  '产率过高原因': '合成制备',
  '教学方法改进': '实验教学',
  '铬配合物对比': '草酸配合物',
  '产率异常全表': '综合研究',
  '晶体质量差原因': '实验操作',
  '试剂问题识别': '实验操作',
  '红外光谱特征峰': '结构表征',
  '蓝晒感光液配方': '蓝晒工艺',
  '产物保存方法': '实验操作',
  '蓝晒感光液的组成': '蓝晒工艺',
  '各阶段温度一览': '合成制备',
  '各阶段时间一览': '合成制备',
  '颜色异常诊断': '实验操作',
  '结晶操作参数': '实验操作',
  '倾滗法技巧': '实验操作'
};

let keyChanges = 0;
let catChanges = 0;

FAQ.forEach(item => {
  if (KEY_FIXES[item.title]) {
    if (!Array.isArray(item.keys)) item.keys = [];
    KEY_FIXES[item.title].forEach(k => {
      if (!item.keys.includes(k)) {
        item.keys.push(k);
        keyChanges++;
      }
    });
  }
  if (CATEGORY_FIXES[item.title] && item.subfield !== CATEGORY_FIXES[item.title]) {
    item.subfield = CATEGORY_FIXES[item.title];
    catChanges++;
  }
});

fs.writeFileSync(FAQ_PATH, JSON.stringify(FAQ, null, 2), 'utf8');
console.log('keyChanges', keyChanges);
console.log('catChanges', catChanges);
