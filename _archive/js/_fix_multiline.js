const fs = require('fs');

// 读取 HTML，提取 script 内容
let html = fs.readFileSync('assistant.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('未找到 script'); process.exit(1); }
let js = m[1];

// 逐字符扫描：找到 answer:' 或 detail:' 后的字符串字面量
// 这些字符串本应是单行（用 \n 转义），但部分被错误地转成了真实换行
// 需要把真实换行重新转义为字面 \\n
let result = '';
let i = 0;
let fixed = 0;
const KEY_PATTERNS = ["answer:'", "detail:'"];

function isKeyStart(s, idx) {
  for (const k of KEY_PATTERNS) {
    if (s.startsWith(k, idx)) return k.length;
  }
  return 0;
}

while (i < js.length) {
  const klen = isKeyStart(js, i);
  if (klen === 0) {
    result += js[i];
    i++;
    continue;
  }
  // 找到 answer:' 或 detail:'，开始复制键名
  result += js.substr(i, klen);
  i += klen;
  // 现在 i 指向字符串内容的第一个字符
  // 扫描直到遇到未转义的单引号 ' 结束字符串
  let str = '';
  let closed = false;
  while (i < js.length) {
    const ch = js[i];
    if (ch === '\\') {
      // 转义字符：保留反斜杠和下一个字符
      str += ch;
      if (i + 1 < js.length) {
        str += js[i + 1];
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    if (ch === "'") {
      // 字符串结束
      str += ch;
      i++;
      closed = true;
      break;
    }
    if (ch === '\n' || ch === '\r') {
      // 真实换行 → 转义为 \n
      if (ch === '\r') {
        // 跳过 \r\n 中的 \r
        if (i + 1 < js.length && js[i + 1] === '\n') {
          str += '\\n';
          i += 2;
        } else {
          str += '\\n';
          i++;
        }
      } else {
        str += '\\n';
        i++;
      }
      fixed++;
      continue;
    }
    str += ch;
    i++;
  }
  result += str;
}

console.log('修复的真实换行数: ' + fixed);
const newHtml = html.replace(m[1], result);
fs.writeFileSync('assistant.html', newHtml, 'utf8');
console.log('已写回 assistant.html');
