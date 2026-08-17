const fs = require('fs');
const file = process.argv[2] || 'assistant.html';

let js;
if (file.endsWith('.html')) {
  const h = fs.readFileSync(file, 'utf8');
  const m = h.match(/<script>([\s\S]*?)<\/script>/);
  js = m[1];
} else {
  js = fs.readFileSync(file, 'utf8');
}

const lines = js.split('\n');

const isIdChar = c => /[A-Za-z0-9_$]/.test(c);
// chars after which a '/' begins a regex literal rather than division
const regexPrevOk = new Set(['(', '=', ',', ':', '[', '!', '&', '|', '?', '{', '}', ';', '~', '%', '^', '<', '>', '+', '-', '*', '/']);

// token stream over the whole file (strip strings/comments/regex), tracking bracket stack
let stack = [];          // {ch, line, col}
let prevSig = null;      // previous significant char for regex heuristic
let prevWord = '';       // previous word for keyword heuristic

for (let li = 0; li < lines.length; li++) {
  const L = lines[li];
  for (let i = 0; i < L.length; i++) {
    const c = L[i];
    const next = L[i + 1];

    // line comment
    if (c === '/' && next === '/') {
      i = L.length; // skip rest of line (continue to next line via for loop)
      continue;
    }
    // block comment
    if (c === '/' && next === '*') {
      let j = L.indexOf('*/', i + 2);
      if (j < 0) { i = L.length; } else { i = j + 1; }
      continue;
    }
    // string literal
    if (c === "'" || c === '"') {
      const q = c;
      for (let k = i + 1; k < L.length; k++) {
        if (L[k] === '\\') { k++; continue; }
        if (L[k] === q) { i = k; break; }
        if (L[k] === '\n') { console.log('RAW NEWLINE inside ' + q + '-string at line ' + (li + 1)); }
      }
      // if not closed on same line, report
      prevSig = null;
      continue;
    }
    // template literal
    if (c === '`') {
      let k = i + 1;
      let closed = false;
      while (k < L.length) {
        if (L[k] === '\\') { k += 2; continue; }
        if (L[k] === '`') { i = k; closed = true; break; }
        k++;
      }
      if (!closed) console.log('UNCLOSED template at line ' + (li + 1));
      prevSig = null;
      continue;
    }
    // regex literal
    if (c === '/') {
      const isRegex =
        prevSig === null ||
        regexPrevOk.has(prevSig) ||
        /(return|typeof|case|in|of|=>|do|else)$/.test(prevWord);
      if (isRegex) {
        let k = i + 1;
        let inClass = false;
        let closed = false;
        while (k < L.length) {
          const ch = L[k];
          if (ch === '\\') { k += 2; continue; }
          if (ch === '[') inClass = true;
          if (ch === ']') inClass = false;
          if (ch === '/' && !inClass) { i = k; closed = true; break; }
          if (ch === '\n') break;
          k++;
        }
        if (!closed) console.log('UNCLOSED regex at line ' + (li + 1));
        prevSig = null;
        continue;
      }
      // else division
      prevSig = '/';
      prevWord = '';
      continue;
    }

    // whitespace
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { continue; }

    // bracket tracking
    if (c === '(' || c === '{' || c === '[') {
      stack.push({ ch: c, line: li + 1, col: i });
    } else if (c === ')' || c === '}' || c === ']') {
      const expect = { ')': '(', '}': '{', ']': '[' }[c];
      const top = stack[stack.length - 1];
      if (!top) {
        console.log('EXTRA ' + c + ' at line ' + (li + 1) + ' col ' + i);
        prevSig = c; prevWord = ''; continue;
      }
      if (top.ch === expect) {
        stack.pop();
      } else {
        console.log('MISMATCH at line ' + (li + 1) + ': got ' + c + ' but top of stack is ' + top.ch + ' (opened line ' + top.line + ')');
        console.log('  STACK (top 12):');
        for (let s = stack.length - 1; s >= 0 && s >= stack.length - 12; s--) {
          console.log('    ' + stack[s].ch + ' @ line ' + stack[s].line);
        }
        // do NOT pop; treat this close as orphan and continue
      }
    }

    // update prevSig / prevWord
    if (isIdChar(c)) { prevWord += c; prevSig = c; }
    else { prevWord = ''; prevSig = c; }
  }
}

console.log('=== FINAL: stack has ' + stack.length + ' unclosed brackets ===');
for (const s of stack) {
  console.log('  unclosed ' + s.ch + ' opened at line ' + s.line + ' col ' + s.col);
}
