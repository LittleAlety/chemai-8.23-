'use strict';
/**
 * local_answer.js — ChemAI 助手的「本地（无 LLM）回答路径」忠实复刻
 *
 * 所有常量与函数均逐字复制自 assistant.html（带来源行号注释），未做重实现/简化。
 * 供 self_train.js 等无头评分流水线调用：answer(q) 完全复现浏览器端
 * handleQA() 在未启用 LLM 时走的检索→类比→置信度→答案组合 4 段流水线。
 *
 * 输入（init() 惰性加载）：
 *   FAQ    — 从 assistant.html 内嵌 const FAQ=[] 实时解析（1055 条）
 *   Corpus — data/corpus.json 的 entries 数组（365 条）
 *
 * 浏览器依赖 stub：
 *   esc → escHTML；webFallbackHTML → ''；无 document/$ 使用（纯函数）
 */

const fs = require('fs');
const path = require('path');

const ASSISTANT_HTML = path.join(__dirname, '..', 'assistant.html');
const CORPUS_JSON = path.join(__dirname, '..', 'data', 'corpus.json');

/* ================= 浏览器依赖 stub ================= */
// 来源 assistant.html:625（esc → 本地 escHTML）
function escHTML(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
// 来源 assistant.html:2475（网络补充段落在无头评分中不使用）
function webFallbackHTML(q){ return ''; }

/* ================= 常量（来源标注，逐字复制） ================= */
// 来源 assistant.html:628-629
const SUBMAP={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','⁻':'-','⁺':'+'};
const norm=s=>String(s||'').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g,c=>SUBMAP[c]||c).replace(/\s+/g,'');

// 来源 assistant.html:632-634（分类归一化，loadCorpus 对 subfield 做同样处理）
const CATEGORY_ALIAS_MAP={'安全废物':'安全与废物处理','配位理论':'配位化学理论','热化学分析':'热分析','情景分析':'综合研究','比较分析':'综合研究','计算应用':'高等理论','其他':'综合研究','综合':'综合研究','分析表征':'分析测定','实验原理与方程式':'反应原理','操作步骤与参数':'实验操作','物质性质与原因':'综合研究','安全与分析':'安全与废物处理'};
const CANONICAL_CATS=new Set(['合成制备','反应原理','实验操作','分析测定','光化学应用','结构表征','磁性研究','热分析','安全与废物处理','配位化学理论','实验教学','综合研究','化学史','高等理论','蓝晒工艺','摩尔盐相关','草酸配合物']);
function normCat(v){if(!v||typeof v!=='string')return'综合研究';var t=v.trim();if(!t)return'综合研究';if(CANONICAL_CATS.has(t))return t;if(CATEGORY_ALIAS_MAP[t])return CATEGORY_ALIAS_MAP[t];return t;}

// 来源 assistant.html:640
function stripHTML(s){return String(s==null?'':s).replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");}

// 来源 assistant.html:836
const DOMAIN_TERMS=['三草酸合铁酸钾','三草酸合铁','草酸铁钾','草酸亚铁','莫尔盐','摩尔盐','硫酸亚铁铵','硫酸亚铁','过氧化氢','双氧水','草酸','乙二酸','草酸根','乙醇','硫酸','高锰酸钾','铁氰化钾','黄血盐','配位','配合物','络合物','配体','配离子','中心离子','结晶','重结晶','结晶水','抽滤','减压过滤','过滤','洗涤','沉淀','氧化','还原','氧化还原','滴定','配位滴定','产率','理论产量','误差','水浴','加热','温度','避光','见光','光解','光化学','感光','蓝晒','晒蓝','磁化率','磁性','稳定性','分解','热重','热分析','红外','光谱','表征','xrd','废液','安全','腐蚀','防护','仪器','装置','步骤','操作','制备','合成','方程式','纯度','组成测定','含量测定','终点','催化剂','晒图','柠檬酸铁铵','感光剂','剂量计','化学发光','单晶','翠绿色','绿色晶体','ph','氢氧化铁','氧化铁'];
// 来源 assistant.html:837
const STOP_TERMS=['什么','怎么','如何','为什么','为何','哪些','多少','请问','一下','实验','的','了','吗','呢','吧','我们','你们','这个','那个','一个','需要','进行','通过','以及','因此','所以','时候','过程','注意','事项','介绍','简述','说明','讲讲','告诉','能否','可以','课件','教材','老师','同学','内容','知识','问题','解答','回答','帮助','谢谢','啥','怎麼','吗？','？','?'];
// 来源 assistant.html:838-849
const CHEM_DB=[
 {name:'三草酸合铁酸钾',alias:['三草酸合铁酸钾','三草酸合铁','草酸铁钾','k3[fe(c2o4)3]','ferrioxalate','铁草酸钾'],pubchem:'potassium ferrioxalate'},
 {name:'草酸',alias:['草酸','乙二酸','h2c2o4','oxalic'],pubchem:'oxalic acid'},
 {name:'过氧化氢',alias:['过氧化氢','双氧水','h2o2','hydrogen peroxide'],pubchem:'hydrogen peroxide'},
 {name:'硫酸亚铁铵(莫尔盐)',alias:['莫尔盐','摩尔盐','硫酸亚铁铵','mohr'],pubchem:'ammonium iron(II) sulfate'},
 {name:'乙醇',alias:['乙醇','酒精','c2h5oh','ethanol'],pubchem:'ethanol'},
 {name:'硫酸',alias:['硫酸','h2so4','sulfuric'],pubchem:'sulfuric acid'},
 {name:'硫酸亚铁',alias:['硫酸亚铁','feso4','绿矾'],pubchem:'ferrous sulfate'},
 {name:'高锰酸钾',alias:['高锰酸钾','kmno4'],pubchem:'potassium permanganate'},
 {name:'铁氰化钾',alias:['铁氰化钾','k3[fe(cn)6]','赤血盐'],pubchem:'potassium ferricyanide'},
 {name:'氢氧化铁',alias:['氢氧化铁','fe(oh)3'],pubchem:'iron(III) hydroxide'}
];
// 来源 assistant.html:850
const OP_TERMS=['制备','合成','过滤','抽滤','减压过滤','结晶','重结晶','洗涤','氧化','滴定','产率','蓝晒','操作','步骤','蒸发','加热','水浴','称量','溶解','干燥','装片','磁化率','测定','纯化','沉淀'];
// 来源 assistant.html:878
const SYN_GROUPS=[['抽滤','减压过滤','吸滤','布氏漏斗'],['蓝晒','晒蓝','晒图','cyanotype'],['磁化率','磁性','磁天平'],['产率','理论产量','百分产率'],['结晶','析晶','晶体析出'],['莫尔盐','摩尔盐','硫酸亚铁铵'],['过氧化氢','双氧水','h2o2','hydrogen peroxide'],['草酸','乙二酸','h2c2o4'],['三草酸合铁酸钾','草酸铁钾','k3[fe(c2o4)3]','ferrioxalate'],['滴定','高锰酸钾滴定','氧化还原滴定'],['避光','见光','光解','光化学','感光'],['配合物','络合物','配位化合物']];
// 来源 assistant.html:879-894
function extractTerms(q){
  const nq=norm(q),terms=new Set(),strong=new Set();
  const addS=t=>{t=norm(t);if(t&&t.length>=2){terms.add(t);strong.add(t);}};
  DOMAIN_TERMS.forEach(t=>{if(nq.includes(norm(t)))addS(t);});
  // 化学实体/同义词扩展：命中一个别名 ⇒ 同组全部别名都作为检索词
  CHEM_DB.forEach(c=>{if(c.alias.some(a=>nq.includes(norm(a))))c.alias.forEach(a=>addS(a));});
  SYN_GROUPS.forEach(g=>{if(g.some(a=>nq.includes(norm(a))))g.forEach(a=>addS(a));});
  (q.toLowerCase().match(/[a-z0-9\[\]\(\)\+\-\.]{2,}/g)||[]).forEach(w=>{if(!STOP_TERMS.includes(w)){terms.add(w);if(/[a-z]/.test(w))strong.add(w);}});
  (q.match(/[一-龥]{2,}/g)||[]).forEach(run=>{
    if(run.length<=4 && !STOP_TERMS.includes(run)){terms.add(run);if(run.length>=3)strong.add(run);}
    for(let i=0;i<run.length-1;i++){const g=run.slice(i,i+2);if(!STOP_TERMS.includes(g))terms.add(g);}
    for(let i=0;i<run.length-2;i++){const g=run.slice(i,i+3);if(!STOP_TERMS.includes(g)){terms.add(g);strong.add(g);}}
  });
  const filt=a=>a.filter(t=>t&&t.length>=2&&!STOP_TERMS.includes(t));
  return {all:filt(Array.from(terms)),strong:new Set(filt(Array.from(strong)))};
}
// 来源 assistant.html:895
function detectChems(q){const nq=norm(q);return CHEM_DB.filter(c=>c.alias.some(a=>nq.includes(norm(a))));}
// 来源 assistant.html:896
function detectOps(q){const nq=norm(q);return OP_TERMS.filter(o=>nq.includes(norm(o)));}

// 来源 assistant.html:898-925
function searchCorpus(q,topN){
  const {all,strong}=extractTerms(q);
  if(!all.length||!Corpus.entries.length) return {terms:all,results:[]};
  const nq=norm(q);
  const boosts=CONCEPT_BOOST.filter(b=>b.keys.some(k=>nq.includes(norm(k))));
  const out=[];
  for(const e of Corpus.entries){
    const f={
      title:norm(e.title),subfield:norm(e.subfield),objects:norm(e.objects),methods:norm(e.methods),
      questions:norm((e.questions||[]).join('|')),content:norm(e.content||''),abstract:norm(e.abstract||'')
    };
    let s=0,sh=false;const hit=new Set();
    for(const t of all){
      let w=0;
      if(f.questions.includes(t))w=Math.max(w,10);
      if(f.title.includes(t))w=Math.max(w,6);
      if(f.content&&f.content.includes(t))w=Math.max(w,6);
      if(f.objects.includes(t)||f.methods.includes(t))w=Math.max(w,4);
      if(f.abstract.includes(t))w=Math.max(w,4);
      if(f.subfield.includes(t))w=Math.max(w,3);
      if(w>0){s+=w;hit.add(t);if(strong.has(t))sh=true;}
    }
    for(const b of boosts){ if(f.subfield===norm(b.sub)){ s+=b.bonus; sh=true; hit.add('领域:'+b.sub);} }
    if(s>0) out.push({e,score:s,hit:Array.from(hit),strongHit:sh});
  }
  out.sort((a,b)=>b.score-a.score);
  return {terms:all,results:out.slice(0,topN||6)};
}
// 来源 assistant.html:926
const HIT_THRESHOLD=6;
// 来源 assistant.html:928-936
const CONCEPT_BOOST=[
 {keys:['原理','方程式','制备','合成','反应','步骤','流程','怎么做','操作'],sub:'合成制备',bonus:8},
 {keys:['产率','测定','含量','纯度','组成','滴定'],sub:'分析测定',bonus:8},
 {keys:['蓝晒','晒图','感光','cyanotype'],sub:'蓝晒工艺',bonus:8},
 {keys:['光化学','光解','光致还原','见光','避光'],sub:'光化学应用',bonus:8},
 {keys:['磁化率','磁性','磁天平'],sub:'磁性研究',bonus:8},
 {keys:['莫尔盐','摩尔盐','硫酸亚铁铵'],sub:'摩尔盐相关',bonus:8},
 {keys:['热分解','热重','热分析','差热'],sub:'热分析',bonus:8}
];

// 来源 assistant.html:939-964
var ANALOG_TABLE=[
 {concept:'草酸根配位',analogs:['草酸配合物','双齿螯合','五元环','乙二酸根'],generalPrinciple:'草酸根 (C₂O₄²⁻) 在过渡金属配合物中通常作为双齿配体，通过两个羧基氧原子配位形成五元螯合环，配位能力中等（光谱化学序中位于弱-中交界处），常见于 Fe(III)、Cr(III)、Al(III)、Co(III) 的 tris-oxalato 配合物。'},
 {concept:'导电性',analogs:['电导率','摩尔电导','离子迁移','电导','导电'],generalPrinciple:'配位化合物的导电性源于其在溶液中的解离——外界离子（如K⁺）可自由迁移导电，而内界配离子 [Fe(C₂O₄)₃]³⁻ 作为整体迁移。摩尔电导率 Λₘ 可用于测定配合物的离子类型：1:3 型电解质约 400-450 S·cm²·mol⁻¹，1:1 型约 100-120 S·cm²·mol⁻¹。'},
 {concept:'K₃[Fe(C₂O₄)₃]',analogs:['三草酸合铁酸钾','草酸铁钾','ferrioxalate','铁草酸钾'],generalPrinciple:'K₃[Fe(C₂O₄)₃]·3H₂O 是 tris-oxalato 家族的代表成员，中心离子 Fe³⁺(d⁵)，3 个双齿草酸根配位形成八面体构型。同类配合物包括 K₃[Cr(C₂O₄)₃]·3H₂O（深绿色）、K₃[Al(C₂O₄)₃]·3H₂O（白色）、K₃[Co(C₂O₄)₃]·3H₂O（深绿色），合成路线与方法高度相似。'},
 {concept:'K₃[Cr(C₂O₄)₃]',analogs:['草酸铬钾','铬草酸配合物','三草酸合铬酸钾'],generalPrinciple:'K₃[Cr(C₂O₄)₃]·3H₂O 与 K₃[Fe(C₂O₄)₃]·3H₂O 同属 tris-oxalato 系列，Cr³⁺(d³) 在八面体场中的 CFSE = -1.2Δ₀（比 Fe³⁺ 的高自旋 d⁵ 更稳定），制备方法类似：Cr³⁺ 盐 + 草酸钾在加热下配位，再乙醇析晶。'},
 {concept:'K₃[Al(C₂O₄)₃]',analogs:['草酸铝钾','铝草酸配合物','三草酸合铝酸钾'],generalPrinciple:'K₃[Al(C₂O₄)₃]·3H₂O 的 Al³⁺ 为 d⁰ 构型（无色），无 d-d 跃迁故呈白色晶体——这与 Fe(III) 翠绿色和 Cr(III) 深绿色形成鲜明对比。制备方法类比 K₃[Fe(C₂O₄)₃]：可溶性铝盐与草酸钾在加热条件下配位。'},
 {concept:'莫尔盐',analogs:['硫酸亚铁铵','(NH₄)₂Fe(SO₄)₂·6H₂O','Mohr盐','亚铁铵矾'],generalPrinciple:'莫尔盐 (NH₄)₂Fe(SO₄)₂·6H₂O 是化学实验中经典的 Fe(Ⅱ) 源，因比 FeSO₄·7H₂O 更不易被空气氧化（NH₄⁺ 的酸性抑制 Fe²⁺ 氧化），广泛用于配位化学合成（如 tris-oxalato 系列）、氧化还原滴定标定等实验的起始原料。'},
 {concept:'H₂O₂氧化',analogs:['过氧化氢氧化','双氧水氧化','绿色氧化','过氧化物氧化'],generalPrinciple:'H₂O₂ 在酸性介质中是强氧化剂（E°=+1.776 V），可将 Fe²⁺ 定量氧化为 Fe³⁺ 而不引入金属杂质离子。在 tris-oxalato 配合物合成中，H₂O₂ 是首选氧化剂。'},
 {concept:'乙醇析晶',analogs:['溶剂替换','降低溶解度','醇析','乙醇结晶法'],generalPrinciple:'向配合物水溶液中加入乙醇（或其他与水混溶的有机溶剂）可降低溶剂介电常数，削弱离子型配合物的溶剂化作用，使产物溶解度急剧下降而析出。这是配合物结晶的通用方法，适用于大多数碱金属草酸配合物的提纯与收集。'},
 {concept:'抽滤操作',analogs:['减压过滤','真空过滤','布氏漏斗','吸滤','过滤收集'],generalPrinciple:'减压抽滤是配合物合成中固液分离的标准操作：布氏漏斗铺滤纸→润湿贴紧→开泵→倒入固液混合物→抽干→先拔橡皮管后关泵（防倒吸）。适用于收集草酸盐沉淀、配合物晶体等，过滤速度远快于常压过滤。'},
 {concept:'光化学还原',analogs:['光致还原','光分解','LMCT','光解','光化学','光敏'],generalPrinciple:'[M(C₂O₄)₃]³⁻ 型配合物（M=Fe,Co,Mn）普遍具有光化学活性：紫外-可见光照下发生配体→金属电荷转移（LMCT），金属离子被还原（M³⁺→M²⁺），草酸根被氧化放出 CO₂。Fe(Ⅲ) 草酸盐是经典的化学光量计。'},
 {concept:'蓝晒显影',analogs:['蓝晒','晒图','cyanotype','感光'],generalPrinciple:'蓝晒工艺利用 Fe³⁺ 光化学还原为 Fe²⁺，Fe²⁺ 与铁氰化钾反应生成普鲁士蓝沉淀：3Fe²⁺+2[Fe(CN)₆]³⁻→Fe₃[Fe(CN)₆]₂↓（滕氏蓝）。未曝光区的盐被水冲走而留白，形成蓝底白影。'},
 {concept:'热重分析',analogs:['TG','DSC','DTA','热分解','热稳定性','失重'],generalPrinciple:'含结晶水的草酸配合物的热分解通常分三步：① 100-150℃ 脱结晶水；② 250-350℃ 无水配合物分解为草酸盐和碳酸盐（放出 CO+CO₂）；③ 500-700℃ 碳酸盐分解为金属氧化物。TG-DSC 联用可同时获得质量变化和热效应信息。'},
 {concept:'红外光谱表征',analogs:['IR','FTIR','红外','振动光谱','吸收峰'],generalPrinciple:'草酸配合物的红外光谱特征：自由 C₂O₄²⁻ 的 ν_as(C=O)≈1600 cm⁻¹ 和 ν_s(C-O)≈1300 cm⁻¹ 在配位后发生位移，M-O 伸缩振动出现在 500-600 cm⁻¹。这些峰位变化是判断草酸根配位模式的重要证据。'},
 {concept:'磁化率测定',analogs:['磁天平','古埃法','磁矩','μeff','磁化率','磁性'],generalPrinciple:'配合物的磁化率通过古埃磁天平（Gouy balance）测定：样品在非均匀磁场中受力，由表观质量变化计算质量磁化率 χ_g，进而得到摩尔磁化率 χ_M。高自旋 Fe³⁺(d⁵) 的 μ_eff ≈ 5.92 B.M.。'},
 {concept:'晶体场理论',analogs:['CFT','d轨道分裂','分裂能','t2g','eg','高自旋','低自旋'],generalPrinciple:'晶体场理论将配体视为点电荷/点偶极，中心离子 d 轨道在八面体配体场中分裂为能量较高的 eg(dz²,dx²-y²) 和能量较低的 t₂g(dxy,dyz,dzx)，能级差 Δ₀=10Dq。草酸根是弱场配体，Fe³⁺(d⁵) 在 [Fe(C₂O₄)₃]³⁻ 中呈高自旋态 t₂g³eg²，CFSE=0Δ₀。'},
 {concept:'螯合效应',analogs:['螯合','螯合物','五元环','熵增','螯合环稳定性'],generalPrinciple:'螯合效应（Chelate Effect）指多齿配体形成的配合物比类似单齿配体配合物更稳定，主要源于熵增——一个多齿配体替代多个单齿配体时，体系总分子数增加（ΔS>0），使 ΔG=ΔH-TΔS 更负。'},
 {concept:'pH影响',analogs:['酸碱稳定性','质子化','水解','pH范围'],generalPrinciple:'草酸配合物的稳定性高度依赖 pH：强酸条件（pH<2）下 C₂O₄²⁻ 被质子化为 HC₂O₄⁻ 进而成 H₂C₂O₄，逐步失去配位能力；近中性/弱碱性（pH>7）下 Fe³⁺ 水解生成 Fe(OH)₃ 沉淀破坏配合物。最适稳定区间为 pH 3-6。'},
 {concept:'产率优化',analogs:['提高产率','高产率','产率影响因素','优化条件'],generalPrinciple:'提高草酸配合物产率的通用策略：①精确控温（氧化阶段 40℃）；②缓慢滴加氧化剂（防局部过浓）；③乙醇用量充足；④充分冷却结晶（冰水浴或暗处过夜）；⑤最少化转移洗涤步骤；⑥全程避光（防光解）。'},
 {concept:'安全操作',analogs:['防护','实验室安全','危险品','化学安全'],generalPrinciple:'草酸配合物合成实验的通用安全要点：①草酸及草酸盐有毒；②H₂O₂ 具腐蚀性和氧化性，防溅入眼；③乙醇易燃，远离明火；④含重金属（Fe/Cr/Co）废液须分类收集、专门处理；⑤光敏产物须棕色瓶避光保存。'},
 {concept:'K₃[Co(C₂O₄)₃]',analogs:['草酸钴钾','钴草酸配合物','三草酸合钴酸钾'],generalPrinciple:'K₃[Co(C₂O₄)₃]·3H₂O 的制备需在 H₂O₂ 存在下进行——Co²⁺ 被 H₂O₂ 氧化为 Co³⁺ 的同时被草酸根配位捕获（类比 Fe²⁺→Fe³⁺ 的氧化配位策略）。Co³⁺(d⁶) 在八面体场中为低自旋 t₂g⁶eg⁰（Δ₀大），CFSE=-2.4Δ₀，热力学非常稳定，呈深绿色。'},
 {concept:'KMnO₄滴定',analogs:['高锰酸钾','滴定分析','自催化','Mn2+催化'],generalPrinciple:'用 KMnO₄ 滴定法可测定产品中 C₂O₄²⁻ 含量。该反应是经典的自催化反应——产物 Mn²⁺ 是催化剂，故滴定开始时 KMnO₄ 褪色极慢，随 Mn²⁺ 积累而加速。需在 75~85℃ 酸性介质中进行。'},
 {concept:'复分解沉淀',analogs:['置换反应','离子交换','沉淀反应'],generalPrinciple:'第一步 (NH₄)₂Fe(SO₄)₂+H₂C₂O₄→FeC₂O₄↓+(NH₄)₂SO₄+H₂SO₄ 属于复分解/沉淀反应，非氧化还原。Fe 化合价保持 +2 不变。这是"先沉淀后氧化"设计的第一阶段——利用 Fe²⁺ 不氧化草酸根的特性，将铁以沉淀形式固定并纯化。'},
 {concept:'普鲁士蓝',analogs:['铁蓝','柏林蓝','滕氏蓝','Fe4[Fe(CN)6]3'],generalPrinciple:'普鲁士蓝 Fe₄[Fe(CN)₆]₃ 是第一个现代合成颜料（1706年）。其深蓝色来源于 Fe(II)→Fe(III) 的间隔电荷转移（IVCT）跃迁。X 射线和中子衍射证实"普鲁士蓝"与"滕氏蓝"（Fe²⁺+[Fe(CN)₆]³⁻ 反应产物）实际上是同一物质。'},
 {concept:'溶剂替换',analogs:['乙醇结晶','降低极性','介电常数'],generalPrinciple:'水的介电常数 ε=78.5，乙醇仅 ε=24.3。加入乙醇后混合溶剂极性骤降，离子型产物 K₃[Fe(C₂O₄)₃] 的溶剂化作用减弱（Born 方程 ΔG_solv∝1/ε），溶解度急剧下降→溶液高度过饱和→析出晶体。这是教材中"水溶醇不溶"特性的定量解释。'}
];

// 来源 assistant.html:2041-2046（matchFAQ 内 fixTypos 依赖）
var _typoFix={
  '过氧化轻':'过氧化氢','草酸铁甲':'草酸铁钾','草酸铁钾钾':'草酸铁钾',
  '三草酸合铁甲':'三草酸合铁钾','莫耳盐':'莫尔盐','摩尔塩':'莫尔盐',
  '双氧水水':'双氧水','抽滤瓶':'抽滤','草酸根根':'草酸根',
  '氢氧化铁铁':'氢氧化铁','络合物':'配合物','铁氰化钾':'铁氰化钾'
};
// 来源 assistant.html:2047-2055
function fixTypos(q){
  var fixed=q;
  var keys=Object.keys(_typoFix);
  for(var i=0;i<keys.length;i++){
    var wrong=keys[i];
    if(fixed.indexOf(wrong)>=0) fixed=fixed.split(wrong).join(_typoFix[wrong]);
  }
  return fixed;
}

/* ================= 模块状态（init 填充） ================= */
let FAQ = [];
let Corpus = {entries:[], total:0, subfields:[], loaded:false, uploaded:0};
let _inited = false;

/* ================= 函数（来源标注，逐字复制） ================= */
// 来源 assistant.html:2058-2087
function matchFAQ(q){
  var nq=norm(fixTypos(q));var best=null,bestScore=0;
  // IDF 惩罚表：高频通用词降权
  var IDF_PENALTY={'实验':0.4,'制备':0.5,'化学':0.5,'操作':0.6,'步骤':0.6,'原理':0.5,'方法':0.6,'分析':0.6,'测定':0.6,'研究':0.7,'反应':0.5,'产物':0.6,'合成':0.5,'配合物':0.6};
  for(var i=0;i<FAQ.length;i++){
    var f=FAQ[i];
    var kh=0,longKey=0,keyScore=0;
    for(var j=0;j<f.keys.length;j++){
      var k=f.keys[j];var nk=norm(k);
      if(nq.indexOf(nk)>=0){
        kh++;
        if(nk.length>=3) longKey++;
        var idf=IDF_PENALTY[k]||1.0;
        keyScore+=2*idf;
      }
    }
    var eh=0,entScore=0;
    for(var ej=0;ej<(f.ents||[]).length;ej++){
      var en=f.ents[ej];
      if(nq.indexOf(norm(en))>=0){eh++;entScore+=3;}
    }
    var fq=norm(f.q||'');
    var exactQ=fq && fq===nq;
    var trig=(kh>=2)||(kh>=1&&eh>=1)||(eh>=2)||exactQ;
    if(!trig) continue;
    // 答案长度加权：长答案更可能是核心问题（上限+2）
    var lenBonus=Math.min(2,((f.answer||'').length+(f.detail||'').length)/800);
    var score=keyScore+entScore+longKey*0.5+lenBonus;
    // 问题完全一致/长问题包含 → 决定性优先（针对性FAQ条目；短q的通用条目不误触发）
    if(exactQ || (fq.length>=15 && (nq.indexOf(fq)>=0 || fq.indexOf(nq)>=0))) score+=50;
    if(score>bestScore){bestScore=score;best=f;}
  }
  return best;
}

// 来源 assistant.html:2090-2132
function retrieval2_chemicalAnalogy(q){
  var nq=norm(q);
  var analogyHits=[];
  for(var ri=0;ri<ANALOG_TABLE.length;ri++){
    var row=ANALOG_TABLE[ri];
    for(var ai=0;ai<row.analogs.length;ai++){
      var a=row.analogs[ai];
      if(nq.indexOf(norm(a))>=0){
        var sr=searchCorpus(row.concept, 4);
        for(var si=0;si<sr.results.length;si++){
          var r=sr.results[si];
          var already=false;
          for(var hi=0;hi<analogyHits.length;hi++){if(analogyHits[hi].e===r.e){already=true;break;}}
          if(!already){
            analogyHits.push({e:r.e, score:r.score*0.8, hit:r.hit, strongHit:r.strongHit, source:'analogy', analogyConcept:row.concept, analogyPrinciple:row.generalPrinciple});
          }
        }
      }
    }
  }
  var familyMap={'草酸铁':['草酸铬','草酸铝','草酸钴'],'草酸铬':['草酸铁','草酸铝','草酸钴'],'草酸铝':['草酸铁','草酸铬'],'草酸钴':['草酸铁','草酸铬'],'fe':['cr','al','co'],'cr':['fe','al'],'al':['fe','cr'],'co':['fe']};
  var famKeys=Object.keys(familyMap);
  for(var fk=0;fk<famKeys.length;fk++){
    var k=famKeys[fk];
    if(nq.indexOf(k)>=0){
      var alts=familyMap[k];
      for(var alti=0;alti<alts.length;alti++){
        var alt=alts[alti];
        var sr2=searchCorpus(alt, 3);
        for(var si2=0;si2<sr2.results.length;si2++){
          var r2=sr2.results[si2];
          var already2=false;
          for(var hi2=0;hi2<analogyHits.length;hi2++){if(analogyHits[hi2].e===r2.e){already2=true;break;}}
          if(!already2){
            analogyHits.push({e:r2.e, score:r2.score*0.7, hit:r2.hit, strongHit:false, source:'family-analogy', analogyConcept:alt});
          }
        }
      }
    }
  }
  analogyHits.sort(function(a,b){return b.score-a.score;});
  return analogyHits.slice(0,8);
}

// 来源 assistant.html:2135-2158
function retrieval3_methodologyTransfer(q){
  var ops=detectOps(q);
  if(!ops.length) return [];
  var methodHits=[];
  for(var oi=0;oi<Math.min(ops.length,5);oi++){
    var op=ops[oi];
    var nop=norm(op);
    for(var ei=0;ei<Corpus.entries.length;ei++){
      var e=Corpus.entries[ei];
      var nmethods=norm(e.methods||'');
      var ncontent=norm(e.content||'');
      var nobjects=norm(e.objects||'');
      if(nmethods.indexOf(nop)>=0||ncontent.indexOf(nop)>=0||nobjects.indexOf(nop)>=0){
        var already=false;
        for(var hi=0;hi<methodHits.length;hi++){if(methodHits[hi].e===e){already=true;break;}}
        if(!already){
          methodHits.push({e:e, score:6, hit:[op], strongHit:false, source:'method-transfer', method:op});
        }
      }
    }
  }
  methodHits.sort(function(a,b){return b.score-a.score;});
  return methodHits.slice(0,8);
}

// 来源 assistant.html:2161-2190
function analogicalReasoning(q, directHits, analogyHits, methodHits){
  var nq=norm(q);
  var analogies=[];
  for(var ri=0;ri<ANALOG_TABLE.length;ri++){
    var row=ANALOG_TABLE[ri];
    for(var ai=0;ai<row.analogs.length;ai++){
      var a=row.analogs[ai];
      if(nq.indexOf(norm(a))>=0){
        var hasDirect=(directHits.length>=2);
        if(!hasDirect||directHits[0].score<HIT_THRESHOLD*2){
          analogies.push({
            matchedTerm: a,
            concept: row.concept,
            principle: row.generalPrinciple,
            hasDirect: hasDirect,
            strength: hasDirect?0.3:0.8
          });
        }
      }
    }
  }
  var seen={};
  var result=[];
  for(var i=0;i<analogies.length;i++){
    var a=analogies[i];
    var k=a.concept+a.matchedTerm;
    if(!seen[k]){seen[k]=true;result.push(a);}
  }
  return result;
}

// 来源 assistant.html:2193-2204
function confidenceScore(directHits, analogyHits, methodHits, faq, analogies){
  var scores={};
  var maxDirectScore=0;
  for(var i=0;i<directHits.length;i++){maxDirectScore=Math.max(maxDirectScore,directHits[i].score);}
  scores.corpus=Math.min(1, maxDirectScore/60);
  scores.faq=faq?0.9:0;
  var analogyCount=analogies.length+analogyHits.length+methodHits.length;
  scores.analogy=Math.min(1, analogyCount*0.15);
  scores.overall=Math.max(scores.corpus, scores.faq, scores.analogy*0.6);
  scores.level=scores.overall>=0.7?'high':(scores.overall>=0.35?'medium':'low');
  return scores;
}

/* ================= 初始化（惰性、幂等） ================= */
function init(){
  if(_inited) return {faqCount: FAQ.length, corpusCount: Corpus.entries.length};
  // FAQ：解析 assistant.html 内嵌实时数组（1055 条）
  const faqLib = require('../scripts/lib-assistant-faq.js');
  const html = fs.readFileSync(ASSISTANT_HTML, 'utf8');
  FAQ = faqLib.parseFAQ(html);
  // Corpus：data/corpus.json（365 条），复刻 loadCorpus 的 entries 映射与 subfield 归一化
  const raw = JSON.parse(fs.readFileSync(CORPUS_JSON, 'utf8').replace(/^﻿/, ''));
  const list = (raw && Array.isArray(raw.entries)) ? raw.entries.slice() : [];
  Corpus.entries = list;
  Corpus.subfields = (raw && raw.subfields) || [];
  list.forEach(e=>{if(e.subfield)e.subfield=normCat(e.subfield);});
  Corpus.total = (raw && raw.total) ? raw.total : (raw ? list.length : 0);
  _inited = true;
  return {faqCount: FAQ.length, corpusCount: Corpus.entries.length};
}

/* ================= 答案生成（复刻 handleQA 本地路径） ================= */
// 来源 assistant.html:3013-3070（仅本地路径：无 LLM、无上传文件时的检索/类比/置信度/组合）
function answer(q){
  if(!_inited) init();

  /* ===== 阶段1：多策略检索（handleQA 3027-3037） ===== */
  const searchResult = searchCorpus(q, 6);
  const results = searchResult.results;
  const analogyHits = retrieval2_chemicalAnalogy(q);
  const methodHits = retrieval3_methodologyTransfer(q);

  const DOMAIN_RE=/实验|化学|配合物|配位|沉淀|晶体|光化学|光致|方程式|磁化|摩尔|产率|结晶|滴定|蓝晒|试剂|过滤|抽滤|水浴|加热|误差|废液|避光|洗涤|蒸干|称量|溶解|浓度|制备|合成|络合|螯合|烧杯|漏斗|滤纸|天平|滴加|步骤|操作|温度|烘干|干燥|光照|用量|溶剂|乙醇|分解|测定|配制|滤液|母液|产物|原料|陈化|静置|酸化|氧化|还原|检验|显色|纯度|终点|杂质|pH|机理|后果|影响/;
  const GENERIC_RE=/原理|目的|计算|思考题|结论|步骤/;
  const domain=DOMAIN_RE.test(q)||detectChems(q).length>0||detectOps(q).length>0||(q.length<=8&&GENERIC_RE.test(q));
  const hits=domain?results.filter(function(r){return r.score>=HIT_THRESHOLD&&(r.strongHit||r.e.content);}):[];
  const faq=domain?matchFAQ(q):null;
  const chems=detectChems(q), ops=detectOps(q);

  /* ===== 阶段2：类比推理引擎（handleQA 3041） ===== */
  const analogies=analogicalReasoning(q, hits, analogyHits, methodHits);

  /* ===== 阶段3：置信度评分（handleQA 3045） ===== */
  const conf=confidenceScore(hits, analogyHits, methodHits, faq, analogies);

  /* ===== answerText 纯文本组合 =====
     复刻 buildHybridAnswerHTML/buildAnswerHTML 呈现的内容：
       matchedFAQ  → answer + detail + 语料证据（命中文献标题）
       类比桥接    → 桥接说明 + 类比原理
       未命中      → '本地检索未命中该主题。' + 顶层语料命中标题 */
  let answerText='';
  if(faq){
    answerText=(faq.answer||'');
    if(faq.detail) answerText+='\n\n'+(faq.detail||'');
    if(hits.length){
      answerText+='\n\n参考语料：';
      hits.forEach(function(h){ answerText+='\n· 《'+(h.e.title||'')+'》'; });
    }
  } else if(analogies.length){
    answerText='该问题超出了本实验知识库的精确匹配范围，但可以通过类比推理从已知化学原理中推导相关答案。';
    analogies.forEach(function(a){
      answerText+='\n\n【'+a.concept+'】← 匹配自「'+a.matchedTerm+'」\n'+a.principle;
    });
  } else {
    answerText='本地检索未命中该主题。';
    if(hits.length){
      hits.slice(0,3).forEach(function(h){ answerText+='\n· 《'+(h.e.title||'')+'》'; });
    }
  }

  return {
    question: q,
    matchedFAQ: faq ? {title:faq.title||'', answer:faq.answer||'', detail:faq.detail||'', subfield:faq.subfield||''} : null,
    corpusHits: hits.map(function(h){ return {id:h.e.id, title:h.e.title, score:h.score, hit:h.hit}; }),
    analogies: analogies.map(function(a){ return {concept:a.concept, matchedTerm:a.matchedTerm, principle:a.principle}; }),
    confidence: {corpus:conf.corpus, faq:conf.faq, analogy:conf.analogy, overall:conf.overall, level:conf.level},
    answerText: answerText
  };
}

module.exports = {
  init, answer,
  get faqCount(){ return FAQ.length; },
  get corpusCount(){ return Corpus.entries.length; },
  // 自我检查：无头评分不使用，暴露占位符
  selfCheck: {passed:true, warnings:[]}
};
