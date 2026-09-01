// Patch ChemicalFormula (Gs) in the bundle so that:
//   - Unicode SUBSCRIPT glyphs (₀-₉) are emitted as ASCII digits inside <sub>
//     (previously they passed through as raw font glyphs -> unclear on Home).
//   - Unicode SUPERSCRIPT glyphs (⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹) are converted to ASCII inside
//     <sup> (previously the already-small Unicode glyphs got double-shrunk).
// ASCII-digit subscripts keep working exactly as before.
// Usage: node scripts/patch-chemformula.js <bundle-js-path>
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('usage: node patch-chemformula.js <bundle>'); process.exit(1); }

const t = fs.readFileSync(file, 'utf8');

const OLD =
  'if(/[0-9]/.test(s)&&i>0){const l=n[i-1];if(/[A-Za-z\\)\\]·]/.test(l)){let c=s,u=i+1;for(;u<n.length&&/[0-9]/.test(n[u]);)c+=n[u],u++;a.push(b.jsx("sub",{"code-path":"src/components/ChemicalFormula.tsx:28:25",children:c},o++)),i=u;continue}}if(/[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(s)){let l=s,c=i+1;for(;c<n.length&&/[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(n[c]);)l+=n[c],c++;a.push(b.jsx("sup",{"code-path":"src/components/ChemicalFormula.tsx:42:23",children:l},o++)),i=c;continue}';

const NEW =
  'if(/[0-9₀₁₂₃₄₅₆₇₈₉]/.test(s)&&i>0){const l=n[i-1];if(/[A-Za-z\\)\\]·]/.test(l)){let c=s,u=i+1;for(;u<n.length&&/[0-9₀₁₂₃₄₅₆₇₈₉]/.test(n[u]);)c+=n[u],u++;c=c.replace(/[₀₁₂₃₄₅₆₇₈₉]/g,q=>String.fromCharCode(q.charCodeAt(0)-0x2080+48));a.push(b.jsx("sub",{"code-path":"src/components/ChemicalFormula.tsx:28:25",children:c},o++)),i=u;continue}}if(/[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(s)){let l=s,c=i+1;for(;c<n.length&&/[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(n[c]);)l+=n[c],c++;l=l.replace(/[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g,q=>"+-0123456789"["⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(q)]);a.push(b.jsx("sup",{"code-path":"src/components/ChemicalFormula.tsx:42:23",children:l},o++)),i=c;continue}';

if (!t.includes(OLD)) {
  console.error('ERROR: old substring NOT found (maybe already patched or bundle changed).');
  process.exit(2);
}
// ensure the OLD occurs exactly once in the bundle
const count = t.split(OLD).length - 1;
if (count !== 1) {
  console.error('ERROR: old substring occurs ' + count + ' times, expected exactly 1.');
  process.exit(3);
}

const out = t.replace(OLD, NEW);
fs.writeFileSync(file, out, 'utf8');
console.log('Patched: ' + file + ' (occurrences=' + count + ')');
