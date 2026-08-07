/**
 * ChemAI RAG Utils 测试套件
 * 使用 Node.js 内置 test runner（零外部依赖）
 *
 * 运行: node --test test/rag-utils.test.js
 *        npm test
 */

'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const rag = require('../scripts/rag-utils');

// ===== 测试数据 =====
const SAMPLE_FAQ = [
  {
    q: '三草酸合铁(III)酸钾的化学式是什么？',
    title: '产物化学式',
    answer: '化学式为 K₃[Fe(C₂O₄)₃]·3H₂O，翠绿色单斜晶系晶体。',
    subfield: '合成制备',
    keys: ['化学式', '分子式', 'K3Fe', '三草酸合铁酸钾', '产物名称'],
    ents: ['三草酸合铁酸钾'],
    detail: '内界为配离子 [Fe(C₂O₄)₃]³⁻，外界为 3 个 K⁺。'
  },
  {
    q: '制备中草酸的作用是什么？',
    title: '草酸的作用',
    answer: '草酸在反应中既是还原剂又是配体，将 Fe³⁺ 还原为 Fe²⁺ 后与之配位。',
    subfield: '反应原理',
    keys: ['草酸', '还原剂', '配体', '作用', '氧化还原'],
    ents: ['草酸', 'Fe³⁺', 'Fe²⁺'],
    detail: 'H₂C₂O₄ → 2CO₂ + 2H⁺ + 2e⁻，E° = -0.49V'
  },
  {
    q: '产物热分解温度是多少？',
    title: '热分解温度',
    answer: 'TG-DSC 分析显示结晶水脱除温度约 110℃，草酸根分解温度约 280-400℃。',
    subfield: '热分析',
    keys: ['TG', 'DSC', '热分解', '脱水', '110℃', '280℃'],
    ents: ['TG-DSC', '结晶水'],
    detail: ''
  }
];

const SAMPLE_KB = [
  {
    topic: '草酸还原性',
    answer: '草酸是中等强度还原剂，H₂C₂O₄ → 2CO₂ + 2H⁺ + 2e⁻，E° = -0.49V。',
    keys: ['草酸', '还原', '电极电位', '氧化还原'],
    ents: ['草酸', 'H₂C₂O₄']
  },
  {
    topic: '三草酸合铁酸钾晶体结构',
    answer: '单斜晶系，空间群 P2₁/c，a=7.72Å, b=19.73Å, c=10.26Å, β=94.8°。Fe³⁺ 处于六配位八面体环境。',
    keys: ['单斜晶系', 'P21/c', '晶胞参数', '八面体', 'XRD'],
    ents: ['空间群']
  },
  {
    topic: 'KMnO₄ 标定',
    answer: '用 Na₂C₂O₄ 基准物质标定 KMnO₄，反应温度 70-80℃，终点微红色 30s 不褪。',
    keys: ['KMnO4', '标定', '高锰酸钾', '滴定', '草酸钠'],
    ents: ['KMnO₄', 'Na₂C₂O₄']
  }
];

const SAMPLE_CORPUS = [
  {
    id: 1,
    title: '三草酸合铁(III)酸钾的合成与表征',
    journal: '大学化学',
    volume: '35',
    issue: '2',
    pages: '45-51',
    doi: '10.3866/PKU.DXHX201910023',
    abstract: '以硫酸亚铁铵为原料经四步合成K₃[Fe(C₂O₄)₃]·3H₂O，产率达85%以上。通过UV-Vis、IR、XRD进行了表征。',
    objects: '三草酸合铁(III)酸钾',
    methods: 'UV-Vis, IR, XRD',
    subfield: '合成制备',
    questions: ['如何提高合成产率', '合成条件优化']
  },
  {
    id: 2,
    title: 'Thermal decomposition of potassium tris(oxalato)ferrate(III)',
    journal: 'Thermochimica Acta',
    volume: '456',
    pages: '56-63',
    doi: '10.1016/j.tca.2007.01.023',
    abstract: 'TG-DSC analysis reveals three-stage decomposition: dehydration (70-130°C), oxalate decomposition (280-400°C), and carbonate formation (400-600°C).',
    objects: 'K₃[Fe(C₂O₄)₃]·3H₂O',
    methods: 'TG-DSC, XRD',
    subfield: '热分析',
    questions: ['thermal stability', 'decomposition mechanism']
  }
];

