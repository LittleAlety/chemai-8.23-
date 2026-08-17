// 重建 CORPUS_SUPPLEMENT_100.md：从 _crs_substituted.json 生成标准参考文献清单
const fs = require('fs');
const arr = JSON.parse(fs.readFileSync('_crs_substituted.json', 'utf8'));
const byNum = {}; arr.forEach(r => byNum[r.num] = r);

const CN = ['一', '二', '三', '四', '五', '六', '七', '八'];
const sections = [
  { title: '配位化学理论与历史', start: 1, end: 15 },
  { title: '光化学机理与光物理', start: 16, end: 30 },
  { title: '热分析', start: 31, end: 45 },
  { title: '磁性研究', start: 46, end: 60 },
  { title: '结构表征与光谱学', start: 61, end: 75 },
  { title: '合成制备方法优化', start: 76, end: 85 },
  { title: '电化学与溶液化学', start: 86, end: 95 },
  { title: '安全与实验室废弃物处理', start: 96, end: 100 },
];

function fmtZh(r) {
  const note = r.zh_note || '';
  return r.status === 'substituted' ? '（替代文献）' + note : note;
}
function entryLine(r) {
  const t = String(r.corrected_title || '').replace(/\s*\.+\s*$/, '').trim();
  return `${r.num}. ${t}. *${r.journal}*, ${r.year}. DOI: ${r.doi} (${fmtZh(r)})`;
}

let md = '# 三草酸合铁酸钾语料库 — 100篇补充文献清单（DOI核验修订版）\n\n';
md += '> 修订日期：2026-08-15\n';
md += '> 本清单 100 条文献的 DOI 均逐条经 CrossRef 官方注册库核验，确保 DOI 可解析到对应论文本身。对原清单中无法查实的条目，已替换为同主题真实文献（以「替代文献」标注）。\n\n';
md += '> 注：按用户要求，清单采用标准参考文献列表格式（标题. 期刊, 年份. DOI），不包含作者与卷期页码；文献顺序与分节保持与原文一致。\n\n---\n\n';

sections.forEach((s, i) => {
  const cnt = s.end - s.start + 1;
  md += `## ${CN[i]}、${s.title} (${cnt}篇)\n\n`;
  for (let n = s.start; n <= s.end; n++) {
    const r = byNum[n];
    if (!r) { md += `${n}. *[缺失 #${n}]*\n`; continue; }
    md += entryLine(r) + '\n';
  }
  md += '\n---\n\n';
});

// 覆盖缺口总结（按分节）
const summary = [
  ['蓝晒工艺', 67, 0],
  ['合成制备方法优化', 62, 10],
  ['综合研究', 49, 0],
  ['摩尔盐相关', 43, 0],
  ['草酸配合物', 27, 0],
  ['光化学机理与光物理', 18, 15],
  ['实验教学', 9, 0],
  ['分析测定', 5, 0],
  ['磁性研究', 4, 15],
  ['结构表征与光谱学', 4, 15],
  ['热分析', 3, 15],
  ['配位化学理论与历史', 0, 15],
  ['电化学与溶液化学', 0, 10],
  ['安全与实验室废弃物处理', 0, 5],
];
const totC = summary.reduce((a, r) => a + r[1], 0);
const totS = summary.reduce((a, r) => a + r[2], 0);

md += '## 覆盖缺口总结\n\n';
md += '| 知识领域 | 现有语料库 | 补充文献 | 补充后总计 |\n';
md += '|----------|-----------|---------|-----------|\n';
summary.forEach(([name, have, add]) => {
  const addTxt = add ? String(add) : '—';
  md += `| ${name} | ${have} | ${addTxt} | ${have + add} |\n`;
});
md += `| **总计** | **${totC}** | **${totS}** | **${totC + totS}** |\n\n`;
md += '> 优先补充顺序：**配位化学理论与历史 > 磁性研究 > 热分析 > 光化学机理 > 结构表征 > 电化学 > 安全处理**\n';

fs.writeFileSync('CORPUS_SUPPLEMENT_100.md', md, 'utf8');
console.log('已写入 CORPUS_SUPPLEMENT_100.md（' + arr.length + ' 条）');
// 校验计数
let bad = 0;
arr.forEach(r => { if (!r.doi) { console.log('缺DOI: #' + r.num); bad++; } });
const dups = arr.map(r => r.doi).filter((d, i, a) => d && a.indexOf(d) !== i);
if (dups.length) console.log('重复DOI: ' + dups.join(', '));
console.log(bad ? ('有 ' + bad + ' 条缺DOI！') : '全部 100 条均有 DOI');
