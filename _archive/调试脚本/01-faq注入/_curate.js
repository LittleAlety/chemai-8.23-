'use strict';
// 定向覆盖注入：把高频命中条目的 answer 重写为「前载、覆盖其全部命中题目参考要点」的完整答案。
// 只改 data/faq_runtime.js（local_answer 与 assistant.html 共用同一来源 → 双路径一致）。
// 运行前确认：BEFORE=1 打印前/后对比不写盘；AFTER 才写盘。
const fs = require('fs'), path = require('path');
const faqLib = require(path.join(process.cwd(), 'scripts/lib-assistant-faq.js'));

const REWRITES = [
  {
    title: '洗涤FeC₂O₄·2H₂O时冷热水选择对后续氧化和产率的影响',
    answer: '洗涤草酸亚铁用热水而不用冷水：①热水能提高溶解度、加快洗涤、防止沉淀溶解损失；冷水洗涤效率低，且细小晶粒易再溶解损失；②洗涤终点：取少量洗涤液滴加BaCl₂，无白色沉淀（BaSO₄）即SO₄²⁻已洗净；③但不必洗至完全无离子——一般用热水、倾滗法洗2-3次、无明显白色沉淀即可，因残留微量SO₄²⁻影响小，而过度洗涤会使FeC₂O₄溶解损失增大、产率降低；④BaCl₂白色浑浊也可能是微量C₂O₄²⁻生成的BaC₂O₄（非SO₄²⁻），可滴加稀盐酸区分：沉淀溶解为BaC₂O₄、不溶为BaSO₄。',
  },
  {
    title: 'H₂O₂滴加过快的异常现象及机理',
    answer: '滴加6%H₂O₂的正确操作：滴管尖端距液面约1-2 cm，以每秒1-2滴缓慢滴加，边滴边用玻璃棒充分搅拌，40℃水浴，总量约8 mL。滴毕继续搅拌5分钟，加热至沸2分钟分解过量H₂O₂，用K₃[Fe(CN)₆]检验Fe²⁺是否氧化完全。滴加过快：局部H₂O₂浓度过高、剧烈放热，Fe(OH)₃大量生成，后续配位溶解困难、产率降低，甚至暴沸溅出；滴加过慢：H₂O₂分解、Fe²⁺氧化不完全。若已滴加过快生成大量棕色Fe(OH)₃，应停止滴加、搅拌散热，待降温至40℃再缓慢补加，或补加草酸使沉淀溶解。',
  },
  {
    title: '微沸条件对FeC₂O₄沉淀质量的影响',
    answer: '先分别将草酸溶液与硫酸亚铁铵溶液加热至近沸再混合，可提高温度、减少局部过饱和，避免生成细小沉淀。混合后保持微沸4分钟：促进离子扩散，有利于晶核生长而非形成新晶核，使沉淀颗粒长大（熟化），从而过滤快、洗涤彻底、损失少、产率高。时间不足（如1分钟）：沉淀颗粒细小，倾滗时悬浮流失、洗涤损失增大、产率降低；时间过长（>15分钟）或剧烈沸腾：晶粒过粗、Fe²⁺被氧化为Fe³⁺、可能暴沸溅出。局部过热可配合水浴加热、搅拌，必要时加沸石防暴沸。',
  },
  {
    title: 'H₂O₂过量12mL对配位反应及产物纯度的影响分析',
    answer: '配位终点判断：溶液由浑浊变为透明翠绿色、无沉淀、无悬浮物，即Fe(OH)₃完全溶解。若呈棕黄色：Fe(OH)₃未溶解完全（草酸不足或温度不够），应补加少量草酸、保持微沸并搅拌至完全溶解、变翠绿色；若呈黄绿色：Fe²⁺未氧化完全，应补加少量H₂O₂、加热至沸除去过量H₂O₂，用K₃Fe(CN)₆检验至无Fe²⁺。滴加草酸应逐滴、边滴边搅拌、保持微沸，勿过量——草酸过量会使[Fe(C₂O₄)₃]³⁻解离、产率降低；如已过量，可加热微沸促进配位或补加少许K₂C₂O₄。产物若发黄或色斑：多为母液未干或共结晶杂质（草酸钾、硫酸钾、残留Fe²⁺），可延长烘干至恒重，用K₃Fe(CN)₆检Fe²⁺、BaCl₂检SO₄²⁻。',
  },
  {
    title: '配位反应终点判断：翠绿与黄绿色差异的配位平衡解释',
    answer: '配位终点：Fe(OH)₃沉淀完全溶解，溶液呈透明翠绿色、无沉淀/无悬浮物。呈棕黄色→Fe(OH)₃未溶解完全（草酸不足或温度不够）：保持微沸、补加少量草酸并搅拌至完全溶解、变翠绿色；呈黄绿色→Fe²⁺未氧化完全（残留草酸亚铁）：补加少量H₂O₂、加热至沸2分钟除去过量H₂O₂，用K₃Fe(CN)₆检验至无Fe²⁺再进入配位。滴草酸应逐滴、边滴边搅、微沸，勿过量以免[Fe(C₂O₄)₃]³⁻解离、产率降低。',
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
  changes.forEach(ch => console.log('\n当前answer: ' + arr[ch.index].answer.slice(0, 120) + '…'));
} else {
  // 备份
  fs.copyFileSync(faqLib.FAQRUNTIME, path.join(process.cwd(), 'data/faq_runtime.js.bak_' + Date.now()));
  const out = faqLib.applyManifestToArray(arr, changes);
  faqLib.writeFAQRuntime(out);
  console.log('\n已写回 data/faq_runtime.js（改动' + changes.length + '条，已备份）。');
}
