'use strict';
const fs = require('fs');
const path = require('path');

const FAQ_PATH = path.join(__dirname, '..', 'data', 'faq_unified.json');
const faq = JSON.parse(fs.readFileSync(FAQ_PATH, 'utf8').replace(/^\uFEFF/, ''));

const byTitle = new Map(faq.map(item => [item.title, item]));
let changeCount = 0;

function applyReplacement(title, field, pattern, replacement) {
  const item = byTitle.get(title);
  if (!item) {
    console.log('MISSING', title);
    return;
  }
  const value = item[field] || '';
  if (!value.includes(pattern)) {
    console.log('NOT FOUND', title, field, pattern.slice(0, 40));
    return;
  }
  item[field] = value.split(pattern).join(replacement);
  changeCount++;
  console.log('OK', title, field, '->', replacement.slice(0, 50));
}

applyReplacement('试剂用量一览', 'answer', '约24 mL', '约30 mL');
applyReplacement('试剂用量一览', 'answer', '母液:乙醇体积比约1:1至1:2', '母液25-30 mL、95%乙醇约10 mL（乙醇体积比约40%）');
applyReplacement('产率过高原因', 'answer', '110℃烘干至恒重', '50℃烘干20分钟至恒重');

applyReplacement('完整操作流程', 'answer', '浓缩母液至约10-15 mL，加入95%乙醇（母液与乙醇体积比约1:1至1:2）', '保持母液体积25-30 mL，加入约10 mL 95%乙醇（乙醇体积比约40%）');
applyReplacement('完整操作流程', 'answer', '50℃烘干1-2小时（严禁超过50℃）至恒重', '50℃烘干20分钟至恒重');
applyReplacement('完整操作流程', 'answer', '（目的：纯化并干燥产物，110℃去表面水不伤结晶水，严禁超过113℃）', '（目的：纯化并干燥产物，50℃烘干20分钟，严禁超过50℃）');

applyReplacement('试剂用量优化', 'detail', '母液与乙醇体积比约1:1至1:2', '母液25-30 mL、95%乙醇约10 mL（乙醇体积比约40%）');
applyReplacement('乙醇的作用', 'answer', '更易在110℃烘干时除去', '更易在50℃烘干时除去');
applyReplacement('乙醇的作用', 'answer', '母液:乙醇约1:1至1:2，乙醇约10-15 mL即可', '母液25-30 mL、95%乙醇约10 mL即可');

const MANUAL_STEPS = `详细操作步骤（以武汉大学互动讲义为准）：
① 称取5.0 g硫酸亚铁铵（莫尔盐），加数滴3 mol/L H₂SO₄和约15 mL蒸馏水，搅拌溶解；
② 另称1.7 g H₂C₂O₄·2H₂O溶于约10 mL蒸馏水，两液分别加热至近沸，将草酸液缓慢倒入莫尔盐液中并搅拌，微沸约4 min，静置沉降、倾滗分离，热水洗涤至BaCl₂检验无SO₄²⁻；
③ 向FeC₂O₄·2H₂O沉淀加3.5 g K₂C₂O₄·H₂O和约15 mL水，40℃水浴搅拌溶解，以每秒1—2滴缓慢滴加6% H₂O₂约10 mL，继续搅拌5 min，加热至沸保持2 min除去过量H₂O₂，用K₃Fe(CN)₆检验Fe²⁺氧化完全；
④ 称取约1.5 g H₂C₂O₄·2H₂O配成约0.5 mol/L溶液（约30 mL），逐滴滴入热的第二步产物中并保持微沸，至Fe(OH)₃完全溶解、溶液呈透明翠绿色；
⑤ 将翠绿色溶液转移至250 mL烧杯，保持母液体积25-30 mL，加入约10 mL 95%乙醇（乙醇体积比约40%），悬挂棉线、盖表面皿、暗处静置数小时至过夜；
⑥ 抽滤分离，少量乙醇洗涤晶体2次，置表面皿上50℃烘箱烘干20分钟，冷却后称量并计算产率。`;

