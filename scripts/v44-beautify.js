'use strict';
/** v44 美化：5 页 ChemAI 艺术字（流动渐变 + 辉光）+ 图标呼吸光晕 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const KF = '@keyframes chemaiFlow{0%{background-position:0% 0}100%{background-position:220% 0}}@keyframes chemaiPulse{0%,100%{box-shadow:0 0 6px rgba(16,185,129,.22)}50%{box-shadow:0 0 18px rgba(45,212,191,.5)}}';

const JOBS = [
  {
    file: 'assistant.html',
    nameOld: '.logo-name{font-weight:700;font-size:17px;background:linear-gradient(90deg,var(--em),var(--teal));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}',
    nameNew: '.logo-name{font-weight:700;font-size:17px;background:linear-gradient(90deg,var(--em),var(--teal),#60a5fa,#a78bfa,var(--teal),var(--em));background-size:220% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:chemaiFlow 5s linear infinite;filter:drop-shadow(0 0 5px rgba(45,212,191,.35))}',
    iconOld: '.logo-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;background:linear-gradient(135deg,rgba(16,185,129,.25),rgba(45,212,191,.12));border:1px solid rgba(16,185,129,.35)}',
    iconNew: '.logo-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;background:linear-gradient(135deg,rgba(16,185,129,.25),rgba(45,212,191,.12));border:1px solid rgba(16,185,129,.35);animation:chemaiPulse 3.5s ease-in-out infinite}',
    subOld: '.logo-sub{font-size:11px;color:var(--t3);letter-spacing:.2px}'
  },
  {
    file: 'corpus.html',
    nameOld: '.logo-name{font-weight:700;font-size:17px;background:linear-gradient(90deg,var(--emerald),var(--teal));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}',
    nameNew: '.logo-name{font-weight:700;font-size:17px;background:linear-gradient(90deg,var(--emerald),var(--teal),#60a5fa,#a78bfa,var(--teal),var(--emerald));background-size:220% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:chemaiFlow 5s linear infinite;filter:drop-shadow(0 0 5px rgba(45,212,191,.35))}',
    iconOld: '.logo-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;background:linear-gradient(135deg,rgba(16,185,129,.25),rgba(45,212,191,.12));border:1px solid rgba(16,185,129,.35)}',
    iconNew: '.logo-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;background:linear-gradient(135deg,rgba(16,185,129,.25),rgba(45,212,191,.12));border:1px solid rgba(16,185,129,.35);animation:chemaiPulse 3.5s ease-in-out infinite}',
    subOld: '.logo-sub{font-size:11px;color:var(--t3);letter-spacing:.2px}'
  },
  {
    file: 'main.html',
    nameOld: '.logo-name{font-weight:700;font-size:17px;background:linear-gradient(90deg,var(--emerald),var(--teal));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}',
    nameNew: '.logo-name{font-weight:700;font-size:17px;background:linear-gradient(90deg,var(--emerald),var(--teal),#60a5fa,#a78bfa,var(--teal),var(--emerald));background-size:220% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:chemaiFlow 5s linear infinite;filter:drop-shadow(0 0 5px rgba(45,212,191,.35))}',
    iconOld: '.logo-icon{\n  width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;\n  font-size:20px;background:linear-gradient(135deg,rgba(16,185,129,.25),rgba(45,212,191,.12));\n  border:1px solid rgba(16,185,129,.35);\n}',
    iconNew: '.logo-icon{\n  width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;\n  font-size:20px;background:linear-gradient(135deg,rgba(16,185,129,.25),rgba(45,212,191,.12));\n  border:1px solid rgba(16,185,129,.35);\n  animation:chemaiPulse 3.5s ease-in-out infinite;\n}',
    subOld: '.logo-sub{font-size:11px;color:var(--t3);letter-spacing:.2px}'
  },
  {
    file: 'prep.html',
    nameOld: '.logo-name{font-weight:700;font-size:17px;background:linear-gradient(90deg,var(--emerald),var(--teal));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}',
    nameNew: '.logo-name{font-weight:700;font-size:17px;background:linear-gradient(90deg,var(--emerald),var(--teal),#60a5fa,#a78bfa,var(--teal),var(--emerald));background-size:220% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:chemaiFlow 5s linear infinite;filter:drop-shadow(0 0 5px rgba(45,212,191,.35))}',
    iconOld: '.logo-icon{\n  width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;\n  font-size:20px;background:linear-gradient(135deg,rgba(16,185,129,.25),rgba(45,212,191,.12));\n  border:1px solid rgba(16,185,129,.35);\n}',
    iconNew: '.logo-icon{\n  width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;\n  font-size:20px;background:linear-gradient(135deg,rgba(16,185,129,.25),rgba(45,212,191,.12));\n  border:1px solid rgba(16,185,129,.35);\n  animation:chemaiPulse 3.5s ease-in-out infinite;\n}',
    subOld: '.logo-sub{font-size:11px;color:var(--t3);letter-spacing:.2px}'
  },
  {
    file: 'knowledge.html',
    nameOld: '.logo-name{font-weight:700;font-size:16px;letter-spacing:.01em;\n  background:linear-gradient(90deg,#34d399,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}',
    nameNew: '.logo-name{font-weight:700;font-size:16px;letter-spacing:.01em;background:linear-gradient(90deg,#34d399,#2dd4bf,#60a5fa,#a78bfa,#2dd4bf,#34d399);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:chemaiFlow 5s linear infinite;filter:drop-shadow(0 0 5px rgba(45,212,191,.35))}',
    iconOld: null, // knowledge 图标已有静态辉光，保持
    subOld: '.logo-sub{font-size:10.5px;color:var(--txt3);letter-spacing:.02em;white-space:nowrap}'
  }
];

function rep(s, oldS, newS, label) {
  if (oldS === null) return s;
  const count = s.split(oldS).length - 1;
  if (count !== 1) { console.error('❌ [' + label + '] 命中 ' + count + ' 次'); process.exit(1); }
  return s.split(oldS).join(newS);
}

for (const j of JOBS) {
  const fp = path.join(ROOT, j.file);
  let s = fs.readFileSync(fp, 'utf8');
  s = rep(s, j.nameOld, j.nameNew, j.file + ' name');
  s = rep(s, j.iconOld, j.iconNew, j.file + ' icon');
  // 注入 keyframes（在 logo-sub 之后）
  if (!s.includes('chemaiFlow')) {
    const count = s.split(j.subOld).length - 1;
    if (count !== 1) { console.error('❌ [' + j.file + '] logo-sub 命中 ' + count + ' 次'); process.exit(1); }
    s = s.split(j.subOld).join(j.subOld + '\n' + KF);
  }
  fs.writeFileSync(fp, s, 'utf8');
  console.log('✓ ' + j.file);
}
console.log('完成');
