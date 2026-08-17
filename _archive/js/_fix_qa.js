const fs = require('fs');

const htmlPath = 'assistant.html';
let html = fs.readFileSync(htmlPath, 'utf8');

const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('no script block'); process.exit(1); }

let js = m[1];

// Extract the FAQ array region: const FAQ=[ ... ];
const faqStart = js.indexOf('const FAQ=[');
if (faqStart < 0) { console.error('const FAQ=[ not found'); process.exit(1); }
const faqOpen = js.indexOf('[', faqStart);
// find matching close bracket of the array (last "];" before the next top-level statement)
const faqEndRel = js.indexOf('];', faqOpen);
if (faqEndRel < 0) { console.error('FAQ ]; not found'); process.exit(1); }

let faq = js.slice(faqOpen + 1, faqEndRel); // content between [ and ]

// Fix function: escape raw newlines and raw single quotes, preserving existing escapes.
function fixValue(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\\') {
      out += c;
      if (i + 1 < raw.length) { out += raw[i + 1]; i++; }
      continue;
    }
    if (c === '\r') {
      out += '\\n';
      if (i + 1 < raw.length && raw[i + 1] === '\n') i++;
      continue;
    }
    if (c === '\n') { out += '\\n'; continue; }
    if (c === "'") { out += "\\'"; continue; }
    out += c;
  }
  return out;
}

// Fix each single-quoted field. Delimiters are unique field-boundary sequences.
const fieldOrder = [
  { key: ',title:',    next: ',q:' },
  { key: ',q:',        next: ',knode:' },
  { key: ',knode:',    next: ',subfield:' },
  { key: ',subfield:', next: ',answer:' },
];

let before = faq;
let fixedCount = 0;

for (const f of fieldOrder) {
  // non-greedy match between f.key + quote and quote + f.next
  const re = new RegExp(f.key + "'([\\s\\S]*?)'" + f.next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  faq = faq.replace(re, function (whole, body) {
    const fixed = fixValue(body);
    if (fixed !== body) fixedCount++;
    return f.key + "'" + fixed + "'" + f.next;
  });
}

// answer field: ends with ',detail:
{
  const re = /,answer:'([\s\S]*?)',detail:/g;
  faq = faq.replace(re, function (whole, body) {
    const fixed = fixValue(body);
    if (fixed !== body) fixedCount++;
    return ",answer:'" + fixed + "',detail:";
  });
}

// detail field: last field, ends with '}
{
  const re = /,detail:'([\s\S]*?)'(\s*\})/g;
  faq = faq.replace(re, function (whole, body, close) {
    const fixed = fixValue(body);
    if (fixed !== body) fixedCount++;
    return ",detail:'" + fixed + "'" + close;
  });
}

// Reassemble (avoid String.replace's $-substitution pitfalls)
js = js.slice(0, faqOpen + 1) + faq + js.slice(faqEndRel);

const tagLen = '<script>'.length;
const newHtml = html.slice(0, m.index + tagLen) + js + html.slice(m.index + tagLen + m[1].length);
fs.writeFileSync(htmlPath, newHtml, 'utf8');
console.log('FAQ entries fixed: ' + fixedCount);

// verify
try {
  new Function(js);
  console.log('SYNTAX OK');
} catch (e) {
  console.log('SYNTAX ERROR: ' + e.message);
}