const detailed = byTitle.get('详细操作步骤（含试剂用量、温度、时间）');
if (detailed) {
  detailed.answer = MANUAL_STEPS;
  detailed.detail = (detailed.detail || '').replace('110°C烘箱中烘干1-2小时', '50°C烘箱中烘干20分钟');
  detailed.detail = (detailed.detail || '').replace('烘干温度：110°C', '烘干温度：50°C');
  detailed.detail = (detailed.detail || '').replace('烘干时间：1-2小时', '烘干时间：20分钟');
  changeCount++;
  console.log('OK 详细操作步骤 answer -> 武汉大学互动讲义步骤');
}

applyReplacement('加热方式', 'detail', '烘干用110℃烘箱1-2小时', '烘干用50℃烘箱20分钟');
applyReplacement('第四步乙醇用量浓度', 'answer', '母液与乙醇体积比约1:1至1:2（即母液约10—15 mL时加乙醇约10—30 mL；或母液25—30 mL时加乙醇约25—60 mL）', '母液体积25-30 mL，加入约10 mL 95%乙醇（乙醇体积比约40%）');
applyReplacement('产率高：产物未干燥', 'answer', '110℃烘干1-2小时', '50℃烘干20分钟');
applyReplacement('乙醇用量不足或过量的后果', 'answer', '控制母液与乙醇体积比约1:1至1:2', '控制母液体积25-30 mL、95%乙醇约10 mL（乙醇体积比约40%）');
applyReplacement('乙醇在本实验中的完整作用', 'answer', '通常10-15 mL 95%乙醇', '通常约10 mL 95%乙醇（母液25-30 mL）');
applyReplacement('乙醇在本实验中的完整作用', 'answer', '更易在110℃烘干时除去', '更易在50℃烘干时除去');
applyReplacement('结晶洗涤用乙醇浓度', 'detail', '110℃烘干1-2小时至恒重', '50℃烘干20分钟至恒重');
applyReplacement('热分解三阶段', 'answer', '推荐50℃烘干1-2小时（严禁超过50℃）', '推荐50℃烘干20分钟（严禁超过50℃）');
applyReplacement('产率仅15%的情景诊断与四种对策', 'answer', '母液与乙醇体积比达1:2', '母液体积25-30 mL、95%乙醇约10 mL（乙醇体积比约40%）');
applyReplacement('结晶质量优化——粉末vs大颗粒晶体', 'answer', '应浓缩至约10-15mL', '应保持约25-30mL');
applyReplacement('结晶质量优化——粉末vs大颗粒晶体', 'answer', '浓缩母液至约10-15mL', '保持母液体积25-30mL');

applyReplacement('烘干后产物变色诊断——温度vs合成问题', 'answer', '标准为110℃，不可超过113℃', '标准为50℃，不可超过50℃');
applyReplacement('烘干后产物变色诊断——温度vs合成问题', 'answer', '改用110℃烘干1-2小时', '改用50℃烘干20分钟');
applyReplacement('烘干后产物变色诊断——温度vs合成问题', 'answer', '在避光条件下用110℃烘干1-2小时', '在避光条件下用50℃烘干20分钟');
applyReplacement('烘干后产物变色诊断——温度vs合成问题', 'answer', '调整烘箱温度至110℃', '调整烘箱温度至50℃');
applyReplacement('烘干后产物变色诊断——温度vs合成问题', 'answer', '干燥温度：110℃', '干燥温度：50℃');
applyReplacement('烘干后产物变色诊断——温度vs合成问题', 'answer', '烘干时间：1-2小时至恒重', '烘干时间：20分钟至恒重');
applyReplacement('蒸发浓缩法vs溶剂替换法结晶对比', 'answer', '利于后续110℃烘干', '利于后续50℃烘干');

fs.writeFileSync(FAQ_PATH, JSON.stringify(faq, null, 2), 'utf8');
console.log('已保存', FAQ_PATH);
console.log('变更数:', changeCount);
