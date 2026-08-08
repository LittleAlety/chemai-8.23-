// debug_trace: BM25 FAQ trace diagnostic tool
'use strict';
const fs = require('fs');
const path = require('path');
const { readJSON } = require('../scripts/rag-utils');
const KB = readJSON(path.join(__dirname, '..', 'data', 'kb.json'));
const FAQ = readJSON(path.join(__dirname, '..', 'data', 'faq_unified.json'));
const SUBMAP = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','⁻':'-','⁺':'+'};
const norm = s => String(s||'').toLowerCase().replace(/[₀-₉⁻⁺]/g, c => SUBMAP[c] || c).replace(/\s+/g, '');

function kbTokens(text) {
  const s = norm(String(text || '')); const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[一-鿿]/.test(c)) { let j = i; while (j < s.length && /[一-鿿]/.test(s[j])) j++; const run = s.slice(i, j); for (let k = 0; k < run.length - 1; k++) out.push(run.slice(k, k + 2)); if (run.length === 1) out.push(run); i = j; }
    else if (/[a-z0-9·+\-°℃%()\[\]⁺⁻]/.test(c)) { let j = i; while (j < s.length && /[a-z0-9·+\-°℃%()\[\]⁺⁻]/.test(s[j])) j++; const tk = s.slice(i, j); if (tk.length >= 2 || /\d/.test(tk)) out.push(tk); i = j; }
    else i++;
  }
  return out;
}
function kbIndex() {
  if (kbIndex._c) return kbIndex._c;
  const docs = KB.map(en => { const parts = []; kbTokens(en.topic||'').forEach(x=>{parts.push(x,x,x);}); kbTokens((en.keys||[]).join(', ')).forEach(x=>{parts.push(x,x);}); kbTokens(en.answer||'').forEach(x=>parts.push(x)); const tf={}; parts.forEach(x=>tf[x]=(tf[x]||0)+1); return {en,tf,len:parts.length||1}; });
  const df={}; let tot=0; docs.forEach(d=>{tot+=d.len; for(const t in d.tf)df[t]=(df[t]||0)+1;});
  kbIndex._c={docs,df,avgdl:tot/(docs.length||1),N:docs.length}; return kbIndex._c;
}
function bm25MatchKB(q) {
  const idx=kbIndex(); const qtoks=kbTokens(q).filter(t=>t.length>=2); const nq=norm(q); const k1=1.5,b=0.75; const arr=[];
  for(const d of idx.docs) { let sc=0,spec=0; for(const t of qtoks){const f=d.tf[t]; if(!f)continue; const idf=Math.log(1+(idx.N-idx.df[t]+0.5)/(idx.df[t]+0.5)); sc+=idf*(f*(k1+1))/(f+k1*(1-b+b*d.len/idx.avgdl)); if(idx.df[t]<=10)spec++;} for(const k of(d.en.keys||[])){const nk=norm(k); if(nk.length>=3&&nq.includes(nk)){sc+=6;spec++;}} for(const t of(d.en.ents||[])){const nt=norm(t); if(nt.length>=2&&nq.includes(nt)){sc+=8;spec++;}} if(sc<=0)continue; arr.push({en:d.en,score:sc,spec}); }
  if(!arr.length)return null; arr.sort((a,b)=>b.score-a.score); if(arr[0].score<3.0)return null;
  return {entry:arr[0].en,score:arr[0].score,second:arr[1]?arr[1].en:null};
}

// Test fills
const QS = readJSON(path.join(__dirname, '..', '试题迭代记录/round3/test_questions_round3.json'));
const fills = QS.questions.filter(q=>q.type==='fill').slice(0,5);
for (const q of fills) {
  const cleanQ = q.question.replace(/______/g, '');
  console.log('Q: ' + cleanQ);
  console.log('  Expected: ' + q.answer);
  const m = bm25MatchKB(cleanQ);
  if (m) {
    const ai = norm((m.entry.answer||'')+' '+(m.entry.detail||''));
    console.log('  BM25: ' + (m.entry.topic||'').slice(0,50) + ' (score='+m.score.toFixed(2)+')');
    const ansWords = q.answer.split(/[,，、\s]+/).filter(w=>w.length>=2);
    for (const w of ansWords) {
      console.log('    Key "' + w + '" in answer: ' + ai.includes(norm(w)));
    }
  } else {
    console.log('  NO BM25 MATCH');
  }
  console.log('');
}
