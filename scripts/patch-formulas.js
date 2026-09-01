// Second ChemicalFormula / formula-content patch:
//  (P2) Remove '·' (U+00B7) from the subscript-trigger class so a digit after a
//       hydrate dot is a full-size COEFFICIENT, not a subscript.
//       e.g. (NH4)2Fe(SO4)2·6H2O -> 6 renders full-size (was sub_6), fixing the
//       homepage "六水合" / hydrate-count look.
//  (P3) Standardize the 4 Simulator page formulas from raw ASCII notation
//       (Fe2+, *6H2O, ->) to clean Unicode sub/superscripts + · and →.
// Usage: node scripts/patch-formulas.js <bundle-js-path>
const fs = require('fs');
const file = process.argv[2];
if (!file) { console.error('usage: node patch-formulas.js <bundle>'); process.exit(1); }
let t = fs.readFileSync(file, 'utf8');

function replaceOnce(src, oldStr, newStr, label) {
  const n = src.split(oldStr).length - 1;
  if (n !== 1) {
    console.error('ERROR [' + label + ']: found ' + n + ' occurrence(s), expected 1. Are the .split boundaries off?');
    process.exit(3);
  }
  return src.replace(oldStr, newStr);
}

// --- P2: shrink the subscript-trigger class (drop the hydrate dot) ---
// Build the backslash chars explicitly to avoid escape-doubling ambiguity.
const BS = String.fromCharCode(92);
const t2_old = '/[A-Za-z' + BS + ')' + BS + ']·]/';   // literal: /[A-Za-z\)\]·]/
const t2_new = '/[A-Za-z' + BS + ')' + BS + ']]/';    // literal: /[A-Za-z\)\]]/

// make sure it is inside the ChemicalFormula subscript branch (guarded by "let c=s,u=i+1")
const t2_guard = 'let c=s,u=i+1;';
if (!t.includes(t2_guard)) { console.error('ERROR: guard not found'); process.exit(4); }
t = replaceOnce(t, t2_old, t2_new, 'P2 hydrate-dot');

// --- P3: Simulator formula strings ---
const subs = [
  ['(NH4)2Fe(SO4)2*6H2O + H2O -(H2SO4)-> Fe2+(aq)',
   '(NH₄)₂Fe(SO₄)₂·6H₂O + H₂O -(H₂SO₄)→ Fe²⁺(aq)'],
  ['(NH4)2Fe(SO4)2 + H2C2O4 -> FeC2O4*2H2O↓(黄色) + (NH4)2SO4 + H2SO4',
   '(NH₄)₂Fe(SO₄)₂ + H₂C₂O₄ → FeC₂O₄·2H₂O↓(黄色) + (NH₄)₂SO₄ + H₂SO₄'],
  ['6FeC2O4*2H2O + 3H2O2 + 6K2C2O4 -> 4K3[Fe(C2O4)3] + 2Fe(OH)3↓ + 12H2O',
   '6FeC₂O₄·2H₂O + 3H₂O₂ + 6K₂C₂O₄ → 4K₃[Fe(C₂O₄)₃] + 2Fe(OH)₃↓ + 12H₂O'],
  ['K3[Fe(C2O4)3](aq) + C2H5OH -> K3[Fe(C2O4)3]*3H2O↓',
   'K₃[Fe(C₂O₄)₃](aq) + C₂H₅OH → K₃[Fe(C₂O₄)₃]·3H₂O↓'],
];
let i = 0;
for (const [oldStr, newStr] of subs) {
  i++;
  t = replaceOnce(t, oldStr, newStr, 'P3 Simulator #' + i);
}

fs.writeFileSync(file, t, 'utf8');
console.log('Patched P2 (hydrate-dot) + P3 (4 Simulator formulas): ' + file);
