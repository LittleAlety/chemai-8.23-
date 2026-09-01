// Harness: extract the minified `Gs` (ChemicalFormula) from the bundle and
// exercise its transform so we can verify behavior before/after patching.
// Usage: node scripts/chemformula-harness.js <bundle-js-path> [optional]
const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('usage: node chemformula-harness.js <bundle>'); process.exit(1); }
const t = fs.readFileSync(path, 'utf8');

// stub React.createElement-lite
const b = { jsx: (tag, props) => ({ tag, children: props.children, props }) };
const K = { useRef: () => ({}), useEffect: () => {} };

function extractGs(src) {
  const start = src.indexOf('const Gs=({formula:t');
  if (start < 0) throw new Error('Gs not found');
  const end = src.indexOf('function kv({children', start);
  if (end < 0) throw new Error('function kv not found');
  // slice from 'const Gs=' up to just before 'function kv'; ends with '};'
  return src.slice(start, end);
}

function loadGs(file) {
  const fnText = extractGs(fs.readFileSync(file, 'utf8'));
  const code = 'var Gs=' + fnText.slice('const Gs='.length) + ';globalThis.Gs=Gs;';
  const fn = new Function('b', 'K', code);
  fn(b, K);
  return globalThis.Gs;
}

function render(gs, formula) {
  const span = gs({ formula, className: '' });
  // span.children is the array of element stubs
  return (span.children || []).map(e =>
    e && e.tag === 'sub' ? 'sub(' + e.children + ')'
    : e && e.tag === 'sup' ? 'sup(' + e.children + ')'
    : e.children
  ).join('');
}

const tests = [
  '(NH4)2Fe(SO4)2·6H2O',   // hero — ASCII digit subs, manual-style through CF
  'K3[Fe(C2O4)3]',          // ASCII digit subs
  'K₃[Fe(C₂O₄)₃]', // homepage step — Unicode SUBSCRIPTS (raw-glyph bug)
  'Fe³⁺',         // Fe³⁺ Unicode SUPERSCRIPT (double-shrink bug)
  'SO4²⁻',        // SO₄²⁻ Unicode superscripts
  'Fe2+',                   // ASCII charge (content's fault, unchanged)
  '(NH₄)₂Fe(SO₄)₂·6H₂O + H₂C₂O₄ → FeC₂O₄·2H₂O + (NH₄)₂SO₄ + H₂SO₄ + 4H₂O', // Home step 1 hydrate
  'K₃[Fe(C₂O₄)₃]·3H₂O', // Home step 4 hydrate
  '(NH₄)₂Fe(SO₄)₂·6H₂O + H₂O -(H₂SO₄)→ Fe²⁺(aq)',        // Simulator 1 (new)
  '(NH₄)₂Fe(SO₄)₂ + H₂C₂O₄ → FeC₂O₄·2H₂O↓(黄色) + (NH₄)₂SO₄ + H₂SO₄', // Simulator 2 (new)
  '6FeC₂O₄·2H₂O + 3H₂O₂ + 6K₂C₂O₄ → 4K₃[Fe(C₂O₄)₃] + 2Fe(OH)₃↓ + 12H₂O', // Simulator 3 (new)
  'K₃[Fe(C₂O₄)₃](aq) + C₂H₅OH → K₃[Fe(C₂O₄)₃]·3H₂O↓',     // Simulator 4 (new)
  'CuSO4·5H2O',   // hydrate coefficient should be FULL-SIZE (was sub_5)
];

const Gs = loadGs(path);
console.log('=== rendering (current bundle) ===');
for (const f of tests) {
  console.log(JSON.stringify(f));
  console.log('  ->', render(Gs, f));
  console.log();
}
