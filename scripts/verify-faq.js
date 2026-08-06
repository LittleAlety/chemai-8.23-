'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));

const faq = readJSON('data/faq_unified.json');
const manual = readJSON('data/manual.json');
const corpus = readJSON('data/corpus.json');
const corpusIds = new Set((corpus.entries || []).map(e => String(e.id)));

const manualSections = new Set();
(manual.chapters || []).forEach(ch => {
  (ch.sections || []).forEach(s => manualSections.add(s.id));
});

const issues = [];

function push(title, field, message) {
  issues.push({ title, field, message });
}

faq.forEach(item => {
  const title = item.title || item.q || '(untitled)';
  const fields = ['answer', 'detail'];

  if (!Array.isArray(item.keys) || !item.keys.length) {
    push(title, 'keys', '缺少 keys');
  }
  if (!item.answer || String(item.answer).trim().length < 20) {
    push(title, 'answer', '答案过短');
  }

  const corpusRefs = Array.isArray(item.corpus_refs) ? item.corpus_refs : [];
  corpusRefs.forEach(ref => {
    const ids = String(ref).match(/(?:语料|文献)?#\s*(\d{1,4})/g) || [];
    ids.forEach(raw => {
      const id = String(Number(raw.replace(/[^\d]/g, '')));
      if (!corpusIds.has(id)) {
        push(title, 'corpus_refs', '引用不存在的语料编号 #' + id + '：' + ref);
      }
    });
  });

  const haystack = fields.map(k => item[k] || '').join('\n');
  const manualRefs = haystack.matchAll(/manual(?:\.json)?\s*(?:ch(?:apter)?)?\s*(\d+)(?:[-_ ]?\s*s(?:ec(?:tion)?)?\s*(\d+))?/gi);
  for (const m of manualRefs) {
    const key = 'ch' + m[1] + '-s' + (m[2] || '');
    if (!manualSections.has(key) && !manualSections.has('ch' + m[1])) {
      push(title, 'manual refs', '引用不存在的手册章节 ' + key + '：' + m[0]);
    }
  }

  const opChecks = [
    {
      label: '110℃ 干燥错误，手册为 50℃/20 分钟',
      re: /110\s*[℃°]\s*(?:烘干|干燥|烘箱|烘)/g
    },
    {
      label: '30% H2O2 作为实验试剂，手册为 6%',
      re: /30\s*%\s*(?:H2O2|过氧化氢|双氧水)/gi
    },
    {
      label: '母液与乙醇 1:1/1:2，手册为约 10 mL 乙醇/25-30 mL 母液',
      re: /(?:母液|溶液)[^。\n]{0,12}(?:1\s*[:：]\s*1|1\s*[:：]\s*2)(?!\.5)/g
    },
    {
      label: '50℃ 烘干 1-2 小时，手册为 20 分钟',
      re: /50\s*[℃°][^。\n]{0,20}(?:烘干|干燥)[^。\n]{0,20}(?:1\s*[-—–~]?\s*2|1[-—–~]2)\s*(?:小时|h)/gi
    },
    {
      label: '结晶母液 10-15 mL，手册为 25-30 mL',
      re: /10\s*[-—–~]?\s*15\s*mL/g
    },
    {
      label: '乙醇 25 mL，手册为约 10 mL',
      re: /(?:25|2[05])\s*mL\s*(?:95\s*%|乙醇)/g
    }
  ];

  opChecks.forEach(check => {
    for (const m of haystack.matchAll(check.re)) {
      const start = Math.max(0, m.index - 80);
      const raw = haystack.slice(start, m.index + 140);
      const context = raw.replace(/\s+/g, ' ');
      if (check.label.indexOf('110℃') >= 0 &&
          /严禁|K₂C₂O₄|草酸钾|TGA|热重|恒重法|失结晶水|失水温度/.test(raw)) {
        continue;
      }
      if (check.label.indexOf('30%') >= 0 &&
          /需稀释|>30%|危险|非30%/.test(raw)) {
        continue;
      }
      push(title, check.label, context);
    }
  });
});

const grouped = new Map();
issues.forEach(issue => {
  if (!grouped.has(issue.message)) grouped.set(issue.message, []);
  grouped.get(issue.message).push(issue);
});

console.log('FAQ 条目数:', faq.length);
console.log('问题总数:', issues.length);
console.log('去重后问题类型:', grouped.size);
console.log('涉及条目:', Array.from(new Set(issues.map(i => i.title))).join(' | '));
console.log('');

Array.from(grouped.entries()).forEach(([message, list]) => {
  console.log('== ' + message + ' (' + list.length + ') ==');
  list.slice(0, 12).forEach(item => {
    console.log('  - ' + item.title + ' [' + item.field + ']');
  });
  if (list.length > 12) console.log('  ... 其余 ' + (list.length - 12) + ' 条略');
  console.log('');
});

process.exit(issues.length ? 1 : 0);
