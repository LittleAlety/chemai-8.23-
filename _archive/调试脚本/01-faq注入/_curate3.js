'use strict';
const fs = require('fs'), path = require('path');
const faqLib = require(path.join(process.cwd(), 'scripts/lib-assistant-faq.js'));

const REWRITES = [
  {
    title: '氧化温度过高的后果',
    answer: '烘干产物K₃[Fe(C₂O₄)₃]·3H₂O(三水合物)时，温度50℃是上限，20分钟即可。①超过50℃或时间过久：结晶水部分失去(失水温度约100℃)，产物组成改变、称量偏大、产率虚高、纯度下降；温度过高还可能使产物分解。②应在烘箱内避光，防止光分解产物致变色变质。③判断恒重：烘干后冷却称量，再烘5分钟，冷却称量，直至两次质量差<0.01 g。',
  },
  {
    title: '昼夜温差对三草酸合铁(III)酸钾结晶产率和粒径的影响及暗处理原因',
    answer: '结晶操作(含昼夜温差/暗处理)：①加约10 mL 95%乙醇，乙醇为反溶剂降低产物溶解度、促进结晶，搅拌均匀后立即停止——继续搅拌太久会引入气泡成为晶体缺陷，且过快降低溶解度使晶体细小；②悬挂棉线提供晶核位点，引导晶体有序生长，获得较大完整晶体；③覆盖表面皿，置于暗处静置数小时至过夜，避免光分解(产物遇光分解变黄)，并减少扰动(频繁移动使晶体细小、成簇、形貌差)；④昼夜温差下缓慢结晶可得到大而完整的晶体。产物烘干：50℃烘箱20分钟，超温会失去结晶水。',
  },
  {
    title: '产率计算公式与基准',
    answer: '理论产量以硫酸亚铁铵(摩尔盐)为基准：因为铁元素在整个过程中守恒，从摩尔盐Fe²⁺氧化成Fe³⁺到最终产物K₃[Fe(C₂O₄)₃]·3H₂O，铁原子物质的量不变；其他试剂(草酸、K₂C₂O₄、H₂O₂)可能过量或部分分解，而铁源只有摩尔盐，故以它为基准最准确。化学计量1 mol摩尔盐→1 mol产物(n=m/392.14，理论质量=n×491.25)。产率=实际质量/理论质量×100%。产率偏高常见原因：产物未完全干燥含母液水分、或含草酸钾/硫酸钾共结晶杂质；应延长烘干至恒重(两次称量差≤0.01 g)、必要时化学分析检杂质。',
  },
  {
    title: '第四步：溶剂替换法结晶的热力学原理',
    answer: '溶剂替换法(乙醇)结晶：①乙醇为反溶剂，降低产物K₃[Fe(C₂O₄)₃]·3H₂O在溶液中的溶解度，使溶液过饱和而结晶析出；②搅拌均匀后应立即停止——继续搅拌太久会引入气泡成为晶体缺陷，且扰动不利于晶体有序生长；③悬挂棉线提供晶核位点，促进晶体有序生长，避免自发成核导致晶体细小、形貌差；④覆盖表面皿，置于暗处静置数小时至过夜，避免频繁移动或观察，让晶体缓慢长大。',
  },
  {
    title: '配位反应中草酸过量导致颜色变浅及终点判断',
    answer: '配位终点：溶液完全透明、呈翠绿色、无沉淀/无悬浮物，即Fe(OH)₃完全溶解。①若呈棕黄色：Fe(OH)₃未溶解完全(草酸不足或温度不够)——保持微沸，补加少量草酸溶液并搅拌至完全溶解、变翠绿色；②若呈黄绿色：Fe²⁺未氧化完全(残留FeC₂O₄)——补加少量H₂O₂、加热至沸2分钟除去过量H₂O₂，用K₃[Fe(CN)₆]检验无Fe²⁺；③草酸过量会使[Fe(C₂O₄)₃]³⁻解离、产物颜色变浅、产率降低，故草酸应逐滴、不过量；若已过量可轻微加热促进配位或补加少量草酸钾。',
  },
];

const arr = faqLib.readFAQRuntime();
const changes = [];
REWRITES.forEach(r => {
  const idx = arr.findIndex(e => e.title === r.title);
  if (idx < 0) { console.log('未找到条目! ' + r.title); return; }
  changes.push({ index: idx, new_answer: r.answer });
  console.log('定位[#' + idx + '] ' + r.title.slice(0, 40));
});
if (process.argv[2] === 'BEFORE') {
  changes.forEach(ch => console.log('\n curAnswer: ' + arr[ch.index].answer.slice(0, 80) + '…'));
} else {
  fs.copyFileSync(faqLib.FAQRUNTIME, path.join(process.cwd(), 'data/faq_runtime.js.bak3_' + Date.now()));
  const out = faqLib.applyManifestToArray(arr, changes);
  faqLib.writeFAQRuntime(out);
  console.log('\n已写回(批3，改动' + changes.length + '条，已备份)。');
}