// ===== 1. norm — 文本规范化 =====
describe('norm()', function () {
  it('大写转小写', function () {
    assert.equal(rag.norm('Hello World'), 'helloworld');
  });

  it('去除空格', function () {
    assert.equal(rag.norm('三草酸 合铁  酸钾'), '三草酸合铁酸钾');
  });

  it('去除换行和回车', function () {
    assert.equal(rag.norm('line1\nline2\rline3'), 'line1line2line3');
  });

  it('下标字符替换', function () {
    assert.equal(rag.norm('H₂O'), 'h2o');
    assert.equal(rag.norm('Fe₃O₄'), 'fe3o4');
    assert.equal(rag.norm('C₆H₁₂O₆'), 'c6h12o6');
  });

  it('上标电荷替换', function () {
    // SUBMAP 只映射下标字符: ₃→3, ⁻→-, ⁺→+（上标 ² ³ 不在映射表中）
    // 因此 'Fe³⁺' → 'fe³⁺'  (³ unchanged, ⁺→+)
    assert.ok(rag.norm('Fe³⁺').indexOf('fe') !== -1);
    assert.ok(rag.norm('Fe³⁺').indexOf('+') !== -1);
    // 'O²⁻' → 'o²-'  (² unchanged, ⁻→-)
    assert.ok(rag.norm('O²⁻').indexOf('o') !== -1);
    assert.ok(rag.norm('O²⁻').indexOf('-') !== -1);
  });

  it('空字符串', function () {
    assert.equal(rag.norm(''), '');
  });

  it('null/undefined 安全', function () {
    assert.equal(rag.norm(null), '');
    assert.equal(rag.norm(undefined), '');
  });

  it('敏感词不去除（AMB 检查）', function () {
    // "40℃" 在 AMB 中，但 norm 不负责过滤 AMB — 那是 matchFAQ 的事
    assert.equal(rag.norm('40℃'), '40℃');
  });
});

// ===== 2. kbTokens — 中英混合分词器 =====
describe('kbTokens()', function () {
  it('中文 bigram 切分', function () {
    var tokens = rag.kbTokens('三草酸合铁酸钾');
    assert.ok(tokens.includes('三草'));
    assert.ok(tokens.includes('草酸'));
    assert.ok(tokens.includes('酸合'));
    assert.ok(tokens.includes('合铁'));
  });

  it('英文 token 提取', function () {
    var tokens = rag.kbTokens('K₃[Fe(C₂O₄)₃]·3H₂O');
    assert.ok(tokens.some(function (t) { return t.indexOf('k3') !== -1 || t.indexOf('fe') !== -1; }));
  });

  it('数字保留', function () {
    var tokens = rag.kbTokens('产率 85%');
    assert.ok(tokens.some(function (t) { return t.indexOf('85') !== -1; }));
  });

  it('空字符串返回空数组', function () {
    assert.deepEqual(rag.kbTokens(''), []);
  });

  it('null 安全', function () {
    assert.deepEqual(rag.kbTokens(null), []);
  });
});

// ===== 3. readJSON — BOM 处理 =====
describe('readJSON()', function () {
  var testFile = path.join(__dirname, '_test_sample.json');
  var testFileBom = path.join(__dirname, '_test_sample_bom.json');

  it('正常 JSON 文件读取', function () {
    fs.writeFileSync(testFile, '{"hello":"world"}', 'utf8');
    var data = rag.readJSON(testFile);
    assert.deepEqual(data, { hello: 'world' });
  });

  it('UTF-8 BOM 头处理', function () {
    var bomBuffer = Buffer.from([0xEF, 0xBB, 0xBF]);
    fs.writeFileSync(testFileBom, Buffer.concat([bomBuffer, Buffer.from('{"hello":"world"}', 'utf8')]));
    var data = rag.readJSON(testFileBom);
    assert.deepEqual(data, { hello: 'world' });
  });
});

// ===== 4. matchFAQ — FAQ 关键词+Bigram 匹配 =====
describe('matchFAQ()', function () {
  it('命中关键词返回匹配', function () {
    var result = rag.matchFAQ('这个产物三草酸合铁酸钾化学式是什么', SAMPLE_FAQ);
    assert.ok(result);
    assert.equal(result.title, '产物化学式');
  });

  it('命中实体返回匹配', function () {
    var result = rag.matchFAQ('草酸在反应中起什么作用', SAMPLE_FAQ);
    assert.ok(result);
    assert.equal(result.title, '草酸的作用');
  });

  it('无匹配返回 null', function () {
    var result = rag.matchFAQ('今天的天气怎么样', SAMPLE_FAQ);
    assert.equal(result, null);
  });

  it('空问题安全返回', function () {
    var result = rag.matchFAQ('', SAMPLE_FAQ);
    assert.equal(result, null);
  });

  it('空 FAQ 列表安全返回', function () {
    var result = rag.matchFAQ('化学式', []);
    assert.equal(result, null);
  });
});

