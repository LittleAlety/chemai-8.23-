const fs = require('fs');
const path = require('path');
const { readJSON } = require('./scripts/rag-utils');

// Inline just what we need (debug-specific overloads)
const SUBMAP = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','⁻':'-','⁺':'+'};
const norm = s => String(s||'').toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, c => SUBMAP[c] || c).replace(/\s+/g, '');

const AUTO_FAQ = readJSON(path.join(__dirname, 'data', 'faq_unified.json'));
const QUESTIONS = readJSON(path.join(__dirname, 'test_questions_round2.json'));

// FAQ matching
function matchFAQv3(q) {
  const nq = norm(q);
  let best = null, bestScore = 0;
  for (const f of AUTO_FAQ) {
    let kh = 0, longKeyHits = 0;
    for (const k of (f.keys || [])) {
      const nk = norm(k);
      if (nk.length >= 2 && nq.includes(nk)) { kh++; if (nk.length >= 3) longKeyHits++; }
    }
    let eh = 0;
    for (const en of (f.ents || [])) { if (nq.includes(norm(en))) eh++; }
    const trig = (kh >= 1) || (eh >= 1);
    if (!trig) continue;
    const score = kh * 2 + eh * 3 + longKeyHits * 0.5;
    if (score >= bestScore) { bestScore = score; best = f; }
  }
  return best;
}

// Test single-choice Q2
const q2 = QUESTIONS.questions.find(x => x.id === 'r2-022') || QUESTIONS.questions.find(x => x.type === 'single');
if (q2) {
  console.log('Q:', q2.question);
  console.log('Type:', q2.type);
  console.log('Answer:', q2.answer);
  if (q2.options) console.log('Options:', q2.options.join(' | '));

  // Option stripping
  const letterOpts = [];
  const letterRe = /([A-H])[\.．、\)）]\s*([^\n]{1,200}?)(?=\s*[A-H][\.．、\)）]|\s*$)/g;
  let m;
  while ((m = letterRe.exec(q2.question)) !== null) {
    letterOpts.push({ letter: m[1], text: m[2].trim() });
  }
  console.log('Detected options:', letterOpts.length);

  let cleanQuery = q2.question;
  if (letterOpts.length >= 2) {
    cleanQuery = q2.question.replace(/\s*[A-H][\.．、\)）]\s*[^\n]{1,200}?(?=\s*[A-H][\.．、\)）]|\s*$)/g, '').trim();
  }
  console.log('Clean query:', cleanQuery);

  // FAQ search
  const faqHit = matchFAQv3(cleanQuery);
  if (faqHit) {
    console.log('FAQ HIT:', faqHit.title);
    console.log('FAQ answer:', (faqHit.answer || '').slice(0, 300));
    console.log('FAQ keys:', (faqHit.keys || []).slice(0, 8).join(', '));

    // Check which option matches
    const aiNorm = norm(faqHit.answer + ' ' + (faqHit.detail || ''));
    console.log('');
    console.log('Option matching:');
    for (const opt of letterOpts) {
      const optNorm = norm(opt.text);
      const found = aiNorm.includes(optNorm);
      console.log('  ' + opt.letter + '. ' + opt.text.slice(0, 60) + (found ? ' ← MATCH!' : ''));
    }
  } else {
    console.log('NO FAQ MATCH for:', cleanQuery);
    console.log('Query norm:', norm(cleanQuery));
    // Show which FAQ keys might match
    const nq = norm(cleanQuery);
    console.log('Searching matching keys in FAQ...');
    let foundAny = false;
    for (const f of AUTO_FAQ.slice(0, 50)) {
      for (const k of (f.keys || [])) {
        const nk = norm(k);
        if (nk.length >= 2 && nq.includes(nk)) {
          console.log('  Key match: "' + k + '" in FAQ: ' + f.title);
          foundAny = true;
          break;
        }
      }
    }
    if (!foundAny) console.log('  (no key matches in first 50 FAQ entries)');
  }
}
