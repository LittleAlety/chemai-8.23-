'use strict';
// 批2：继续把高频命中条目的 answer 重写为「前载、覆盖其全部命中题目参考要点」的完整答案。
// 仅在批1验证正向后运行。运行后 faq_runtime.js 备份。
const fs = require('fs'), path = require('path');
const faqLib = require(path.join(process.cwd(), 'scripts/lib-assistant-faq.js'));

const REWRITES = [
  {
    title: '乙醇用量对三草酸合铁酸钾结晶的影响',
    answer: '结晶(第三步配位后冷却)时乙醇的作用与操作：①乙醇为反溶剂，降低产物[Fe(C₂O₄)₃]³⁻溶解度，促进结晶析出；②加入乙醇后轻搅几下即可，不可长时间搅拌——会引入气泡成为晶体缺陷，且过快降低溶解度使晶体细小；③悬挂棉线提供晶核位点，引导晶体有序生长，获得较大完整的晶体；④用表面皿覆盖，置于暗处静置数小时至过夜，避免光分解(产物光照会分解变黄)，并减少扰动(频繁移动会破坏晶核、使晶体细小成簇、形貌差)。',
  },
  {
    title: '为何逐滴加入过氧化氢',
    answer: '逐滴/缓慢滴加6%H₂O₂是为了控制氧化速率。滴管尖端距液面约1-2 cm，以每秒1-2滴缓慢滴加，边滴边用玻璃棒充分搅拌，40℃水浴，总量约8 mL。过快：局部H₂O₂浓度过高、剧烈放热，Fe(OH)₃大量生成，氧化不均匀、产物不纯、产率降低，甚至暴沸溅出；过慢：H₂O₂分解损失、氧化不完全、耗时。合适速率保证Fe²⁺均匀氧化为Fe³⁺。加完后继续水浴搅拌5分钟，加热至沸2分钟除去过量H₂O₂，用K₃[Fe(CN)₆]检验Fe²⁺是否氧化完全(生成蓝色→仍有Fe²⁺，需补加H₂O₂再氧化)。',
  },
  {
    title: '氧化完全检验方法',
    answer: '检验Fe²⁺是否氧化完全用铁氰化钾K₃[Fe(CN)₆](注意:亚铁氰化钾K₄[Fe(CN)₆]是检验Fe³⁺的试剂，遇Fe²⁺无特征)。取少量反应液于试管，滴加几滴K₃[Fe(CN)₆]，若生成蓝色沉淀(滕氏蓝KFe[Fe(CN)₆])，说明仍有Fe²⁺、氧化不完全，应补加少量6%H₂O₂(约2-3 mL)，40℃水浴继续搅拌5分钟，再加热至沸2分钟除去过量H₂O₂，重新检验至无蓝色沉淀。检验前必须先加热至沸2分钟除尽过量H₂O₂，否则残留H₂O₂会氧化Fe²⁺干扰检验(假阴性)。',
  },
  {
    title: 'H₂O₂滴加温度控制及一次倒入的后果',
    answer: '滴加6%H₂O₂时水浴温度控制在40℃：既保证氧化速率、促进反应，又避免温度过高使H₂O₂剧烈分解、氧化不完全。40℃下缓慢滴加(每秒1-2滴)并搅拌，可控制氧化速率、防止局部过热和Fe(OH)₃大量生成。滴加完毕后加热至沸保持2分钟：分解除去过量H₂O₂，防止其残留干扰后续配位反应(否则会继续氧化草酸/Fe²⁺，导致产物颜色异常、纯度下降)。若滴加过快已致局部过热，应停止滴加、充分搅拌散热、水浴冷却后再缓慢进行；若已造成不可逆损失需重新实验。',
  },
  {
    title: '暴沸处理',
    answer: '暴沸原因：局部过热(直接加热且未搅拌)或溶液中有气泡核心。预防：①用水浴加热并不断搅拌，避免局部过热；②加入沸石或玻璃珠提供气化核心；③控制升温速度、容器口径合适。补救：若已暴沸，立即停止加热、移开水浴，用玻璃棒搅拌散热，待稳定后再缓慢加热，注意防止烫伤。若沉淀沉降缓慢，可加热保温或加少量电解质(如稀硫酸)加速凝聚，必要时离心分离。',
  },
  {
    title: '烘箱温度为何50度',
    answer: '产物为三草酸合铁(III)酸钾三水合物K₃[Fe(C₂O₄)₃]·3H₂O，含结晶水。烘干温度50℃是上限，时间20分钟即可：超过50℃或时间过久，会导致结晶水部分失去(失水约100℃)，产物组成改变、称量偏大、产率虚高。烘干应避光，防止光照分解产物致变色变质；温度过高还可能使产物分解。烘干后应冷却至恒重(两次称量差值≤0.01 g)再称量。',
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
  fs.copyFileSync(faqLib.FAQRUNTIME, path.join(process.cwd(), 'data/faq_runtime.js.bak2_' + Date.now()));
  const out = faqLib.applyManifestToArray(arr, changes);
  faqLib.writeFAQRuntime(out);
  console.log('\n已写回(批2，改动' + changes.length + '条，已备份)。');
}
