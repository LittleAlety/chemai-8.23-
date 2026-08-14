'use strict';
/**
 * v44：用文本级精确插入把 10 个新条目写进 data/corpus.json（保持原 CRLF+4空格+双空格格式，避免全文件 diff）。
 */

const fs = require('fs');
const path = require('path');
const CORPUS = path.join(__dirname, '..', 'data', 'corpus.json');
const BASE = path.join(__dirname, '..', '三草酸合铁酸钾资料');

function q(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"'; }

// 字段顺序固定
const FIELD_ORDER = ['id', 'title', 'lang', 'subfield', 'doctype', 'objects', 'methods', 'datatype', 'depth', 'difficulty', 'path', 'questions', 'journal', 'abstract', 'volume/issue/pages', 'source_url', 'abstract_type'];

const NEW = [
  { title: '三草酸合铁酸钾的制备及其性质（课件2）', lang: '中文', subfield: '合成制备', doctype: '实验教学', objects: '三草酸合铁(III)酸钾 K₃[Fe(C₂O₄)₃]·3H₂O；草酸根 C₂O₄²⁻', methods: '先沉淀后氧化四步法；溶剂替换结晶', datatype: '教学课件（ppt）', depth: '教学级别', difficulty: '进阶级', path: 'Fe\\中文\\2. 三草酸合铁酸钾的制备及其性质.ppt', questions: ['制备三草酸合铁酸钾的四个步骤是什么？', '为什么采用先沉淀后氧化路线？', '产物有哪些特征性质（颜色/溶解度/光敏性）？', '溶剂替换法结晶的原理是什么？'], journal: '', abstract: '教学课件（编号2），讲解三草酸合铁酸钾的制备路线（先沉淀后氧化、溶剂替换结晶）与产物的特征性质。与 corpus 47 同主题的另一版本课件。' },
  { title: '三草酸合铁酸钾制备（王志勇）', lang: '中文', subfield: '合成制备', doctype: '实验教学', objects: '三草酸合铁(III)酸钾 K₃[Fe(C₂O₄)₃]·3H₂O；莫尔盐；草酸钾；草酸；过氧化氢', methods: '先沉淀后氧化四步法；溶剂替换结晶', datatype: '教学课件（pdf）', depth: '教学级别', difficulty: '进阶级', path: 'Fe\\中文\\三草酸合铁酸钾制备 王志勇.pdf', questions: ['三草酸合铁酸钾制备中莫尔盐的作用是什么？', '如何检验Fe²⁺氧化完全？', '溶剂替换法为何用乙醇？', '产物烘干温度有何要求？'], journal: '', abstract: '王志勇教学课件（PDF版）《三草酸合铁酸钾制备》，演示先沉淀后氧化的四步制备流程与关键操作（沉淀、氧化、配位、结晶）。与 PPTX 版（corpus 358）同内容。' },
  { title: '三草酸合铁酸钾制备（王志勇·PPTX）', lang: '中文', subfield: '合成制备', doctype: '实验教学', objects: '三草酸合铁(III)酸钾 K₃[Fe(C₂O₄)₃]·3H₂O；莫尔盐；草酸钾；草酸；过氧化氢', methods: '先沉淀后氧化四步法；溶剂替换结晶', datatype: '教学课件（pptx）', depth: '教学级别', difficulty: '进阶级', path: 'Fe\\中文\\三草酸合铁酸钾制备 王志勇.pptx', questions: ['三草酸合铁酸钾制备的关键操作参数有哪些？', '为什么加草酸要逐滴至透明翠绿？', '暗处静置结晶的目的是什么？'], journal: '', abstract: '王志勇教学课件（PPTX版）《三草酸合铁酸钾制备》，与 PDF 版（corpus 357）同内容，演示四步制备流程与操作要点。' },
  { title: '三草酸合铁酸钾性质和配离子电荷测定（王志勇）', lang: '中文', subfield: '分析测定', doctype: '实验教学', objects: '三草酸合铁(III)酸钾 [Fe(C₂O₄)₃]³⁻；配离子电荷；摩尔电导率', methods: '摩尔电导率（电导法）测定配离子电荷；性质验证', datatype: '教学课件（pptx）', depth: '教学级别', difficulty: '进阶级', path: 'Fe\\中文\\三草酸合铁酸钾性质和配离子电荷测定 王志勇.pptx', questions: ['如何用电导/摩尔电导率测定配离子电荷？', '三草酸合铁(III)酸钾有哪些特征性质？', '配离子[Fe(C₂O₄)₃]³⁻的电荷为什么是-3？'], journal: '', abstract: '王志勇教学课件，讲解三草酸合铁酸钾的性质（光敏、热分解、颜色、溶解度）与配离子电荷的测定（电导/摩尔电导率法）。' },
  { title: '摩尔电导率测定估算配离子电荷数', lang: '中文', subfield: '分析测定', doctype: '实验讲义', objects: '三草酸合铁(III)酸钾 [Fe(C₂O₄)₃]³⁻；摩尔电导率；配离子电荷数', methods: '摩尔电导率（电导法）测定并估算配离子电荷数', datatype: '讲义（pdf）', depth: '教学级别', difficulty: '进阶级', path: 'Fe\\表征\\摩尔电导率测定估算配离子电荷数.pdf', questions: ['摩尔电导率如何用于估算配离子电荷数？', '电导法测配离子电荷的原理是什么？', '本实验需要哪些主要仪器与试剂？'], journal: '', abstract: '实验讲义，用摩尔电导率测定并估算三草酸合铁配离子的电荷数（电导法）。与 DOC 版（corpus 361）同内容。' },
  { title: '摩尔电导率的测定估算离子电荷数', lang: '中文', subfield: '分析测定', doctype: '实验讲义', objects: '三草酸合铁(III)酸钾 [Fe(C₂O₄)₃]³⁻；摩尔电导率；离子电荷数', methods: '摩尔电导率（电导法）测定估算离子电荷数', datatype: '讲义（doc）', depth: '教学级别', difficulty: '进阶级', path: 'Fe\\表征\\摩尔电导率的测定估算离子电荷数.doc', questions: ['摩尔电导率测定估算离子电荷数的原理是什么？', '电导池常数如何标定？', '如何由摩尔电导率判断配离子电荷？'], journal: '', abstract: '实验讲义（DOC版）《摩尔电导率的测定估算离子电荷数》，与 PDF 版（corpus 360）同内容，讲解用电导法测定配离子电荷数。' },
  { title: '讲义·三草酸合铁（Ⅲ）配离子的电荷测定', lang: '中文', subfield: '分析测定', doctype: '实验讲义', objects: '三草酸合铁（Ⅲ）配离子 [Fe(C₂O₄)₃]³⁻；电荷测定', methods: '配离子电荷测定（电导/摩尔电导率法）', datatype: '讲义（pdf）', depth: '教学级别', difficulty: '进阶级', path: 'Fe\\表征\\讲义 三草酸合铁（Ⅲ）配离子的电荷测定.pdf', questions: ['三草酸合铁（Ⅲ）配离子的电荷如何测定？', '电导法测定配离子电荷的操作步骤是什么？', '电荷测定结果如何验证？'], journal: '', abstract: '实验讲义：三草酸合铁（Ⅲ）配离子的电荷测定（电导/摩尔电导率法）。与 DOCX 版（corpus 363）同内容。' },
  { title: '讲义·实验：三草酸合铁（Ⅲ）配离子的电荷测定', lang: '中文', subfield: '分析测定', doctype: '实验讲义', objects: '三草酸合铁（Ⅲ）配离子 [Fe(C₂O₄)₃]³⁻；电荷测定', methods: '配离子电荷测定（电导/摩尔电导率法）', datatype: '讲义（docx）', depth: '教学级别', difficulty: '进阶级', path: 'Fe\\表征\\讲义 实验 三草酸合铁（Ⅲ）配离子的电荷测定.docx', questions: ['本实验的测定原理是什么？', '实验需要哪些步骤与条件？', '如何由实验数据计算配离子电荷？'], journal: '', abstract: '实验讲义（DOCX版）《三草酸合铁（Ⅲ）配离子的电荷测定》，与 PDF 版（corpus 362）同内容，含实验原理、步骤与数据处理。' },
  { title: '配离子电荷测定（课件）', lang: '中文', subfield: '分析测定', doctype: '实验教学', objects: '配离子电荷；摩尔电导率；三草酸合铁（Ⅲ）配离子', methods: '电导/摩尔电导率法测定配离子电荷', datatype: '教学课件（ppt）', depth: '教学级别', difficulty: '进阶级', path: 'Fe\\表征\\配离子电荷测定.ppt', questions: ['配离子电荷测定的原理是什么？', '电导法与离子交换法有何异同？', '摩尔电导率数据如何解读？'], journal: '', abstract: '教学课件《配离子电荷测定》，讲解用电导/摩尔电导率测定三草酸合铁配离子电荷的原理与操作。' },
  { title: '硫酸亚铁铵晶体图片', lang: '中文', subfield: '摩尔盐相关', doctype: '图片', objects: '硫酸亚铁铵（莫尔盐）晶体', methods: '—', datatype: '晶体实物图片（jpeg）', depth: '教学级别', difficulty: '基础级', path: '摩尔盐\\硫酸亚铁铵.jpeg', questions: ['硫酸亚铁铵（莫尔盐）晶体外观是什么样？', '莫尔盐晶体与绿矾晶体有何外观区别？'], journal: '', abstract: '硫酸亚铁铵（莫尔盐）晶体实物图片（jpeg），用于认识莫尔盐晶体的颜色与晶形。' }
];

// 生成一个条目文本块（20 空格 { / 24 空格字段 / questions 对齐 38+42）
function renderEntry(e) {
  const L = [];
  L.push(' '.repeat(20) + '{');
  const qStartCol = 24 + q('questions').length + 2; // 38
  const qItemCol = qStartCol + 4;                   // 42
  const keys = FIELD_ORDER;
  keys.forEach((k, i) => {
    const comma = i < keys.length - 1 ? ',' : '';
    const v = e[k];
    if (Array.isArray(v)) {
      if (v.length === 0) {
        L.push(' '.repeat(24) + q(k) + ':  []' + comma);
      } else {
        L.push(' '.repeat(24) + q(k) + ':  [');
        v.forEach((item, j) => {
          L.push(' '.repeat(qItemCol) + q(item) + (j < v.length - 1 ? ',' : ''));
        });
        L.push(' '.repeat(qStartCol) + ']' + comma);
      }
    } else if (typeof v === 'number') {
      L.push(' '.repeat(24) + q(k) + ':  ' + v + comma);
    } else {
      L.push(' '.repeat(24) + q(k) + ':  ' + q(v) + comma);
    }
  });
  L.push(' '.repeat(20) + '}');
  return L.join('\r\n');
}

function main() {
  // path 校验
  for (const e of NEW) {
    if (!fs.existsSync(path.join(BASE, e.path))) { console.error('path 不存在: ' + e.path); process.exit(1); }
  }

  let s = fs.readFileSync(CORPUS, 'utf8');
  // 1. total 355 -> 365
  const totalRe = /(\r?\n)    "total":  355,/;
  if (!totalRe.test(s)) { console.error('未找到 total 355'); process.exit(1); }
  s = s.replace(totalRe, '$1    "total":  365,');

  // 2. 在最后一个条目 } 与 entries 数组闭合 ], 之间插入
  // 末尾模式：...}\r\n                ],\r\n    "enriched"
  const closeRe = /(\r?\n)                    \}\r?\n                \],\r?\n    "enriched"/;
  if (!closeRe.test(s)) { console.error('未找到 entries 数组闭合点'); process.exit(1); }

  const startId = 356;
  const blocks = NEW.map((e, i) => renderEntry({ id: startId + i, ...e, 'volume/issue/pages': '', source_url: '', abstract_type: 'editor_summary' }));
  const insertText = '$1                    },\r\n' + blocks.join(',\r\n') + '\r\n                ],\r\n    "enriched"';
  s = s.replace(closeRe, insertText);

  // 3. 校验 JSON 合法 + 总数（剥离 BOM）
  let parsed;
  try {
    const check = s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
    parsed = JSON.parse(check);
  } catch (err) {
    console.error('❌ 插入后 JSON 解析失败: ' + err.message);
    const m = err.message.match(/position (\d+)/);
    if (m) { const pos = +m[1]; console.error('  上下文: ' + JSON.stringify(s.slice(pos - 80, pos + 80))); }
    process.exit(1);
  }
  if (parsed.total !== 365 || parsed.entries.length !== 365) {
    console.error('total=' + parsed.total + ' entries=' + parsed.entries.length + ' 应为 365'); process.exit(1);
  }

  fs.writeFileSync(CORPUS, s, 'utf8');
  console.log('✓ 已插入 10 条（id 356-365），total=365，JSON 合法');
}

main();
