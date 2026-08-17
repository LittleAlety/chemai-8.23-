// 最终 DOI 校验：对每个 DOI 调 CrossRef works API，比对解析出的标题/期刊/年份与声称值
// 用法：node _verify_dois.js <源文件>   源文件为 markdown 或 _crs_substituted.json
const fs = require('fs');
const path = process.argv[2] || '_crs_substituted.json';
const src = fs.readFileSync(path, 'utf8');

// ---- 从源提取 (doi, claimedTitle, claimedJournal, claimedYear) ----
const recs = [];
if (path.endsWith('.json')) {
  const arr = JSON.parse(src);
  arr.forEach(r => { if (r.doi) recs.push({ doi: r.doi, title: r.corrected_title, journal: r.journal, year: r.year }); });
} else {
  // markdown 行形如: N. Title. *Journal*, Year. DOI: 10.xxxx
  const re = /DOI:\s*(10\.\S+)/;
  src.split('\n').forEach(l => {
    const m = l.match(re);
    if (!m) return;
    const title = (l.match(/^\d+\.\s+(.+?)\.\s+\*/) || [])[1] || '';
    const jrnl = (l.match(/\*\s*([^*]+?)\s*\*,/) || [])[1] || '';
    const year = (l.match(/,\s*(\d{4})\.\s*DOI/) || [])[1] || '';
    recs.push({ doi: m[1].replace(/[),.]$/,''), title, journal: jrnl, year });
  });
}

// ---- 规范化 ----
const SUB = { '₂':'2','₃':'3','₄':'4','⁵':'5','⁶':'6','⁷':'7','⁻':'-','⁺':'+','ᴵ':'i' };
const norm = s => { let t = String(s||''); for (const k in SUB) t = t.split(k).join(SUB[k]); return t.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); };
const words = s => new Set(norm(s).split(' ').filter(w => w.length > 2));
function titleJac(a, b) { const wa=words(a), wb=words(b); if(!wa.size||!wb.size) return 0; let i=0; wa.forEach(w=>{ if(wb.has(w)) i++; }); return i/(wa.size+wb.size-i); }
// 期刊简称展开（避免 "Chem. Soc. Rev." vs "Chemical Society Reviews" 误报）
const JMAP = {
  'chem soc rev':'chemical society reviews', 'chem rev':'chemical reviews', 'chem educate':'journal of chemical education',
  'j chem educ':'journal of chemical education', 'j chem edu':'journal of chemical education',
  'j phys chem a':'journal of physical chemistry a', 'j phys chem':'journal of physical chemistry',
  'inorg chem':'inorganic chemistry', 'dalton trans':'dalton transactions', 'organometallics':'organometallics',
  'coord chem rev':'coordination chemistry reviews', 'j am chem soc':'journal of the american chemical society',
  'angew chem int ed':'angewandte chemie international edition', 'angew chem':'angewandte chemie',
  'thermochim acta':'thermochimica acta', 'j therm anal calorim':'journal of thermal analysis and calorimetry',
  'j anal appl pyrolysis':'journal of analytical and applied pyrolysis', 'j solid state chem':'journal of solid state chemistry',
  'can j chem':'canadian journal of chemistry', 'j chem phys':'journal of chemical physics',
  'environ sci technol':'environmental science and technology', 'water res':'water research',
  'j electroanal chem':'journal of electroanalytical chemistry', 'j photochem photobiol a chem':'journal of photochemistry and photobiology a chemistry',
  'j photochem photobiol a':'journal of photochemistry and photobiology a chemistry',
  'eur j inorg chem':'european journal of inorganic chemistry', 'chem eur j':'chemistry a european journal',
  'z anorg allg chem':'zeitschrift fur anorganische und allgemeine chemie',
  'j coord chem':'journal of coordination chemistry', 'physica b cond mat':'physica b condensed matter',
  'j magn reson':'journal of magnetic resonance', 'hyperfine interact':'hyperfine interactions',
  'acta cryst e':'acta crystallographica section e', 'z kristallogr':'zeitschrift fur kristallographie',
  'j serb chem soc':'journal of the serbian chemical society', 'j phys chem c':'journal of physical chemistry c',
  'acs sustainable chem eng':'acs sustainable chemistry and engineering', 'acs earth space chem':'acs earth and space chemistry',
  'environ sci processes impacts':'environmental science processes and impacts',
  'j chem health saf':'journal of chemical health and safety', 'chem health saf':'chemical health and safety',
  'sensor actuat b chem':'sensors and actuators b chemical', 'j power sources':'journal of power sources',
  'corros sci':'corrosion science', 'electrochem commun':'electrochemistry communications',
  'j hazard mater':'journal of hazardous materials', 'ecotoxicol environ saf':'ecotoxicology and environmental safety',
  'resour conserv recycl':'resources conservation and recycling', 'photochem photobiol':'photochemistry and photobiology',
  'j photochem photobiol':'journal of photochemistry and photobiology', 'phys rev b':'physical review b',
  'inorg chim acta':'inorganica chimica acta', 'mater sci eng':'materials science and engineering',
  'appl catal b environ':'applied catalysis b environmental', 'acs energy lett':'acs energy letters',
  'j environ chem eng':'journal of environmental chemical engineering',
  'chemosphere':'chemosphere', 'chem phys':'chemical physics', 'molecular physics':'molecular physics',
  'polyhedron':'polyhedron', 'chirality':'chirality', 'materials':'materials', 'metals':'metals', 'nano':'nano'
};
function jNorm(j) {
  const n = norm(j);
  return JMAP[n] || n;
}
function jAgree(a, b) {
  if (!a || !b) return false;
  const wa = words(jNorm(a)), wb = words(jNorm(b));
  let n = 0; wa.forEach(w => { if (wb.has(w)) n++; });
  return n >= 1;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const issues = [];
  let ok = 0, bad = 0;
  for (const r of recs) {
    try {
      const res = await fetch('https://api.crossref.org/works/' + encodeURIComponent(r.doi), { headers: { 'User-Agent': 'ChemAI/1.0 (mailto:chemai@example.com)' } });
      if (res.status !== 200) { issues.push(`[${r.doi}] HTTP ${res.status}`); bad++; continue; }
      const m = (await res.json()).message;
      const t = (m.title && m.title[0]) || '';
      const j = (m['container-title'] && m['container-title'][0]) || '';
      const y = String((m.issued && m.issued['date-parts'] && m.issued['date-parts'][0][0]) || '');
      const tj = titleJac(r.title, t);
      const ja = jAgree(r.journal, j);
      const yd = r.year ? Math.abs(parseInt(r.year) - parseInt(y)) : 99;
      if (tj < 0.55 || !ja || yd > 1) {
        issues.push(`[${r.doi}] 声称 "${r.title}" @ ${r.journal} ${r.year}  vs 解析 "${t.slice(0,70)}" @ ${j.slice(0,40)} ${y}  (titleJac=${tj.toFixed(2)} jAgree=${ja} yDiff=${yd})`);
        bad++;
      } else ok++;
    } catch (e) { issues.push(`[${r.doi}] 请求失败: ${e.message}`); bad++; }
    await sleep(150);
  }
  const out = `校验 ${recs.length} 条 DOI\n通过 ${ok} | 异常 ${bad}\n\n${issues.join('\n')}`;
  fs.writeFileSync('_crs_mismatch.txt', out, 'utf8');
  console.log('通过 ' + ok + ' / ' + recs.length + ' | 异常 ' + bad);
  issues.forEach(i => console.log(i));
})().catch(e => { console.error(e); process.exit(1); });
