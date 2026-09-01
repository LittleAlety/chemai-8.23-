'use strict';
const fs = require('fs'), path = require('path');
const faqLib = require(path.join(process.cwd(), 'scripts/lib-assistant-faq.js'));

const REWRITES = [
  {
    title: '产率过低原因',
    answer: '产率过低(低于预期)的常见原因与对策：①洗涤损失——草酸亚铁微溶，用热水洗涤2-3次即可，不必洗至完全无离子，过度洗涤会溶解沉淀、损失产率；②氧化不完全——H₂O₂滴加过快或用量不足，Fe²⁺未完全氧化为Fe³⁺，应控制滴速、加毕加热至沸除去过量H₂O₂，用K₃[Fe(CN)₆]检验至无Fe²⁺；③草酸过量——草酸过量使[Fe(C₂O₄)₃]³⁻解离、产物颜色变浅、产率降低，应逐滴滴加、恰好溶解即止；④结晶条件差——控制溶液体积25–30 mL、95%乙醇约10 mL，悬挂棉线、暗处静置缓慢结晶，否则晶体细小、成簇、析出不完整。',
  },
  {
    title: '三草酸合铁酸钾结晶中棉线作为晶核的优势',
    answer: '结晶中悬挂棉线的作用：①乙醇加毕继续搅拌太久会引入气泡，成为晶体缺陷，故搅拌均匀后应立即停止；②棉线提供晶核位点，引导晶体异相成核、有序生长，避免溶液自发成核导致晶体细小、成簇、形貌差；③置于暗处静置，避免光分解(产物遇光分解变黄)。若不用棉线，也可用玻璃棒摩擦烧杯内壁提供粗糙表面、加入少量产物晶体作晶种，或降低温度/缓慢蒸发溶剂，促进大晶体生成。',
  },
  {
    title: '烘干温度时间',
    answer: '烘干条件：50℃是上限温度，严禁超过，时间约20分钟。超过50℃或时间过久会失去部分结晶水(失水温度约100℃)，产物变为无水或低水合物，组成改变、纯度下降，剩余质量偏大使产率虚高、产率计算不准确；烘干后冷却至室温再称量；烘箱内应避光，防止光分解变质。',
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
  changes.forEach(ch => console.log('\n curAnswer: ' + arr[ch.index].answer.slice(0, 90) + '…'));
} else {
  fs.copyFileSync(faqLib.FAQRUNTIME, path.join(process.cwd(), 'data/faq_runtime.js.bak4_' + Date.now()));
  const out = faqLib.applyManifestToArray(arr, changes);
  faqLib.writeFAQRuntime(out);
  console.log('\n已写回(批4，改动' + changes.length + '条，已备份)。');
}
