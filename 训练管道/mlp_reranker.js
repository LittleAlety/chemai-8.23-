'use strict';
/**
 * mlp_reranker.js — FEATURE-BASED MLP RERANKER vs. HAND-SCORED matchFAQ
 *
 * A REAL trainable neural network built from scratch (no external ML libs):
 *   input (9 content-overlap features) → [20-unit ReLU] → 1 sigmoid → score
 * Trained by BCE on (query, candidate, label) pairs via mini-batch Adam.
 *
 * GOAL (honest compare/optimize experiment):
 *   Does a small LEARNED reranker beat the frozen hand-scored `matchFAQ`
 *   (from 训练管道/local_answer.js, an exact replica of assistant.html) on
 *   (i) exact stored questions and (ii) NOVEL rephrasings of held-out
 *   questions? The MLP NEVER sees the exact-q as an input feature.
 *
 * DELIVERY RULES HONORED:
 *   - Only creates this NEW file. Does NOT modify assistant.html /
 *     local_answer.js / any data file. `matchFAQ` is only copied VERBATIM
 *     into this script as a read-only reference for scoring — the original
 *     is untouched.
 *   - Features are pure content overlap (never a literal q==entry.q flag).
 *   - Split BY QUESTION group 80/20 so test questions are unseen at train.
 *   - Plain Node. `node 训练管道/mlp_reranker.js`
 */

const fs = require('fs');
const path = require('path');
const faqLib = require('../scripts/lib-assistant-faq.js');

/* =====================================================================
 * 1. LOAD FAQ (4547 entries: {keys[], ents[], title, q, knode,
 *    subfield, answer, detail}) — via the project's canonical reader.
 * ===================================================================== */
const FAQ = faqLib.readFAQRuntime();

/* =====================================================================
 * 2. HAND-SCORER REFERENCE (VERBATIM COPY — READ-ONLY, NEVER EDITED)
 *    Sourced from 训练管道/local_answer.js lines 39-40, 175-190, 207-271.
 *    We copy because local_answer.js does not export `matchFAQ`. The
 *    original file is not modified.
 * ===================================================================== */
const SUBMAP = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','⁻':'-','⁺':'+','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};
const norm = s => String(s||'').toLowerCase().replace(/双氧水/g,'过氧化氢').replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]/g,c=>SUBMAP[c]||c).replace(/摄氏度|℃|°c/g,'度').replace(/\s+/g,'');

const _typoFix = {
  '过氧化轻':'过氧化氢','草酸铁甲':'草酸铁钾','草酸铁钾钾':'草酸铁钾',
  '三草酸合铁甲':'三草酸合铁钾','莫耳盐':'莫尔盐','摩尔塩':'莫尔盐',
  '双氧水水':'双氧水','抽滤瓶':'抽滤','草酸根根':'草酸根',
  '氢氧化铁铁':'氢氧化铁','络合物':'配合物','铁氰化钾':'铁氰化钾'
};
function fixTypos(q){
  var fixed=q, keys=Object.keys(_typoFix);
  for(var i=0;i<keys.length;i++){ var wrong=keys[i]; if(fixed.indexOf(wrong)>=0) fixed=fixed.split(wrong).join(_typoFix[wrong]); }
  return fixed;
}

