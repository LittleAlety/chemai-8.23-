// 合并：_verified_hints.json(已确认真实) + _agent_s1..s7.json(代理结果) → _crs_substituted.json
// 已确认条目沿用原文关键贡献；代理条目采用代理返回的 zh_note。
const fs = require('fs');
const stripBom = s => String(s).replace(/^﻿/, '');

// 1. 原文表格 → num → {title, journal, year, zh_note}
const md = fs.readFileSync('CORPUS_SUPPLEMENT_100.md', 'utf8');
const orig = {};
md.split('\n').filter(l => /^\|\s*\d{1,3}\s*\|/.test(l) && l.includes('*')).forEach(l => {
  const p = l.split('|').map(s => s.trim());
  orig[parseInt(p[1])] = { title: p[2], journal: (p[3] || '').replace(/\*/g, '').trim(), year: p[4] || '', zh_note: p[5] || '' };
});

// 2. 已验证提示表
const hints = JSON.parse(stripBom(fs.readFileSync('_verified_hints.json', 'utf8')));

// 3. 代理结果
const agentFiles = ['_agent_s1.json', '_agent_s2.json', '_agent_s3.json', '_agent_s4.json', '_agent_s5.json', '_agent_s6.json', '_agent_s7.json'];
const agents = [];
for (const f of agentFiles) {
  try {
    const arr = JSON.parse(stripBom(fs.readFileSync(f, 'utf8')));
    if (!Array.isArray(arr)) { console.error('警告: ' + f + ' 不是数组'); continue; }
    agents.push(...arr);
  } catch (e) { console.error('警告: 读取 ' + f + ' 失败: ' + e.message); }
}
const agentByNum = {};
agents.forEach(a => { if (a && a.num) agentByNum[a.num] = a; });

// 4. 组装 1..100
const out = [];
const missing = [];
for (let num = 1; num <= 100; num++) {
  const o = orig[num];
  if (hints[num]) {
    out.push({
      num, status: 'real', original_title: o.title,
      corrected_title: hints[num].title, journal: hints[num].journal, year: hints[num].year,
      doi: hints[num].doi, zh_note: o.zh_note, evidence: 'CrossRef works API 核验通过（_verified_hints.json）'
    });
  } else if (agentByNum[num]) {
    const a = agentByNum[num];
    out.push({
      num, status: a.status || 'unconfirmed', original_title: o.title,
      corrected_title: a.corrected_title || a.title || o.title, journal: a.journal || o.journal, year: a.year || o.year,
      doi: a.doi || '', zh_note: a.zh_note || o.zh_note, evidence: a.evidence || ''
    });
  } else {
    missing.push(num);
    out.push({ num, status: 'unconfirmed', original_title: o.title, corrected_title: o.title, journal: o.journal, year: o.year, doi: '', zh_note: o.zh_note, evidence: '代理未返回' });
  }
}

fs.writeFileSync('_crs_substituted.json', JSON.stringify(out, null, 1), 'utf8');

const nReal = out.filter(x => x.status === 'real').length;
const nSub = out.filter(x => x.status === 'substituted').length;
const nUnc = out.filter(x => x.status === 'unconfirmed').length;
console.log('已确认 real=' + nReal + ' | 替换 substituted=' + nSub + ' | 未确认 unconfirmed=' + nUnc);
if (missing.length) console.log('代理缺失条目: ' + missing.join(','));
console.log('合并完成 → _crs_substituted.json（' + out.length + ' 条）');