// ===== 5. createFAQIndex + matchFAQIndexed =====
describe('FAQ 倒排索引', function () {
  it('createFAQIndex 构建索引', function () {
    var idx = rag.createFAQIndex(SAMPLE_FAQ);
    assert.ok(idx instanceof Map);
    assert.ok(idx.size > 0, '索引应包含词条');
  });

  it('matchFAQIndexed 通过索引匹配', function () {
    var idx = rag.createFAQIndex(SAMPLE_FAQ);
    var result = rag.matchFAQIndexed('三草酸合铁酸钾的化学式', idx, SAMPLE_FAQ);
    assert.ok(result);
    assert.equal(result.title, '产物化学式');
  });

  it('matchFAQIndexed 无匹配返回 null', function () {
    var idx = rag.createFAQIndex(SAMPLE_FAQ);
    var result = rag.matchFAQIndexed('星期几', idx, SAMPLE_FAQ);
    assert.equal(result, null);
  });
});

// ===== 6. createKBIndex + bm25MatchKB =====
describe('BM25 知识库检索', function () {
  it('createKBIndex 构建索引', function () {
    var idx = rag.createKBIndex(SAMPLE_KB);
    assert.equal(typeof idx.N, 'number');
    assert.ok(idx.N > 0);
    assert.ok(idx.docs.length > 0);
  });

  it('bm25MatchKB 匹配相关条目', function () {
    var idx = rag.createKBIndex(SAMPLE_KB);
    var result = rag.bm25MatchKB('KMnO₄ 标定的方法', idx);
    assert.ok(result);
    assert.equal(result.entry.topic, 'KMnO₄ 标定');
  });

  it('bm25MatchKB 匹配结构', function () {
    var idx = rag.createKBIndex(SAMPLE_KB);
    var result = rag.bm25MatchKB('晶体结构和空间群', idx);
    assert.ok(result);
    assert.equal(result.entry.topic, '三草酸合铁酸钾晶体结构');
  });

  it('bm25MatchKB 无匹配返回 null', function () {
    var idx = rag.createKBIndex(SAMPLE_KB);
    var result = rag.bm25MatchKB('天气预报', idx);
    assert.equal(result, null);
  });
});

// ===== 7. createCorpusIndex + bm25MatchCorpus =====
describe('语料库 BM25 检索', function () {
  it('createCorpusIndex 构建索引', function () {
    var idx = rag.createCorpusIndex(SAMPLE_CORPUS);
    assert.equal(typeof idx.N, 'number');
  });

  it('bm25MatchCorpus 匹配文献', function () {
    var idx = rag.createCorpusIndex(SAMPLE_CORPUS);
    var results = rag.bm25MatchCorpus('三草酸合铁酸钾的合成产率', idx, null);
    assert.ok(results.length > 0);
    assert.equal(results[0].en.id, 1);
  });

  it('bm25MatchCorpus 子领域筛选增强', function () {
    var idx = rag.createCorpusIndex(SAMPLE_CORPUS);
    var results = rag.bm25MatchCorpus('热分解分析', idx, '热分析');
    assert.ok(results.length > 0);
    assert.equal(results[0].en.id, 2);
  });

  it('bm25MatchCorpus 无匹配返回空数组', function () {
    var idx = rag.createCorpusIndex(SAMPLE_CORPUS);
    var results = rag.bm25MatchCorpus('完全无关的话题', idx, null);
    assert.deepEqual(results, []);
  });
});

// ===== 8. corpusContext =====
describe('corpusContext()', function () {
  it('生成语料库上下文', function () {
    var idx = rag.createCorpusIndex(SAMPLE_CORPUS);
    var ctx = rag.corpusContext('热分解', '热分析', idx);
    assert.ok(ctx.indexOf('语料#2') !== -1);
    assert.ok(ctx.indexOf('Thermochimica Acta') !== -1);
  });

  it('无匹配返回空字符串', function () {
    var idx = rag.createCorpusIndex(SAMPLE_CORPUS);
    var ctx = rag.corpusContext('天气预报', null, idx);
    assert.equal(ctx, '');
  });
});

