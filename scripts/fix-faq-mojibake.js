'use strict';
const fs = require('fs');
const path = require('path');

const FAQ_PATH = path.join(__dirname, '..', 'data', 'faq_unified.json');
const faq = JSON.parse(fs.readFileSync(FAQ_PATH, 'utf8').replace(/^\uFEFF/, ''));

const FIXES = [
  ['三水合物的\uFFFD\uFFFD成', '三水合物的组成'],
  ['显著提高\uFFFD\uFFFD体质量', '显著提高晶体质量'],
  ['形成杂化\uFFFD\uFFFD\uFFFD能材料', '形成杂化功能材料'],
  ['加入H\uFFFD\uFFFDO₂', '加入H₂O₂'],
  ['（Ⅲ）\uFFFD\uFFFD\uFFFD钾的制备', '（Ⅲ）酸钾的制备'],
  ['配离子\uFFFD\uFFFD\uFFFD的Fe³⁺', '配离子中的Fe³⁺'],
  ['相对稳定\uFFFD\uFFFD碱性条件下', '相对稳定，碱性条件下'],
  ['三维网\uFFFD\uFFFD，其', '三维网络，其'],
  ['结构解\uFFFD\uFFFD\uFFFD方法', '结构解析方法'],
  ['稀碱\uFFFD\uFFFD\uFFFD观察', '稀碱后观察'],
  ['的中\uFFFD\uFFFD体与动力学', '的中间体与动力学'],
  ['涂布于纸\uFFFD\uFFFD，紫外', '涂布于纸面，紫外'],
  ['浓缩\uFFFD\uFFFD\uFFFD表面出现', '浓缩至表面出现'],
  ['改\uFFFD\uFFFD\uFFFD制备及其', '改进制备及其'],
  ['或用\uFFFD\uFFFD\uFFFD璃棒', '或用玻璃棒'],
  ['提供旁\uFFFD\uFFFD', '提供旁证'],
  ['语\uFFFD\uFFFD\uFFFD#208', '语料#208'],
  ['K₂SO\uFFFD\uFFFD\uFFFD、', 'K₂SO₄、'],
  ['并注意避\uFFFD\uFFFD。', '并注意避光。'],
  ['对策\uFFFD\uFFFD\uFFFD煮沸2分钟', '对策为煮沸2分钟'],
  ['静置时\uFFFD\uFFFD\uFFFD主要影响', '静置时间主要影响'],
  ['氧化态与配\uFFFD\uFFFD:', '氧化态与配体:'],
  ['晶体\uFFFD\uFFFD色更翠绿', '晶体颜色更翠绿'],
  ['级联\uFFFD\uFFFD程决定了', '级联过程决定了'],
  ['部分氧化，\uFFFD\uFFFD\uFFFD重新制备', '部分氧化，需重新制备'],
  ['强水流冲洗\uFFFD\uFFFD以免', '强水流冲洗，以免'],
  ['每10 \uFFFD\uFFFD\uFFFD反应速率', '每10 ℃反应速率'],
  ['三\uFFFD\uFFFD\uFFFD酸合铁(III)酸钾', '三草酸合铁(III)酸钾'],
  ['被大量使\uFFFD\uFFFD。其', '被大量使用。其'],
  ['理论解释\uFFFD\uFFFD\uFFFD还原', '理论解释光还原'],
  ['最终生\uFFFD\uFFFD' + 'FeC₂O₄', '最终生成FeC₂O₄'],
  ['最早由\uFFFD\uFFFD勒（Scheele）', '最早由舍勒（Scheele）'],
  ['制备\uFFFD\uFFFD\uFFFD验的思考', '制备实验的思考'],
  ['Fe²\uFFFD\uFFFD量求得', 'Fe²⁺量求得'],
  ['螯合效应\uFFFD\uFFFD著提高', '螯合效应显著提高'],
  ['配\uFFFD\uFFFD物非常稳定', '配合物非常稳定'],
  ['化学\uFFFD\uFFFD程', '化学过程'],
  ['包括\uFFFD\uFFFD酸铁）发明', '包括草酸铁）发明'],
  ['量子产率较\uFFFD\uFFFD；', '量子产率较高；'],
  ['温度\uFFFD\uFFFD制在60-70', '温度控制在60-70'],
  ['液相\uFFFD\uFFFD化学电池', '液相光化学电池'],
  ['照射\uFFFD\uFFFD\uFFFD，三草酸合铁', '照射下，三草酸合铁'],
  ['最\uFFFD\uFFFD干燥即得', '最后干燥即得'],
  ['用于\uFFFD\uFFFD\uFFFD外线测量', '用于紫外线测量'],
  ['溶解性、\uFFFD\uFFFD\uFFFD性及光学', '溶解性、磁性及光学'],
  ['分子化合\uFFFD\uFFFD”（', '分子化合物”（'],
  ['三草\uFFFD\uFFFD\uFFFD合铁酸钾', '三草酸合铁酸钾'],
  ['学习\uFFFD\uFFFD\uFFFD效应', '学习反位效应'],
  ['Bijvoet对\uFFFD\uFFFD\uFFFD' + 'F(hkl)', 'Bijvoet对F(hkl)'],
  ['顺磁配\uFFFD\uFFFD物磁化率', '顺磁配合物磁化率'],
  ['提供σ电子，\uFFFD\uFFFD\uFFFD时金属', '提供σ电子，同时金属'],
  ['思政元素，\uFFFD\uFFFD增加XRD', '思政元素，可增加XRD'],
  ['在定\uFFFD\uFFFD分析中', '在定量分析中'],
  ['草酸配\uFFFD\uFFFD\uFFFD物的热稳定性', '草酸配合物的热稳定性'],
  ['闭环研究思\uFFFD\uFFFD\uFFFD。', '闭环研究思路。'],
  ['综合各阶\uFFFD\uFFFD失重', '综合各阶段失重'],
  ['是人\uFFFD\uFFFD\uFFFD光合成的', '是人工光合成的'],
  ['铁\uFFFD\uFFFD化钾', '铁氰化钾'],
  ['‘\uFFFD\uFFFD酸亚铁铵的制备’', '‘硫酸亚铁铵的制备’'],
  ['(1) \uFFFD\uFFFD\uFFFD调浓硫酸', '(1) 强调浓硫酸'],
  ['污染\uFFFD\uFFFD\uFFFD的基本原理', '污染物的基本原理'],
  ['紫\uFFFD\uFFFD线曝光量', '紫外线曝光量'],
  ['影像\uFFFD\uFFFD录。', '影像记录。'],
  ['\uFFFD\uFFFD\uFFFD合物', '配合物'],
  ['草酸根\uFFFD\uFFFD\uFFFD为二齿配体', '草酸根作为二齿配体'],
  ['草酸配合\uFFFD\uFFFD\uFFFD', '草酸配合物'],
  ['第二，\uFFFD\uFFFD\uFFFD止Fe²⁺', '第二，阻止Fe²⁺']
];

let replaced = 0;
function fixString(value) {
  let out = value;
  FIXES.forEach(([from, to]) => {
    if (out.includes(from)) {
      out = out.split(from).join(to);
      replaced++;
    }
  });
  return out;
}

function fixValue(value) {
  if (typeof value === 'string') return fixString(value);
  if (Array.isArray(value)) return value.map(fixValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = fixValue(value[key]);
    return out;
  }
  return value;
}

const fixed = fixValue(faq);
fs.writeFileSync(FAQ_PATH, JSON.stringify(fixed, null, 2), 'utf8');
console.log('替换次数:', replaced);
console.log('剩余替换符:', JSON.stringify(fixed).match(/\uFFFD/g)?.length || 0);