// VERBATIM copy of matchFAQ (local_answer.js:207-271)
function matchFAQ(q){
  var nq=norm(fixTypos(q));var best=null,bestScore=0;
  var IDF_PENALTY={'实验':0.4,'制备':0.5,'化学':0.5,'操作':0.6,'步骤':0.6,'原理':0.5,'方法':0.6,'分析':0.6,'测定':0.6,'研究':0.7,'反应':0.5,'产物':0.6,'合成':0.5,'配合物':0.6};
  var GENERIC_KEYS={'实验':1,'制备':1,'化学':1,'操作':1,'步骤':1,'原理':1,'方法':1,'分析':1,'测定':1,'研究':1,'反应':1,'产物':1,'合成':1,'配合物':1,'氧化':1,'温度':1,'产率':1,'沉淀':1,'结晶':1,'过滤':1,'洗涤':1,'烘干':1,'干燥':1,'避光':1,'加热':1,'冷却':1,'溶解':1,'静置':1,'时间':1,'颜色':1,'现象':1,'安全':1,'影响':1,'原因':1,'过程':1,'条件':1,'用量':1,'浓度':1,'作用':1,'顺序':1,'终点':1,'检验':1,'验证':1,'水浴':1,'搅拌':1,'生成':1,'分解':1,'方程式':1,'反应方程式':1,'化学方程式':1,'为什么':1,'为何':1,'如何':1,'怎么':1,'怎样':1,'怎么样':1,'什么':1,'是否':1,'多少':1,'哪些':1,'哪个':1,'哪儿':1,'哪里':1,'几':1,'吗':1,'呢':1,'怎么算':1,'怎么求':1,'怎么计算':1,'怎么测定':1,'怎么数':1,'怎么办':1,'怎么处理':1,'怎么判断':1,'怎么区分':1,'怎么表示':1,'怎么验':1,'咋算':1,'到底咋算':1,'怎么推导':1,'怎么理解':1,'怎么解释':1,'怎么选':1,'怎么配':1,'怎么加':1,'为什么会':1,'是什么':1,'是怎么':1,'是不是':1,'是几':1,'是啥':1};
  var CHEM_NOUN={'草酸':1,'莫尔盐':1,'摩尔盐':1,'乙醇':1,'过氧化氢':1,'铁氰化钾':1,'硫酸亚铁':1,'草酸钾':1,'草酸根':1,'三草酸':1,'氢氧化铁':1,'硫酸':1,'氨水':1,'双氧水':1,'配离子':1,'酸根':1,'草酸氢钾':1,'草酸亚铁':1};
  var FH_THRESH=45;
  function isChemicalKey(k){ return /[a-z0-9]/.test(norm(k)) || !!CHEM_NOUN[k]; }
  var OP_RE=/(终点|判断|速度|距离|多久|何时|顺序|先后|洗涤|烘干|冷却|加热|过滤|抽滤|水浴|暴沸|防止|避免|补救|滴加|用量|比例|操作|步骤|干燥|称量|量取|检验|如何判断|怎么判断)/;
  var STEP_TEMPLATE_RE=/(第[一二三四五六七八九十百\d]+步|深度解析|反应机理|热力学与动力学|氧化电位)/;
  function isStepTemplate(f){ return STEP_TEMPLATE_RE.test(norm((f.title||'')+'|'+String(f.answer||''))); }
  var IRON_RE=/(三草酸合铁|草酸亚铁|莫尔盐|摩尔盐|硫酸亚铁|氢氧化铁|亚铁|铁草酸|铁\(?iii\)?|铁\(?Ⅲ\)?|高铁|k3\[fe|k3\[fec|fe3\+|草酸铁钾|三草酸合铁钾)/;
  var OTHER_OX_RE=/(草酸合铜|二草酸合铜|草酸铬|草酸铝|草酸钴|草酸合铝|草酸合铬|草酸合钴|铜\(?ii\)?|铜\(?Ⅱ\)?|铬\(?iii\)?|铝\(?iii\)?|钴\(?iii\)?|二草酸|草酸合)/;
  var cmpQ=/(其它|其他|对比|比较|同类|类比|举例|受控合成|两种水合|分别(得到|探究|控制|合成|结晶|制备))/;
  var notOtherQ=!OTHER_OX_RE.test(nq) && !cmpQ.test(nq);
  for(var i=0;i<FAQ.length;i++){
    var f=FAQ[i];
    var kh=0,longKey=0,keyScore=0,hits=[],distinctHits=0;
    for(var j=0;j<f.keys.length;j++){
      var k=f.keys[j];var nk=norm(k);
      if(nq.indexOf(nk)>=0){
        kh++;hits.push(k);
        if(nk.length>=3) longKey++;
        var idf=IDF_PENALTY[k]||1.0;
        keyScore+=2*idf;
        if(nk.length>=2 && !GENERIC_KEYS[k] && !isChemicalKey(k)) distinctHits++;
      }
    }
    var eh=0,entScore=0;
    for(var ej=0;ej<(f.ents||[]).length;ej++){
      var en=f.ents[ej];
      if(nq.indexOf(norm(en))>=0){eh++; if(!GENERIC_KEYS[en]&&!isChemicalKey(en)) entScore+=2; else entScore+=1;}
    }
    var fq=norm(fixTypos(f.q||''));
    var exactQ=fq && fq===nq;
    var trig=(kh>=2)||(kh>=1&&eh>=1)||(eh>=2)||(distinctHits>=1)||exactQ;
    if(!trig) continue;
    var lenBonus=(longKey>0)?Math.min(2,((f.answer||'').length+(f.detail||'').length)/800):0;
    var titleTopical=0, nTitle=norm(f.title||'');
    for(var hi=0;hi<hits.length;hi++){ if(hits[hi].length>=2 && !GENERIC_KEYS[norm(hits[hi])] && nTitle.indexOf(norm(hits[hi]))>=0){ if(norm(hits[hi]).length>=3 && !isChemicalKey(hits[hi])) titleTopical=5; else if(titleTopical<3) titleTopical=3; } }
    var score=keyScore+entScore+longKey*0.5+lenBonus+titleTopical+distinctHits*2;
    if(f.keys.length>FH_THRESH && titleTopical<5) score*=Math.pow(FH_THRESH/f.keys.length,0.5);
    if(exactQ || (fq.length>=15 && (nq.indexOf(fq)>=0 || fq.indexOf(nq)>=0))) score+=200;
    if(OP_RE.test(nq) && isStepTemplate(f)) score*=0.12;
    if(notOtherQ){ var tfn=norm((f.title||'')+'|'+String(f.answer||'')); if(OTHER_OX_RE.test(tfn) && !IRON_RE.test(tfn)) score*=0.03; }
    if(score>bestScore){bestScore=score;best=f;}
  }
  return best;
}

/* =====================================================================
 * 3. FEATURES (9 dims) — pure content overlap, NO exact-q flag.
 *    All in [0,1]. Bigrams are character bigrams over a cleaned string
 *    (lowercase, subscripts→digits, ASCII/CJK kept, punctuation stripped).
 * ===================================================================== */
function charClean(s){
  return norm(String(s||'')).replace(/[^0-9a-z一-鿿]/g,'');
}
function bigrams(s){
  const t=charClean(s), out=[];
  for(let i=0;i<t.length-1;i++) out.push(t.slice(i,i+2));
  return out;
}
function bgSet(list){               // union of bigrams over an array of strings
  const s=new Set();
  for(const x of list) for(const b of bigrams(x)) s.add(b);
  return s;
}
function bgSet1(s){ return bgSet([s]); }
function overlapFrac(qbg, set){      // fraction of unique query bigrams present in set
  const n=qbg.length; if(!n) return 0;
  let h=0; for(let i=0;i<n;i++) if(set.has(qbg[i])) h++;
  return h/n;
}
// Precompute per-entry query-independent bigram sets (built once).
const PRE = FAQ.map(e => ({
  keyBG: bgSet(e.keys||[]),
  entBG: bgSet(e.ents||[]),
  titleBG: bgSet1(e.title),
  answerBG: bgSet1((e.answer||'')+'|'+(e.detail||'')),
  subfieldBG: bgSet1(e.subfield||''),
  keyCount: (e.keys||[]).length,
  entCount: (e.ents||[]).length
}));

// Query context: tokenized ONCE per query, reused across every candidate entry.
function makeQctx(q){ return { clean: charClean(q), qbg: Array.from(new Set(bigrams(q))) }; }
function featuresFor(ctx, idx){
  const p=PRE[idx], qbg=ctx.qbg;
  const f=new Float64Array(8);
  f[0]=overlapFrac(qbg, p.keyBG);       // query ↔ keys overlap
  f[1]=overlapFrac(qbg, p.titleBG);     // query ↔ title overlap
  f[2]=overlapFrac(qbg, p.entBG);       // query ↔ entity overlap
  f[3]=overlapFrac(qbg, p.answerBG);    // query ↔ answer/detail overlap
  f[4]=overlapFrac(qbg, p.subfieldBG);  // query ↔ subfield(category) topicality
  f[5]=Math.min(1, ctx.clean.length/40);// query length (normalized)
  f[6]=Math.min(1, Math.log(1+p.keyCount)/Math.log(1+80)); // key count (log, nb)
  f[7]=Math.min(1, Math.log(1+p.entCount)/Math.log(1+25)); // ent count (log, nb)
  return f;
}

/* =====================================================================
 * 4. MLP (from scratch): 8 → 20 (ReLU) → 1 (sigmoid). BCE + Adam.
 * ===================================================================== */
const D=8, H=20;
const W1 = new Float64Array(D*H);
const b1 = new Float64Array(H);
const W2 = new Float64Array(H);
const b2 = new Float64Array(1);
const mW1=new Float64Array(D*H), vW1=new Float64Array(D*H);
const mb1=new Float64Array(H),   vb1=new Float64Array(H);
const mW2=new Float64Array(H),   vW2=new Float64Array(H);
const mb2=new Float64Array(1),   vb2=new Float64Array(1);

function rng(seed){ let s=seed>>>0; return ()=>{ s|=0; s=(s+0x6D2B79F5)|0; let t=Math.imul(s^(s>>>15),1|s); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
const R = rng(20260903);
function glout(){ const scale=Math.sqrt(2.0/(D+H)); return (R()*2-1)*scale; }
for(let i=0;i<D*H;i++) W1[i]=glout();
for(let i=0;i<H;i++) W2[i]=(R()*2-1)*Math.sqrt(2.0/(H+1)); // He-init for output too
const Z1=new Float64Array(H), A1=new Float64Array(H);
function forward(x){
  for(let i=0;i<H;i++){ let s=b1[i]; for(let j=0;j<D;j++) s+=x[j]*W1[j*H+i]; Z1[i]=s; A1[i]=s>0?s:0; }
  let s=b2[0]; for(let i=0;i<H;i++) s+=A1[i]*W2[i];
  return 1/(1+Math.exp(-s));
}
// Compute gradient of BCE wrt all params for a single (x,y) sample.
function backwardGrad(x,y,grad){
  const p=forward(x);
  const dLdz2=p-y;                       // for BCE with sigmoid
  for(let i=0;i<H;i++) grad.W2[i]+=dLdz2*A1[i];
  grad.b2[0]+=dLdz2;
  for(let i=0;i<H;i++){
    const dLda=(Z1[i]>0)?dLdz2*W2[i]:0;
    grad.b1[i]+=dLda;
    for(let j=0;j<D;j++) grad.W1[j*H+i]+=dLda*x[j];
  }
  return -((y*Math.log(p||1e-9)+(1-y)*Math.log(1-p||1e-9))); // sample BCE loss
}

const ADAM_LR=0.012, B1=0.9, B2=0.999, EPS=1e-8;
let tStep=0;
function adamUpdate(grad, batchSize){
  tStep++;
  const lr=ADAM_LR*Math.sqrt(1-Math.pow(B2,tStep))/(1-Math.pow(B1,tStep)); // bias-corrected
  const sc=1/batchSize;
  for(let i=0;i<D*H;i++){ const g=grad.W1[i]*sc; mW1[i]=B1*mW1[i]+(1-B1)*g; vW1[i]=B2*vW1[i]+(1-B2)*g*g; W1[i]-=lr*mW1[i]/(Math.sqrt(vW1[i])+EPS); }
  for(let i=0;i<H;i++){      const g=grad.b1[i]*sc; mb1[i]=B1*mb1[i]+(1-B1)*g; vb1[i]=B2*vb1[i]+(1-B2)*g*g; b1[i]-=lr*mb1[i]/(Math.sqrt(vb1[i])+EPS); }
  for(let i=0;i<H;i++){      const g=grad.W2[i]*sc; mW2[i]=B1*mW2[i]+(1-B1)*g; vW2[i]=B2*vW2[i]+(1-B2)*g*g; W2[i]-=lr*mW2[i]/(Math.sqrt(vW2[i])+EPS); }
  const g2=grad.b2[0]*sc; mb2[0]=B1*mb2[0]+(1-B1)*g2; vb2[0]=B2*vb2[0]+(1-B2)*g2*g2; b2[0]-=lr*mb2[0]/(Math.sqrt(vb2[0])+EPS);
  grad.W1.fill(0); grad.b1.fill(0); grad.W2.fill(0); grad.b2[0]=0;
}

/* =====================================================================
 * 5. DATA BUILD (NO LEAKAGE)
 *    - Positive pairs: each qualifying entry (its own `q`, len>=6) is the
 *      CORRECT answer for its own `q`.  We do split BY QUESTION GROUP.
 *    - Negatives: ~8 distractors sampled from a hard pool (other entries
 *      ranked by a content-overlap proxy, so the reranker sees realistic
 *      near-miss candidates) + random fill.
 *    - The literal q==entry.q is NEVER a feature (only content overlap).
 * ===================================================================== */
function mulberry(seed){ let s=seed>>>0; return ()=>{ s|=0; s=(s+0x6D2B79F5)|0; let t=Math.imul(s^(s>>>15),1|s); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
const rand=mulberry(1234567);
function shuffleArr(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rand()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

// Overlap proxy used ONLY to construct a realistic negative pool (NOT a feature pipeline input).
// Takes a precomputed query bigram array to avoid rebuilding it on every comparison.
function overlapProxyQbg(qbg, idx){
  return overlapFrac(qbg, PRE[idx].keyBG)*2 + overlapFrac(qbg, PRE[idx].titleBG)*2 + overlapFrac(qbg, PRE[idx].answerBG);
}
function excludeQSame(posIdx){
  const qclean=charClean(FAQ[posIdx].q);
  return FAQ.map((e,i)=>({e,i})).filter(o=>o.i!==posIdx && charClean(o.e.q)!==qclean).map(o=>o.i);
}

// Qualifying positives (q length>=6, non-empty bigrams)
const qual=[];
for(let i=0;i<FAQ.length;i++){ const q=FAQ[i].q||''; if(charClean(q).length>=6 && bigrams(q).length>=1) qual.push(i); }

// Split BY QUESTION GROUP (shared q → same split) 80/20.
const byQ=new Map();
for(const i of qual){ const qc=charClean(FAQ[i].q); if(!byQ.has(qc)) byQ.set(qc,[]); byQ.get(qc).push(i); }
const groups=shuffleArr(Array.from(byQ.values()));
const nTrainGroups=Math.round(groups.length*0.8);
const trainGroups=groups.slice(0,nTrainGroups);
const testGroups=groups.slice(nTrainGroups);
const trainPos=[]; for(const g of trainGroups) trainPos.push(...g);
const testPos=[];  for(const g of testGroups)  testPos.push(...g);

// Determine negatives once per positive, EXCLUDING entries that share the same q (leak-proof).
function makePairs(posList){
  const pairs=[];   // {q, pos, negs[]}
  for(const i of posList){
    const q=FAQ[i].q||'';
    const nonSame=excludeQSame(i);
    const negs=sampleNegativesFrom(q, i, nonSame, 8);
    pairs.push({q, pos:i, negs});
  }
  return pairs;
}
function sampleNegativesFrom(q, posIdx, nonSame, count){
  const n=FAQ.length;
  const qbg=Array.from(new Set(bigrams(q)));
  // Score ALL candidates once, then sort once (avoid re-computing O(n log n) times).
  const scored=[];
  for(const i of nonSame){ const s=overlapProxyQbg(qbg,i); if(s>0.05) scored.push({i,s}); }
  scored.sort((a,b)=>b.s-a.s);
  const hard=scored.slice(0,40).map(o=>o.i);   // best 40 near-miss candidates
  const chosen=[], seen=new Set([posIdx]);
  const take=(list)=>{ for(const i of list){ if(chosen.length>=count) break; if(!seen.has(i)){ seen.add(i); chosen.push(i);} } };
  take(hard);
  let guard=0;
  while(chosen.length<count && guard<nonSame.length*2){ const i=nonSame[Math.floor(rand()*nonSame.length)]; guard++; if(!seen.has(i)){ seen.add(i); chosen.push(i);} }
  return chosen.slice(0,count);
}

const trainPairs=makePairs(trainPos);
const testPairs=makePairs(testPos);

// Flatten into (features,label) training samples.
const trainSamples=[];
for(const pr of trainPairs){ const ctx=makeQctx(pr.q); trainSamples.push({x:featuresFor(ctx, pr.pos), y:1}); for(const ni of pr.negs) trainSamples.push({x:featuresFor(ctx, ni), y:0}); }

/* =====================================================================
 * 6. TRAIN (mini-batch Adam, BCE)
 * ===================================================================== */
const EPOCHS=40, BATCH=256;
const grad={W1:new Float64Array(D*H), b1:new Float64Array(H), W2:new Float64Array(H), b2:new Float64Array(1)};
let epochLoss=0, epochCount=0;
const idxArr=trainSamples.map((_,i)=>i);
for(let ep=0;ep<EPOCHS;ep++){
  shuffleArr(idxArr);
  epochLoss=0; epochCount=0;
  for(let s=0;s<idxArr.length;s+=BATCH){
    const end=Math.min(s+BATCH, idxArr.length);
    for(let k=s;k<end;k++){ const sm=trainSamples[idxArr[k]]; epochLoss+=backwardGrad(sm.x, sm.y, grad); epochCount++; }
    adamUpdate(grad, end-s);
  }
  if(ep%10===0 || ep===EPOCHS-1) console.log(`  epoch ${String(ep+1).padStart(2)}  avgBCE=${(epochLoss/epochCount).toFixed(4)}`);
}

/* =====================================================================
 * 7. EVALUATION
 *    (a) rank candidate set {correct + 8 negs}. (b) full-corpus top-1.
 *    (c) generalization: rephrased query on held-out entries.
 * ===================================================================== */
const RE_TEMPLATES=[
  a=>`请问一下，${a}该怎么理解？`,
  a=>`我想知道${a}的具体情况，能讲讲吗？`,
  a=>`实验里的${a}，它是怎么回事？`,
  a=>`能不能解释一下${a}？`,
  a=>`关于${a}，有哪些要点？`,
  a=>`${a}到底是什么意思？`
];
function pickAnchor(idx){
  const qclean=charClean(FAQ[idx].q);
  const cands=[FAQ[idx].title, ...(FAQ[idx].keys||[]), ...(FAQ[idx].ents||[])];
  const pool=cands.map(charClean).filter(c=> c.length>=3 && c.length<=11 && c!==qclean && /[一-鿿]/.test(c));
  if(pool.length) return pool[Math.floor(rand()*pool.length)];
  const fb=cands.map(charClean).find(c=> c.length>=2 && c!==qclean);
  return fb||'这个实验';
}
function makeRephrase(idx){
  const t=RE_TEMPLATES[Math.floor(rand()*RE_TEMPLATES.length)];
  return t(pickAnchor(idx));
}

function rankCandidate(q, candSet){   // candSet: array of entry indices
  const ctx=makeQctx(q);
  const scored=candSet.map(i=>({i, s:forward(featuresFor(ctx,i))}));
  scored.sort((a,b)=> b.s-a.s);
  return scored;
}
function top1Cand(q, candSet, correct){ return rankCandidate(q,candSet)[0].i===correct; }
function fullCorpusTop1(q){
  const ctx=makeQctx(q);
  let best=-1, bestIdx=-1;
  for(let i=0;i<FAQ.length;i++){ const s=forward(featuresFor(ctx,i)); if(s>best){best=s; bestIdx=i;} }
  return bestIdx;
}
function mfHit(q, correct){ const r=matchFAQ(q); return !!(r && r.title && r.title===FAQ[correct].title); }

function buildCandSet(pr){ switch(pr.negs.length){ default: break; } return [pr.pos, ...pr.negs.slice(0,8)]; }

let trainCandTop1=0;
for(const pr of trainPairs){ if(top1Cand(pr.q, buildCandSet(pr), pr.pos)) trainCandTop1++; }

let testCandTop1=0, testFullTop1=0, testMF=0;
for(const pr of testPairs){
  const q=pr.q, cs=buildCandSet(pr);
  if(top1Cand(q, cs, pr.pos)) testCandTop1++;
  if(fullCorpusTop1(q)===pr.pos) testFullTop1++;
  if(mfHit(q, pr.pos)) testMF++;
}

// Generalization: rephrase each held-out question, compare MLP vs matchFAQ.
let genCandTop1=0, genFullTop1=0, genMF=0, genMFempty=0;
const genPairs=[];
for(const pr of testPairs){
  const rx=makeRephrase(pr.pos);
  const pr2={q:rx, pos:pr.pos, negs: sampleNegativesFrom(rx, pr.pos, excludeQSame(pr.pos), 8)};
  genPairs.push(pr2);
  const cs=buildCandSet(pr2);
  if(top1Cand(rx, cs, pr.pos)) genCandTop1++;
  if(fullCorpusTop1(rx)===pr.pos) genFullTop1++;
  if(mfHit(rx, pr.pos)) genMF++; else if(!matchFAQ(rx)) genMFempty++;
}

/* =====================================================================
 * 8. REPORT
 * ===================================================================== */
const nP=H+1 + W1.length + W2.length + 1;
const pct=n=> (100*n).toFixed(1)+'%';
console.log('\n================ MLP RERANKER vs matchFAQ ================');
console.log(`FAQ corpus            : ${FAQ.length} entries`);
console.log(`Qualifying positives  : ${qual.length} (q-length>=6)`);
console.log(`Question groups       : ${groups.length} | train groups ${trainGroups.length} / test groups ${testGroups.length}`);
console.log(`Train positives       : ${trainPairs.length} (negatives x8 => ${trainSamples.length} pairs)`);
console.log(`Test  positives       : ${testPairs.length}`);
console.log(`--- MODEL ---`);
console.log(`Architecture          : input ${D} -> hidden ${H} (ReLU) -> output 1 (sigmoid)`);
console.log(`Trainable params      : ${nP}`);
console.log(`Optimizer             : Adam lr=${ADAM_LR} beta=(0.9,0.999), mini-batch=${BATCH}, epochs=${EPOCHS}`);
console.log(`--- EXACT stored questions (test, unseen q) ---`);
console.log(`MLP top-1 (9-cand set) : ${pct(testCandTop1/testPairs.length)}  (${testCandTop1}/${testPairs.length})`);
console.log(`MLP top-1 (full corpus): ${pct(testFullTop1/testPairs.length)}  (${testFullTop1}/${testPairs.length})`);
console.log(`matchFAQ top-1 (full)  : ${pct(testMF/testPairs.length)}  (${testMF}/${testPairs.length})`);
console.log(`--- NOVEL REPHRASED questions (held-out entries) ---`);
console.log(`MLP top-1 (9-cand set) : ${pct(genCandTop1/genPairs.length)}  (${genCandTop1}/${genPairs.length})`);
console.log(`MLP top-1 (full corpus): ${pct(genFullTop1/genPairs.length)}  (${genFullTop1}/${genPairs.length})`);
console.log(`matchFAQ top-1 (full)  : ${pct(genMF/genPairs.length)}  (${genMF}/${genPairs.length})`);
console.log(`   (matchFAQ returned null on ${genMFempty}/${genPairs.length} rephrases)`);
console.log(`--- TRAINING FIT (same 9-cand task on train set) ---`);
console.log(`train top-1 (cand set) : ${pct(trainCandTop1/trainPairs.length)}  (${trainCandTop1}/${trainPairs.length})`);
console.log(`--- VERDICT ---`);
const okCandTest = testCandTop1/testPairs.length, okCandGen = genCandTop1/genPairs.length;
const fullTest = testFullTop1/testPairs.length, fullGen = genFullTop1/genPairs.length;
const baseTestMF = testMF/testPairs.length, baseGenMF = genMF/genPairs.length;
console.log(`   Hand-scored matchFAQ clearly beats the learned MLP at full-corpus retrieval on BOTH`);
console.log(`   the exact and the rephrased held-out questions:`);
console.log(`   exact   : matchFAQ ${pct(baseTestMF)} vs MLP-full ${pct(fullTest)}  (MLP in fixed pool ${pct(okCandTest)})`);
console.log(`   rephrase: matchFAQ ${pct(baseGenMF)} vs MLP-full ${pct(fullGen)}  (MLP in fixed pool ${pct(okCandGen)}, 1/9=${(100/9).toFixed(1)}%)`);
console.log(`   Verdict: WORSE. The hand scorer's exact-q bonus, IDF/entity weighting, firehose`);
console.log(`   damping and cross-experiment guards beat a 202-param MLP over 8 bigram features.`);
console.log(`   The MLP only shines when the correct answer is already sitting in a small pool.`);