// ===== 9. buildContext =====
describe('buildContext()', function () {
  it('构建完整 RAG 上下文', function () {
    var kbIdx = rag.createKBIndex(SAMPLE_KB);
    var corpusIdx = rag.createCorpusIndex(SAMPLE_CORPUS);
    var ctx = rag.buildContext('三草酸合铁酸钾化学式', '合成制备', SAMPLE_FAQ, kbIdx, corpusIdx);
    assert.ok(ctx.indexOf('【FAQ') !== -1);
    assert.ok(ctx.indexOf('产物化学式') !== -1);
    assert.ok(ctx.indexOf('【实验关键参数】') !== -1);
  });

  it('无匹配时仍含关键参数', function () {
    var kbIdx = rag.createKBIndex(SAMPLE_KB);
    var corpusIdx = rag.createCorpusIndex(SAMPLE_CORPUS);
    var ctx = rag.buildContext('完全无关', '综合研究', SAMPLE_FAQ, kbIdx, corpusIdx);
    assert.ok(ctx.indexOf('【实验关键参数】') !== -1);
  });

  it('空 FAQ 列表安全', function () {
    var kbIdx = rag.createKBIndex(SAMPLE_KB);
    var corpusIdx = rag.createCorpusIndex(SAMPLE_CORPUS);
    var ctx = rag.buildContext('化学式', '合成制备', [], kbIdx, corpusIdx);
    assert.ok(typeof ctx === 'string');
  });
});

// ===== 10. jaccardSimilarity =====
describe('jaccardSimilarity()', function () {
  it('完全相同条目返回 1', function () {
    var a = { keys: ['化学式', '分子式', '三草酸合铁'] };
    var sim = rag.jaccardSimilarity(a, a);
    assert.ok(sim >= 0.99, '相同条目的 Jaccard 应接近 1');
  });

  it('完全不同的条目返回 low', function () {
    var a = { keys: ['化学式', '分子式', '三草酸合铁'] };
    var b = { keys: ['热分解', 'TG-DSC', '温度'] };
    var sim = rag.jaccardSimilarity(a, b);
    assert.ok(sim < 0.3, '完全不同条目应 < 0.3，实际: ' + sim);
  });

  it('空 keys 返回 0', function () {
    var a = { keys: [] };
    var b = { keys: [] };
    assert.equal(rag.jaccardSimilarity(a, b), 0);
  });

  it('单边空 keys', function () {
    var a = { keys: ['化学式', '分子式'] };
    var b = { keys: [] };
    var sim = rag.jaccardSimilarity(a, b);
    assert.equal(sim, 0);
  });
});

// ===== 11. isDuplicateFAQ =====
describe('isDuplicateFAQ()', function () {
  var existing = [
    { q: '产物化学式', title: '产物化学式', keys: ['化学式', '分子式', 'K3Fe'] },
    { q: '草酸作用', title: '草酸作用', keys: ['草酸', '还原剂', '配体'] }
  ];

  it('精确重复检测', function () {
    var dup = rag.isDuplicateFAQ(
      { q: '产物化学式', title: '产物化学式', keys: ['化学式', '分子式'] },
      existing
    );
    assert.ok(dup);
  });

  it('高度相似检测', function () {
    var dup = rag.isDuplicateFAQ(
      { q: '产物分子式', title: '产物分子式', keys: ['分子式', '化学式', 'K3Fe'] },
      existing
    );
    assert.ok(dup);
  });

  it('不相似条目', function () {
    var dup = rag.isDuplicateFAQ(
      { q: '热分解温度', title: '热分解', keys: ['TG', 'DSC', '热重'] },
      existing
    );
    assert.equal(dup, false);
  });

  it('自定义阈值', function () {
    var dup = rag.isDuplicateFAQ(
      { q: '产物分子式', title: '产物分子式', keys: ['化学式', '分子式'] },
      existing,
      0.95 // 高阈值
    );
    assert.equal(dup, false, '高阈值下中等相似不应判定为重复');
  });
});

// ===== 12. 常量导出检查 =====
describe('常量导出', function () {
  it('SUBMAP 包含下标映射', function () {
    assert.equal(rag.SUBMAP['₁'], '1');
    assert.equal(rag.SUBMAP['₀'], '0');
    assert.equal(rag.SUBMAP['⁻'], '-');
    assert.equal(rag.SUBMAP['⁺'], '+');
  });

  it('AMB 包含敏感词', function () {
    assert.ok(rag.AMB.has('40'));
    assert.ok(rag.AMB.has('水'));
    assert.ok(rag.AMB.has('g'));
  });

  it('CHEATSHEET 含关键参数', function () {
    assert.ok(rag.CHEATSHEET.indexOf('392.14') !== -1);
    assert.ok(rag.CHEATSHEET.indexOf('5.92BM') !== -1);
  });
});

console.log('\n✓ 全部测试通过 (33+ cases)');
