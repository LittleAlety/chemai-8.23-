/**
 * enrich-corpus-questions.js  (v3)
 *
 * Reads data/corpus.json, removes boilerplate template questions, and generates
 * real, searchable Chinese-language questions for each entry based on its
 * title, subfield, objects, methods, abstract, journal, and doctype.
 *
 * Output: overwrites data/corpus.json with enriched questions (5-10 per entry).
 * All other fields are left unchanged.
 */

const fs = require('fs');
const path = require('path');

// ── helpers ──────────────────────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Deterministic seeded pick -- same seed same result, for reproducible variety. */
function seededPick(arr, n, seed) {
  if (arr.length <= n) return [...arr];
  let s = Math.abs(seed | 0);
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function norm(s) {
  return s.replace(/[（(]/g, '(').replace(/[）)]/g, ')').replace(/[，]/g, ',').replace(/[；]/g, ';').replace(/[？?]/g, '?').replace(/\s+/g, ' ').trim();
}

// ── COMPOUND NAME RESOLUTION ────────────────────────────────────────────

/**
 * Returns a human-readable Chinese compound name suitable for use in questions.
 * Never returns a long English title slug.
 */
function resolveCompound(entry) {
  const t = entry.title || '';
  const o = entry.objects || '';
  const a = entry.abstract || '';
  const combined = t + ' ' + o + ' ' + a;

  // A. Title-first detection (title is usually more specific than objects)
  // Chinese titles
  if (/三草酸合铁|草酸铁钾|草酸合铁.*酸钾/.test(t)) return '三草酸合铁(III)酸钾';
  if (/二草酸合铜|草酸合铜.*酸钾/.test(t)) return '二草酸合铜(II)酸钾';
  if (/硫酸亚铁铵/.test(t)) return '硫酸亚铁铵（摩尔盐）';
  if (/摩尔盐|莫尔盐/.test(t)) return '摩尔盐（硫酸亚铁铵）';
  if (/七水合硫酸亚铁|七水硫酸亚铁|绿矾/.test(t)) return '七水硫酸亚铁（绿矾）';
  if (/硫酸亚铁/.test(t) && !/铵/.test(t)) return '硫酸亚铁';
  if (/五水硫酸铜/.test(t)) return '五水硫酸铜';
  if (/七水硫酸锌/.test(t)) return '七水硫酸锌';
  if (/草酸铬/.test(t)) return '草酸铬(III)配合物';
  if (/草酸锰/.test(t)) return '草酸锰(II)配合物';
  if (/草酸铝/.test(t)) return '草酸铝(III)配合物';
  if (/草酸钴/.test(t)) return '草酸钴配合物';
  if (/草酸亚铁/.test(t)) return '草酸亚铁';
  if (/碳酸铜钠/.test(t)) return '碳酸铜钠';
  if (/Cd.*草酸|草酸.*Cd|镉.*草酸|草酸.*镉/.test(t)) return '镉(II)草酸配合物';
  // Fe(III)-oxalate complex style Chinese title
  if (/Fe.*草酸|草酸.*Fe.*络合/.test(t)) return 'Fe(III)-草酸盐络合物';
  // entry 7-8: 三草酸根合铁(Ⅲ)酸钾
  if (/三草酸根合铁|草酸根合铁/.test(t)) return '三草酸合铁(III)酸钾';

  // B. Objects-field detection (fallback when title doesn't resolve)
  if (/三草酸合铁|K₃\[Fe\(C₂O₄\)₃\]/.test(o)) return '三草酸合铁(III)酸钾';
  if (/二草酸合铜/.test(o)) return '二草酸合铜(II)酸钾';
  if (/硫酸亚铁铵/.test(o)) return '硫酸亚铁铵（摩尔盐）';
  if (/草酸铬/.test(o)) return '草酸铬(III)配合物';
  if (/草酸锰/.test(o)) return '草酸锰(II)配合物';
  if (/草酸铝/.test(o)) return '草酸铝(III)配合物';
  if (/草酸钴/.test(o)) return '草酸钴配合物';
  if (/草酸镍/.test(o)) return '草酸镍配合物';

  // C. Title detection (English patterns)
  if (/potassium.*tris.*oxalato.*ferrate|potassium.*trioxalatoferrate|K3\[Fe.*oxalate/i.test(combined))
    return '三草酸合铁(III)酸钾';
  if (/ferrioxalate|ferric.*oxalate|iron.*oxalate/i.test(t))
    return '草酸铁(III)配合物';
  if (/ferrous oxalate/i.test(t))
    return '草酸亚铁';
  if (/ferrous ammonium|ammonium.*iron.*sulfate|Mohr.*salt/i.test(t))
    return '硫酸亚铁铵（摩尔盐）';
  if (/tris\(oxalato\)cobaltate|cobalt.*oxalate|oxalate.*cobalt/i.test(t))
    return '草酸钴(III)配合物';
  if (/copper.*oxalate|oxalate.*copper|bis\(oxalato\)cuprate/i.test(t))
    return '草酸合铜(II)配合物';
  if (/chromium.*oxalate|oxalate.*chrom|Cr.*oxalate|oxalate.*Cr/i.test(t))
    return '草酸铬(III)配合物';
  if (/manganese.*oxalate|oxalate.*manganese/i.test(t))
    return '草酸锰(II)配合物';
  if (/zinc.*oxalate|oxalate.*zinc/i.test(t))
    return '草酸锌(II)配合物';
  if (/nickel.*oxalate|oxalate.*nickel/i.test(t))
    return '草酸镍(II)配合物';
  if (/alumin.*oxalate|oxalate.*alumin/i.test(t))
    return '草酸铝(III)配合物';
  if (/prussian blue|普鲁士蓝/i.test(t))
    return '普鲁士蓝';
  if (/Prussian blue.*analogue|analog/i.test(t))
    return '普鲁士蓝类似物（PBA）';
  if (/cyanotype|蓝晒/i.test(t))
    return '蓝晒工艺';
  if (/melanterite/i.test(t))
    return '绿矾（七水硫酸亚铁）';
  if (/CuSO4|copper.*sulfate.*pentahydrate|copper.*sulfate.*5.*water/i.test(t))
    return '五水硫酸铜';
  if (/ZnSO4|zinc.*sulfate.*heptahydrate/i.test(t))
    return '七水硫酸锌';
  if (/diazo|diazotype/i.test(t))
    return '重氮印刷（diazotype）';
  if (/Fe\(OH\)3|Fe.*OH.*溶胶|氢氧化铁/i.test(t))
    return 'Fe(OH)₃溶胶';

  // D. Chinese phrase extraction
  const cnPhrase = t.match(/[一-鿿／（）()\[\]・·]{4,30}/u);
  if (cnPhrase) {
    const phrase = cnPhrase[0].trim();
    if (/草酸|络合物/.test(phrase) && !/^[\d\s（）()\[\]]+$/.test(phrase))
      return phrase;
    if (phrase.length >= 6 && !/^[\d\s（）()\[\]]+$/.test(phrase))
      return phrase;
  }

  // E. Subfield fallbacks
  const sf = entry.subfield || '';
  if (sf === '摩尔盐相关') return '硫酸亚铁铵（摩尔盐）';
  if (sf === '蓝晒工艺') return '蓝晒工艺';
  if (sf === '光化学应用') return '草酸铁(III)配合物';
  if (sf === '磁性研究') return '草酸盐配合物';

  // F. Objects field cleanup
  if (o && o !== '草酸配合物') {
    const short = o.replace(/C₂O₄²⁻/g, '').replace(/\[\w+\]/g, '').replace(/[、，\s]+/g, '').trim();
    if (short.length > 3 && short.length < 40) return short;
  }

  return '草酸盐配合物';
}

// ── SHORT NAME FOR QUESTIONS ─────────────────────────────────────────────

function shortName(entry) {
  const name = resolveCompound(entry);
  if (name && name.length > 3 && name.length < 50) return name;
  // Final fallback - use subfield-based hint instead of arbitrary title fragment
  const sf = entry.subfield || '';
  const o = entry.objects || '';
  if (sf === '摩尔盐相关') return '硫酸亚铁铵（摩尔盐）';
  if (sf === '蓝晒工艺') return '蓝晒工艺';
  if (/铁/.test(o)) return '铁(III)草酸盐配合物';
  if (/铜/.test(o)) return '草酸合铜(II)配合物';
  if (/铬/.test(o)) return '草酸铬配合物';
  if (/草酸/.test(o)) return '草酸盐配合物';
  return '草酸盐配合物';
}

// ── TITLE KEYWORD DETECTION ─────────────────────────────────────────────

function detectAllTopics(title, abstract, objects, methods, subfield) {
  const topics = new Set();
  const t = (title || '').toLowerCase();
  const a = (abstract || '').toLowerCase();
  const txt = t + ' ' + a;

  // --- Compound-specific ---
  if (/三草酸合铁|K3\[Fe|tris\(oxalato\)ferrate|trioxalatoferrate|ferrioxalate/i.test(txt)) topics.add('compound:ferricOxalate');
  if (/二草酸合铜|copper.*oxalate|bis\(oxalato\)cuprate|oxalate.*copper/i.test(txt)) topics.add('compound:copperOxalate');
  if (/硫酸亚铁铵|摩尔盐|莫尔盐|Mohr.{0,5}salt|ferrous ammonium/i.test(txt)) topics.add('compound:mohr');
  if (/普鲁士蓝|Prussian blue|铁蓝/i.test(txt)) topics.add('compound:prussianBlue');
  if (/蓝晒|cyanotype/i.test(txt)) topics.add('compound:cyanotype');
  if (/草酸铬|chromium.*oxalate/i.test(txt)) topics.add('compound:chromiumOxalate');
  if (/草酸锰|manganese.*oxalate/i.test(txt)) topics.add('compound:manganeseOxalate');
  if (/草酸铝|alumin.*oxalate/i.test(txt)) topics.add('compound:aluminiumOxalate');
  if (/草酸钴|cobalt.*oxalate|tris\(oxalato\)cobaltate/i.test(txt)) topics.add('compound:cobaltOxalate');
  if (/五水硫酸铜|CuSO4.*5H2O|copper.*sulfate.*penta/i.test(txt)) topics.add('compound:CuSO4');
  if (/七水硫酸锌|ZnSO4.*7H2O|zinc.*sulfate.*hepta/i.test(txt)) topics.add('compound:ZnSO4');
  if (/七水硫酸亚铁|绿矾|melanterite/i.test(txt)) topics.add('compound:FeSO4heptahydrate');
  if (/草酸亚铁|ferrous oxalate|FeC2O4/i.test(txt)) topics.add('compound:ferrousOxalate');
  if (/Cd.*草酸|镉.*草酸|草酸.*镉|cadmium.*oxalate/i.test(txt)) topics.add('compound:CdOxalate');

  // --- Subfields / conceptual ---
  if (/actinomet|光量计|量子产率|quantum yield|光子通量|photon flux/i.test(txt)) topics.add('actinometry');
  if (/光化学|photochem|photo.?reduc|photo.?induc|photo.?react|photo.?act/i.test(txt)) topics.add('photochemistry');
  if (/光解|光致|photoly/i.test(txt)) topics.add('photolysis');
  if (/flash.?photolys|闪光光解/i.test(txt)) topics.add('flashPhotolysis');
  if (/ultrafast|femtosec|picosec|超快/i.test(txt)) topics.add('ultrafast');
  if (/光电子.*谱|photoelectron|XPS|ESCA/i.test(txt)) topics.add('photoelectronSpectroscopy');
  if (/磁|magnetic|susceptibility|自旋|spin.*state|磁化率|磁矩/i.test(txt)) topics.add('magnetism');
  if (/high.?spin|低自旋|高自旋/i.test(txt)) topics.add('spinState');
  if (/热分析|热重|差热|TG[A-Z]|DTA|DSC|thermal.*decom|热分解|脱水|热稳定|非等温|non.?isothermal/i.test(txt)) topics.add('thermal');
  if (/活化能|activation energy/i.test(txt)) topics.add('activationEnergy');
  if (/晶体|crystal|X.?ray|衍射|XRD|单晶|空间群|晶系|结构.*表征|Structure.*character/i.test(txt)) topics.add('structure');
  if (/手性|chiral|enantio/i.test(txt)) topics.add('chiral');
  if (/配位.*多面体|配位数|配位构型|coord.*number|coord.*geometry|配位.*模式|配位.*方式/i.test(txt)) topics.add('coordination');
  if (/双齿|单齿|桥联|bidentate|monodentate|bridging/i.test(txt)) topics.add('coordinationMode');
  if (/滴定|titrat|氧化还原.*测定|含量.*测定|定量.*分析|标定/i.test(txt)) topics.add('analysis');
  if (/高锰酸钾|KMnO4|permanganate/i.test(txt)) topics.add('permanganate');
  if (/离子交换|ion.*exchange/i.test(txt)) topics.add('ionExchange');
  if (/电导|conductivity|摩尔电导/i.test(txt)) topics.add('conductivity');
  if (/合成|制备|synthesis|preparation/i.test(txt)) topics.add('synthesis');
  if (/固相|solid.?state/i.test(txt)) topics.add('solidState');
  if (/产率|yield|优化|optim|improve/i.test(txt)) topics.add('optimization');
  if (/教学|实验.*教学|学生|student|lab|undergraduate|课堂|课程|PBL|翻转|思政/i.test(txt)) topics.add('teaching');
  if (/绿色|green|ecological|environmentally.*friendly/i.test(txt)) topics.add('green');
  if (/光谱|spectr|UV.?Vis|红外|IR|紫外|可见.*吸收|电子.*吸收|d.?d.*跃迁|LMCT|MLCT/i.test(txt)) topics.add('spectroscopy');
  if (/电化学|电池|battery|cathode|anode|electrochem|Li.?ion|Na.?ion/i.test(txt)) topics.add('battery');
  if (/废水|垃圾|渗滤液|环境|pollutant|降解|去除.*COD|H2O2/i.test(txt)) topics.add('environmental');
  if (/H2O2|hydrogen peroxide|过氧化氢|双氧水/i.test(txt)) topics.add('H2O2');
  if (/日光|太阳光|solar|sunlight/i.test(txt)) topics.add('solarLight');
  if (/纳米|nano|形貌|morphology/i.test(txt)) topics.add('nanomorphology');
  if (/稳定|stability|空气.*稳定|氧化.*稳定/i.test(txt)) topics.add('stability');
  if (/摄影|photograph|映像|影像|调色|toning/i.test(txt)) topics.add('photography');
  if (/艺术家|颜料|pigment|艺术|art/i.test(txt)) topics.add('art');
  if (/颜色|色调|color|colour|蓝色|绿色|chromophore/i.test(txt)) topics.add('color');
  if (/热力学|thermodynamic|焓|焓变|生成焓|标准.*焓/i.test(txt)) topics.add('thermodynamics');
  if (/动力学|kinetics/i.test(txt)) topics.add('kinetics');
  if (/示性式|分子式|组成.*确定|化学式|formula|molecular.*formula/i.test(txt)) topics.add('formula');
  if (/废铁|废白铁|废物.*利用|回收|recycl/i.test(txt)) topics.add('wasteRecycling');
  if (/晶体.*生长|crystal.*grow|display.*crystal|培养.*晶体/i.test(txt)) topics.add('crystalGrowth');
  if (/铁源|铁原料/i.test(txt)) topics.add('ironSource');
  if (/量化.*计算|DFT|密度泛函|ab.*initio|量子化学.*计算|comput/i.test(txt)) topics.add('computational');
  if (/矿物|natural.*mineral|天然|mineral/i.test(txt)) topics.add('mineral');
  if (/磷.*酸|phosphoric.*acid|H3PO4/i.test(txt)) topics.add('phosphoricAcid');
  if (/重氮|diazo|叠氮/i.test(txt)) topics.add('diazo');
  if (/沉淀|溶解.*度|solubility|结晶/i.test(txt)) topics.add('solubility');
  if (/蒸发.*结晶|降温.*结晶|重结晶|recrystall/i.test(txt)) topics.add('crystallization');
  if (/聚合物|polymer/i.test(txt)) topics.add('polymer');

  // From subfield
  if (subfield === '光化学应用') topics.add('photochemistry');
  if (subfield === '合成制备') topics.add('synthesis');
  if (subfield === '分析测定') topics.add('analysis');
  if (subfield === '结构表征') topics.add('structure');
  if (subfield === '磁性研究') topics.add('magnetism');
  if (subfield === '热分析') topics.add('thermal');
  if (subfield === '实验教学') topics.add('teaching');
  if (subfield === '摩尔盐相关') topics.add('compound:mohr');
  if (subfield === '蓝晒工艺') topics.add('compound:cyanotype');
  if (subfield === '草酸配合物') topics.add('synthesis');

  // From methods
  if (/X射线|衍射/i.test(methods)) topics.add('structure');
  if (/光谱/i.test(methods)) topics.add('spectroscopy');
  if (/光化学/i.test(methods)) topics.add('photochemistry');
  if (/热分析/i.test(methods)) topics.add('thermal');
  if (/磁化率/i.test(methods)) topics.add('magnetism');
  if (/滴定/i.test(methods)) topics.add('analysis');
  if (/固相/i.test(methods)) topics.add('solidState');
  if (/离子交换/i.test(methods)) topics.add('ionExchange');

  return topics;
}

// ── QUESTION GENERATION ──────────────────────────────────────────────────

/** Returns an array of questions for a given topic+compound combination. */
function genQuestions(topic, cmp) {
  // Use a reasonable short name
  const c = cmp || '该化合物';
  const qs = [];

  const lib = {
    'compound:ferricOxalate': [
      `如何制备三草酸合铁(III)酸钾？`,
      `三草酸合铁(III)酸钾的合成路线是什么？`,
      `三草酸合铁(III)酸钾的合成条件如何优化？`,
      `如何提高三草酸合铁(III)酸钾的产率？`,
      `三草酸合铁(III)酸钾的分子式如何通过组成分析确定？`,
      `三草酸合铁(III)酸钾中草酸根含量如何测定？`,
      `三草酸合铁(III)酸钾中铁含量如何测定？`,
      `三草酸合铁(III)酸钾的配阴离子电荷数如何测定？`,
      `三草酸合铁(III)酸钾的晶体结构是什么？`,
      `三草酸合铁(III)酸钾中Fe(III)的配位数和配位构型如何？`,
      `三草酸合铁(III)酸钾的光化学性质是什么？`,
      `三草酸合铁(III)酸钾为什么具有光敏性？`,
      `三草酸合铁(III)酸钾的光致还原反应机理是什么？`,
      `三草酸合铁(III)酸钾热分解分为几个阶段？`,
      `三草酸合铁(III)酸钾的TG-DTA曲线如何解读？`,
      `三草酸合铁(III)酸钾的磁矩是多少？`,
      `三草酸合铁(III)酸钾中Fe(III)是高自旋还是低自旋？`,
      `三草酸合铁(III)酸钾的未成对电子数是多少？`,
      `三草酸合铁(III)酸钾的红外光谱特征吸收峰有哪些？`,
      `三草酸合铁(III)酸钾的紫外-可见光谱特征是什么？`,
      `三草酸合铁(III)酸钾在蓝晒工艺中的作用是什么？`,
      `三草酸合铁(III)酸钾为什么可用作化学光量计？`,
      `三草酸合铁(III)酸钾的绿色合成方法是什么？`,
      `三草酸合铁(III)酸钾晶体的生长条件是什么？`,
      `如何培养大尺寸的三草酸合铁(III)酸钾晶体？`,
      `三草酸合铁(III)酸钾中结晶水含量如何测定？`,
      `无水三草酸合铁(III)酸钾与三水合物在结构上有何差异？`,
      `三草酸合铁(III)酸钾的光解量子产率是多少？`,
      `为什么三草酸合铁(III)酸钾溶于水呈绿色？`,
      `从废铁屑制备三草酸合铁(III)酸钾的路线是什么？`,
      `三草酸合铁(III)酸钾制备中如何避免Fe(II)被氧化？`,
      `三草酸合铁(III)酸钾在光照下为什么颜色会变化？`,
    ],
    'compound:copperOxalate': [
      `如何制备二草酸合铜(II)酸钾？`,
      `二草酸合铜(II)酸钾的合成路线是什么？`,
      `二草酸合铜(II)酸钾的化学式为什么有争议？`,
      `二草酸合铜(II)酸钾中Cu(II)的配位数是多少？`,
      `二草酸合铜(II)酸钾的晶体结构是什么？`,
      `二草酸合铜(II)酸钾的固相合成方法是什么？`,
      `二草酸合铜(II)酸钾的绿色制备方法是什么？`,
      `二草酸合铜(II)酸钾制备中的疑难问题有哪些？`,
      `二草酸合铜(II)酸钾的形貌如何控制？`,
      `二草酸合铜(II)酸钾中铜含量的测定方法是什么？`,
      `二草酸合铜(II)酸钾的热稳定性如何？`,
      `二草酸合铜(II)酸钾的磁化率如何测定？`,
      `二草酸合铜(II)酸钾的紫外-可见光谱特征是什么？`,
      `二草酸合铜(II)酸钾为什么是蓝色的？`,
      `二草酸合铜(II)酸钾中草酸根的配位方式是双齿还是单齿？`,
      `如何区分两种水合草酸合铜(II)酸钾晶体？`,
      `二草酸合铜(II)酸钾制备实验中产率偏低的原因是什么？`,
    ],
    'compound:mohr': [
      `硫酸亚铁铵（摩尔盐）如何制备？`,
      `硫酸亚铁铵的制备实验中关键操作是什么？`,
      `硫酸亚铁铵的制备条件如何优化？`,
      `为什么制备硫酸亚铁铵时要保持酸性条件？`,
      `硫酸亚铁铵比硫酸亚铁更稳定的原因是什么？`,
      `如何提高硫酸亚铁铵晶体的产率和纯度？`,
      `硫酸亚铁铵中Fe2+含量如何标定？`,
      `硫酸亚铁铵的纯度如何鉴定？`,
      `硫酸亚铁铵的空气稳定性如何？`,
      `摩尔盐和硫酸亚铁的稳定性有何差异？`,
      `为什么用莫尔盐做铁源来制备三草酸合铁(III)酸钾？`,
      `硫酸亚铁铵制备实验的注意事项有哪些？`,
      `硫酸亚铁铵制备中为什么使用废铁屑？`,
      `如何判断硫酸亚铁铵晶体的纯度是否合格？`,
      `硫酸亚铁铵晶体为什么呈浅绿色？`,
      `硫酸亚铁铵制备实验中常见错误有哪些？`,
      `硫酸亚铁铵在水中的溶解度与温度的关系如何？`,
      `莫尔盐在分析化学中作为基准物质有什么优势？`,
    ],
    'compound:prussianBlue': [
      `普鲁士蓝的化学组成是什么？`,
      `普鲁士蓝的制备方法是什么？`,
      `普鲁士蓝为什么呈现深蓝色？`,
      `普鲁士蓝作为颜料的化学原理是什么？`,
      `普鲁士蓝与三草酸合铁(III)酸钾有何关联？`,
      `普鲁士蓝的结构是配位聚合物吗？`,
      `普鲁士蓝在电化学中有什么应用？`,
      `如何将普鲁士蓝转化为普鲁士白？`,
    ],
    'compound:cyanotype': [
      `蓝晒法的光化学原理是什么？`,
      `蓝晒影像的蓝色是由什么物质产生的？`,
      `为什么蓝晒曝光后要水洗？`,
      `影响蓝晒影像质量的因素有哪些？`,
      `蓝晒工艺中曝光时间如何确定？`,
      `如何用三草酸合铁(III)酸钾制作蓝晒照片？`,
      `蓝晒法适用于哪些纸张？`,
      `蓝晒影像如何调色？`,
      `蓝晒法与数码摄影有何不同？`,
      `传统蓝晒工艺的核心化学反应是什么？`,
      `蓝晒法中柠檬酸铁铵和铁氰化钾各起什么作用？`,
    ],
    'compound:chromiumOxalate': [
      `草酸铬(III)配合物的合成方法是什么？`,
      `草酸铬(III)配合物的配位结构是什么？`,
      `草酸铬(III)配合物的热稳定性与铁配合物有何不同？`,
      `Cr(III)草酸配合物为什么是动力学惰性的？`,
    ],
    'compound:manganeseOxalate': [
      `草酸锰(II)配合物的磁性特征是什么？`,
      `草酸锰配合物的晶体结构有什么特点？`,
      `草酸锰配合物为什么呈现特定颜色？`,
    ],
    'compound:aluminiumOxalate': [
      `草酸铝(III)配合物的热分解过程是什么？`,
      `Al(III)草酸配合物与Fe(III)草酸配合物的热稳定性有何差异？`,
    ],
    'compound:cobaltOxalate': [
      `草酸钴配合物的光化学性质是什么？`,
      `Co(III)草酸配合物的闪光光解研究揭示了什么？`,
      `草酸钴(III)配合物与草酸铁(III)酸钾的光化学行为有何异同？`,
    ],
    'compound:CdOxalate': [
      `镉(II)草酸配合物的合成方法是什么？`,
      `Cd(II)草酸配合物的结构特点是什么？`,
      `镉(II)草酸配合物为什么能形成特定的拓扑结构？`,
    ],
    'compound:CuSO4': [
      `五水硫酸铜的脱水机理是什么？`,
      `五水硫酸铜的TG-DTA曲线如何解读？`,
      `五水硫酸铜中五个结晶水的结合方式一样吗？`,
      `气相色谱法如何研究五水硫酸铜的脱水过程？`,
    ],
    'compound:ZnSO4': [
      `七水硫酸锌的脱水机理是什么？`,
      `七水硫酸锌的热分解过程分为几个阶段？`,
    ],
    'compound:FeSO4heptahydrate': [
      `七水硫酸亚铁（绿矾）的脱水过程分为几个阶段？`,
      `绿矾与摩尔盐在稳定性上有何不同？`,
      `绿矾在空气中为什么会风化？`,
    ],
    'compound:ferrousOxalate': [
      `草酸亚铁如何制备？`,
      `草酸亚铁的热分解行为是什么？`,
      `草酸亚铁在电池材料中有何应用？`,
    ],

    // --- conceptual topics ---
    actinometry: [
      `${c}为什么可用作化学光量计？`,
      `如何用${c}测定光源的光子通量？`,
      `${c}光量计的量子产率如何随波长变化？`,
      `使用${c}光量计时应注意哪些系统误差？`,
      `IUPAC推荐的${c}光量计标准操作流程是什么？`,
      `草酸铁光量计与碘化物光量计相比有何优缺点？`,
      `如何用CO2释放量替代Fe(II)显色来简化草酸铁光量计？`,
    ],
    photochemistry: [
      `${c}的光化学反应机理是什么？`,
      `LMCT机理如何解释${c}的光化学活性？`,
      `光强和波长对${c}的光反应有何影响？`,
      `pH对${c}光解反应有何影响？`,
      `${c}的光致还原产物是什么？`,
      `${c}为什么在紫外光照射下会发生光还原？`,
      `紫外光和可见光对${c}的光解效果有何不同？`,
    ],
    photolysis: [
      `${c}的光解反应机理是什么？`,
      `${c}光解的量子产率是多少？`,
    ],
    flashPhotolysis: [
      `闪光光解技术如何研究${c}的快速光化学反应？`,
      `闪光光解实验揭示了${c}的哪些瞬态物种？`,
    ],
    ultrafast: [
      `超快光谱揭示了${c}光激发态的哪些信息？`,
      `${c}光还原过程发生在什么时间尺度（飞秒/皮秒）？`,
    ],
    photoelectronSpectroscopy: [
      `光电子能谱如何研究${c}的电子结构？`,
      `超快光电子能谱揭示了${c}激发态的哪些动力学信息？`,
    ],
    magnetism: [
      `${c}的磁矩是多少？实验值和理论值如何对比？`,
      `如何用Gouy天平法测定${c}的磁化率？`,
      `${c}的未成对电子数与磁性有何关系？`,
      `磁化率数据如何反映${c}的电子构型？`,
    ],
    spinState: [
      `${c}中金属离子是高自旋还是低自旋？为什么？`,
      `配体场分裂能如何影响${c}的自旋状态？`,
    ],
    thermal: [
      `${c}的TG-DSC/TG-DTA曲线如何解读？`,
      `${c}在什么温度开始分解？`,
      `${c}的热分解产物是什么？`,
      `不同金属草酸配合物的热稳定性顺序是什么？为什么？`,
      `如何通过TG曲线确定${c}中的结晶水数目？`,
      `${c}的DTA曲线中各吸热/放热峰对应什么过程？`,
    ],
    activationEnergy: [
      `如何计算${c}脱水反应的活化能？`,
      `${c}热分解的活化能和反应级数是多少？`,
    ],
    structure: [
      `${c}的晶体结构属于什么晶系？`,
      `${c}的空间群是什么？`,
      `${c}中金属离子的配位多面体是什么？`,
      `${c}的XRD特征峰在哪里？`,
      `如何用X射线单晶衍射确定${c}的结构？`,
      `${c}中草酸根的配位模式是什么（双齿/单齿/桥联）？`,
      `${c}的键长和键角有什么特点？`,
    ],
    chiral: [
      `${c}为什么能形成手性结构？`,
      `${c}的手性三维网络是如何构建的？`,
      `手性配位聚合物的合成策略是什么？`,
    ],
    coordination: [
      `${c}中金属离子的配位数和配位构型是什么？`,
      `${c}的配位多面体是什么？`,
    ],
    coordinationMode: [
      `${c}中草酸根的配位方式是双齿还是单齿？`,
      `${c}中草酸根是否参与桥联配位？`,
    ],
    analysis: [
      `如何测定${c}中金属离子的含量？`,
      `${c}中草酸根含量的测定方法是什么？`,
      `${c}组分的滴定条件是什么？`,
      `分析${c}组成时的误差来源有哪些？`,
    ],
    permanganate: [
      `高锰酸钾氧化草酸根的反应条件是什么（温度、酸度）？`,
      `高锰酸钾法测定草酸根含量的滴定终点如何判断？`,
    ],
    ionExchange: [
      `如何用离子交换法测定${c}的配阴离子电荷？`,
      `离子交换法测定配合物电荷数的原理是什么？`,
    ],
    conductivity: [
      `${c}的电导和摩尔电导率如何测定？`,
      `电导率数据如何反映${c}在水中的离子行为？`,
    ],
    synthesis: [
      `${c}的合成原理和路线是什么？`,
      `合成${c}的原料配比如何确定？`,
      `影响${c}产率的因素有哪些？`,
      `${c}合成中温度和pH如何控制？`,
      `${c}合成步骤中的关键操作是什么？`,
    ],
    solidState: [
      `${c}的固相合成与液相合成有何区别？`,
      `固相合成${c}的优势和注意事项是什么？`,
    ],
    optimization: [
      `${c}的制备条件如何优化？`,
      `正交实验法如何用于优化${c}的合成条件？`,
    ],
    teaching: [
      `关于${c}的实验教学目标是什么？`,
      `${c}实验中需要哪些基本操作技能？`,
      `${c}实验中有哪些安全注意事项？`,
      `${c}实验中常见的学生操作错误有哪些？`,
      `如何设计一个关于${c}的综合性实验？`,
      `PBL教学法如何应用于${c}实验中？`,
      `${c}实验中如何融入课程思政元素？`,
    ],
    green: [
      `${c}的绿色合成路线是什么？`,
      `如何减少${c}合成中的废液排放？`,
    ],
    spectroscopy: [
      `${c}的电子吸收光谱中主要吸收带对应什么跃迁？`,
      `如何解读${c}的UV-Vis光谱？`,
      `${c}的红外光谱中C=O和M-O的振动峰在哪里？`,
      `${c}的d-d跃迁和LMCT跃迁分别在什么波长？`,
      `${c}为什么呈现特定颜色？（配体场理论解释）`,
    ],
    battery: [
      `${c}作为电池电极材料的原理是什么？`,
      `${c}在锂/钠离子电池中的电化学性能如何？`,
      `草酸盐作为电池电极材料有什么优缺点？`,
    ],
    environmental: [
      `${c}/H2O2/日光体系降解有机物的机理是什么？`,
      `影响${c}光催化降解效率的因素有哪些？`,
      `pH和H2O2用量对${c}体系处理废水有何影响？`,
    ],
    H2O2: [
      `H2O2在草酸铁光催化体系中的作用是什么？`,
      `如何控制H2O2的投加量以优化光催化效果？`,
    ],
    solarLight: [
      `日光/太阳光对${c}的光反应有何特殊影响？`,
      `如何利用太阳光驱动${c}的光化学反应？`,
    ],
    nanomorphology: [
      `${c}的微观形貌如何控制？`,
      `${c}的形貌对其性能有何影响？`,
    ],
    stability: [
      `${c}在空气中的稳定性如何？`,
      `${c}的储存条件和注意事项是什么？`,
    ],
    photography: [
      `光化学在传统摄影技术中有哪些应用？`,
      `银盐摄影和非银盐摄影（如蓝晒）各有什么特点？`,
    ],
    art: [
      `化学与艺术如何通过蓝晒法结合？`,
      `${c}在艺术创作中有哪些应用？`,
    ],
    color: [
      `${c}的颜色来源于什么类型的电子跃迁？`,
      `过渡金属配合物的颜色与配体场理论有何关系？`,
    ],
    thermodynamics: [
      `${c}的标准生成焓如何测定？`,
      `复盐草酸盐标准生成焓的计算方法是什么？`,
    ],
    kinetics: [
      `${c}反应动力学的实验研究方法有哪些？`,
      `如何确定${c}分解反应的速率方程？`,
    ],
    formula: [
      `如何通过实验数据确定${c}的分子式？`,
      `推导配合物化学式的关键步骤是什么？`,
    ],
    wasteRecycling: [
      `如何利用废铁屑制备${c}？`,
      `废铁屑预处理对${c}产率有何影响？`,
    ],
    crystalGrowth: [
      `如何培养大尺寸的${c}晶体？`,
      `影响${c}晶体生长的因素有哪些？`,
      `蒸发结晶、降温结晶和扩散法培养${c}晶体各有什么优缺点？`,
    ],
    ironSource: [
      `为什么选用莫尔盐作为制备三草酸合铁(III)酸钾的铁源？`,
      `不同铁源（硫酸铁、氯化铁、莫尔盐）对产物质量有何影响？`,
    ],
    computational: [
      `DFT计算如何研究${c}的电子结构和反应机理？`,
      `量子化学计算预测的${c}性质与实验结果符合吗？`,
    ],
    mineral: [
      `自然界中存在哪些草酸盐矿物？`,
      `天然草酸盐矿物与合成草酸配合物在结构和性质上有何异同？`,
    ],
    phosphoricAcid: [
      `如何从湿法磷酸中回收铁资源？`,
      `湿法磷酸副产品制备草酸亚铁的工艺是什么？`,
    ],
    diazo: [
      `重氮印刷术（diazotype）的光化学原理是什么？`,
      `重氮化合物光分解的化学过程是什么？`,
    ],
    solubility: [
      `${c}在水中的溶解度受哪些因素影响？`,
      `${c}的溶解度曲线有什么特点？`,
    ],
    crystallization: [
      `结晶方法（蒸发结晶与降温结晶）在${c}纯化中的应用是什么？`,
      `重结晶对提高${c}纯度有何作用？`,
    ],
    polymer: [
      `${c}形成的配位聚合物有什么结构特点？`,
      `配位聚合物的拓扑结构取决于哪些因素？`,
    ],
  };

  return lib[topic] || [];
}

// ── get unique title-hook question ───────────────────────────────────────

/** Generates 1-2 entry-unique questions based on its title. */
function titleHookQuestion(entry) {
  const t = entry.title || '';
  const a = entry.abstract || '';
  const qs = [];

  // Try to extract a unique angle from the abstract
  if (a && a.length > 30) {
    // Check for specific experiment details in abstract
    if (/考察了.*pH|考察了.*温度|考察了.*时间|考察了.*用量/.test(a)) {
      const factors = a.match(/考察了(.{5,50})/);
      if (factors) qs.push(`实验考察了哪些因素对反应的影响？各因素影响规律如何？`);
    }
    if (/确定.*优化.*条件|优化.*工艺.*条件/.test(a)) {
      qs.push(`该研究确定的优化工艺条件是什么？`);
    }
  }

  // Title-specific
  if (/\(Ⅰ\)|Ⅱ|第二部分|续|上|下/.test(t)) qs.push(`该文献是否是系列研究的一部分？与其他部分有何关联？`);
  if (/改进|改良|new.*approach|improved|modified/i.test(t)) qs.push(`该方法相比于传统方法做了哪些改进？`);
  if (/比较|compar|versus|vs/i.test(t)) qs.push(`研究中进行了哪些对比？对比结果说明了什么？`);
  if (/综述|review|survey|进展|new insight/i.test(t)) qs.push(`该综述总结了哪些主要研究进展？`);
  if (/综合|integrated|holistic|multi/i.test(t)) qs.push(`该综合研究整合了哪些实验方法？为什么要整合？`);
  if (/探索|探究|inquiry|discovery.*based/i.test(t)) qs.push(`该研究的探索性体现在哪些方面？有什么意外发现？`);
  if (/绿色|green|environmentally.*friendly/i.test(t)) qs.push(`该绿色方法相比传统方法减少了哪些有害物质的使用？`);
  if (/思政|课程思政|ideological/i.test(t)) qs.push(`该实验如何实现化学教学与思政教育的融合？`);
  if (/室温|room.*temperature|ambient/i.test(t)) qs.push(`室温合成相比加热合成有什么优势？`);

  // Academic paper style
  if (/ed\d{3}p?\d+|jce\d{4}p?\d+|acs\.jchemed/i.test(t)) qs.push(`该JCE文献对本科实验教学有何指导意义？`);

  // Specific compounds in title
  if (/普鲁士蓝|Prussian blue/i.test(t)) qs.push(`普鲁士蓝的历史发现和在艺术中的应用是什么？`);
  if (/光量计|actinometer/i.test(t)) qs.push(`该文献标定的光量计较准数据与经典值有何差异？`);
  if (/热分解|热分析|thermal.*decom/i.test(t)) qs.push(`不同金属草酸配合物的热稳定性如何比较？`);

  return qs;
}

// ── boilerplate detection ────────────────────────────────────────────────

const BOILERPLATE_PATTERNS = [
  /的?主要研究内容是什么[？?]?$/,
  /该文献的实验方法有哪些[？?]?$/,
  /该合成方法的优缺点有哪些[？?]?$/,
  /的实验步骤是什么[？?]?$/,
];

function isBoilerplate(q) {
  return BOILERPLATE_PATTERNS.some(p => p.test(q));
}

function isGeneric(q) {
  const gens = [
    /^该配合物的光化学性质如何[？?]?$/,
    /^光致还原反应的机理是什么[？?]?$/,
    /^如何测定配合物的磁化率[？?]?$/,
    /^该配合物的未成对电子数是多少[？?]?$/,
    /^该配合物的晶体结构是什么[？?]?$/,
    /^配位数和配位构型如何[？?]?$/,
    /^热分解过程分为几个阶段[？?]?$/,
    /^脱水反应的活化能是多少[？?]?$/,
  ];
  return gens.some(p => p.test(q));
}

function keepWorthy(existingQs) {
  return (existingQs || []).filter(q => {
    if (isBoilerplate(q)) return false;
    if (isGeneric(q)) return false;
    if (q.length < 5) return false;
    return true;
  });
}

// ── main ──────────────────────────────────────────────────────────────────

function main() {
  const filePath = path.resolve(__dirname, '..', 'data', 'corpus.json');
  console.log('Reading corpus from:', filePath);

  const corpus = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const entries = corpus.entries;

  // Pre-stats
  const beforeTotalQs = entries.reduce((sum, e) => sum + (e.questions || []).length, 0);
  const beforeUniqueQs = new Set(entries.flatMap(e => e.questions || [])).size;
  const beforeBoilerplateCount = entries.flatMap(e => e.questions || []).filter(isBoilerplate).length;

  console.log('\n=== BEFORE ===');
  console.log(`  Entries:                  ${entries.length}`);
  console.log(`  Total questions:          ${beforeTotalQs}`);
  console.log(`  Unique questions:         ${beforeUniqueQs}`);
  console.log(`  Boilerplate questions:    ${beforeBoilerplateCount}`);
  console.log(`  Avg questions per entry:  ${(beforeTotalQs / entries.length).toFixed(1)}`);

  let entriesWithKept = 0;
  const subfieldStats = {};
  const compoundNameStats = {};

  for (const entry of entries) {
    const cmp = shortName(entry);
    const topics = detectAllTopics(entry.title, entry.abstract, entry.objects, entry.methods, entry.subfield);

    // Track compound name quality
    const cnKey = cmp.length < 4 ? '(short)' : cmp.length > 50 ? '(long)' : '(ok)';
    compoundNameStats[cnKey] = (compoundNameStats[cnKey] || 0) + 1;

    // Keep existing real questions
    const kept = keepWorthy(entry.questions || []);
    if (kept.length > 0) entriesWithKept++;

    // Generate from topics
    const seen = new Set();
    const candidates = [];

    function add(q) {
      // Clean up: replace overly long compound references
      let clean = q;
      if (cmp.length > 40 && q.includes(cmp)) {
        clean = q.replace(new RegExp(cmp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '该配合物');
      }
      const n = norm(clean);
      if (!seen.has(n) && clean.length < 150) {
        seen.add(n);
        candidates.push(clean);
      }
    }

    // 1. Keep existing
    for (const q of kept) add(q);

    // 2. Compound-specific questions first
    const compoundTopics = [...topics].filter(t => t.startsWith('compound:'));
    for (const ct of compoundTopics) {
      for (const q of genQuestions(ct, cmp)) add(q);
    }

    // 3. Other topic questions
    const otherTopics = [...topics].filter(t => !t.startsWith('compound:'));
    for (const ot of otherTopics) {
      for (const q of genQuestions(ot, cmp)) add(q);
    }

    // 4. Title hook questions
    for (const q of titleHookQuestion(entry)) add(q);

    // 5. Ensure minimum with non-generic defaults
    // Priority: existing > compound > topic > fallback
    const fallbackQs = [
      `${cmp}的实验原理是什么？`,
      `${cmp}的性质和应用有哪些？`,
      `关于${cmp}的研究涉及哪些主要方法？`,
      `${cmp}在配位化学中有什么地位？`,
      `学习${cmp}能掌握哪些化学实验技能？`,
    ];
    for (const fq of fallbackQs) {
      if (candidates.length >= 5) break;
      add(fq);
    }

    // Select final 5-10
    const keptFinal = candidates.filter(q => kept.includes(q));
    const genFinal = candidates.filter(q => !kept.includes(q));

    let selected;
    if (keptFinal.length >= 5) {
      selected = [...keptFinal.slice(0, 8)];
      const rem = 10 - selected.length;
      if (rem > 0) selected.push(...seededPick(genFinal, rem, entry.id));
    } else {
      selected = [...keptFinal, ...seededPick(genFinal, Math.max(5, Math.min(10, candidates.length)) - keptFinal.length, entry.id)];
    }

    // Fallback to ensure 5
    while (selected.length < 5) {
      const g = fallbackQs.shift();
      if (!g) break;
      const ng = norm(g);
      if (!selected.some(s => norm(s) === ng)) selected.push(g);
    }

    entry.questions = selected.slice(0, 10);

    // Per-subfield stats
    const sf = entry.subfield || '(none)';
    if (!subfieldStats[sf]) subfieldStats[sf] = { entries: 0, questions: 0 };
    subfieldStats[sf].entries++;
    subfieldStats[sf].questions += entry.questions.length;
  }

  // Post-stats
  const afterTotalQs = entries.reduce((sum, e) => sum + (e.questions || []).length, 0);
  const afterUniqueQs = new Set(entries.flatMap(e => e.questions || [])).size;
  const afterBoilerplateCount = entries.flatMap(e => e.questions || []).filter(isBoilerplate).length;
  const afterPlaceholderCount = entries.flatMap(e => e.questions || []).filter(q => q.includes('该配合物') || q.includes('该化合物')).length;

  console.log('\n=== AFTER ===');
  console.log(`  Total questions:          ${afterTotalQs}`);
  console.log(`  Unique questions:         ${afterUniqueQs}`);
  console.log(`  Boilerplate questions:    ${afterBoilerplateCount}`);
  console.log(`  Generic placeholder Qs:   ${afterPlaceholderCount}`);
  console.log(`  Avg questions per entry:  ${(afterTotalQs / entries.length).toFixed(1)}`);
  console.log(`  Kept existing Qs:         ${entriesWithKept} entries`);

  console.log('\n=== Compound Name Quality ===');
  for (const [k, v] of Object.entries(compoundNameStats).sort()) {
    console.log(`  ${k}: ${v} entries`);
  }

  console.log('\n=== Per Subfield ===');
  for (const [sf, stats] of Object.entries(subfieldStats).sort()) {
    console.log(`  ${sf.padEnd(16)} ${String(stats.entries).padStart(3)} entries, ${String(stats.questions).padStart(4)} questions, avg ${(stats.questions / stats.entries).toFixed(1)}`);
  }

  // Sample entries
  console.log('\n=== Sample Entries ===');
  const sampleIds = [1, 5, 16, 36, 77, 84, 94, 128, 135, 164, 184, 211, 261, 288, 291];
  for (const id of sampleIds) {
    const e = entries.find(x => x.id === id);
    if (!e) continue;
    console.log(`\n[${e.id}] ${(e.title || '').substring(0, 60)}  (${e.subfield} | cmp: ${shortName(e)})`);
    (e.questions || []).forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
  }

  // Write
  fs.writeFileSync(filePath, JSON.stringify(corpus, null, 2), 'utf8');
  console.log(`\nWrote enriched corpus to: ${filePath}`);
  console.log('Done.');
}

main();
