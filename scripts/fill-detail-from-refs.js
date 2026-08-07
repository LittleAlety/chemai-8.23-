'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const writeJSON = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2), 'utf8');

const FAQ = readJSON('data/faq_unified.json');
const MANUAL = readJSON('data/manual.json');
const CORPUS = readJSON('data/corpus.json');

const manualSections = new Map();
(MANUAL.chapters || []).forEach(ch => (ch.sections || []).forEach(s => manualSections.set(s.id, s)));
const corpusEntries = new Map((CORPUS.entries || []).map(e => [String(e.id), e]));
const snippet = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 260);
const CATEGORY_REFS = {
  '合成制备': ['ch4-s1', 'ch3-s1'],
  '反应原理': ['ch3-s2', 'ch3-s3'],
  '实验操作': ['ch4-s1', 'ch4-s2', 'ch4-s3'],
  '分析测定': ['ch5-s1', 'ch5-s2', 'ch5-s4'],
  '光化学应用': ['ch6-s1', 'ch6-s2', 'ch6-s3'],
  '结构表征': ['ch2-s1', 'ch2-s3', 'ch7-s1'],
  '磁性研究': ['ch7-s3', 'ch7-s4'],
  '热分析': ['ch12-s1', 'ch2-s2'],
  '安全与废物处理': ['ch8-s1', 'ch8-s3', 'ch8-s4'],
  '配位化学理论': ['ch7-s1', 'ch7-s2', 'ch3-s1'],
  '实验教学': ['ch9-s1', 'ch9-s2'],
  '综合研究': ['ch9-s3', 'ch10-s1'],
  '化学史': ['ch1-s1', 'ch1-s2'],
  '高等理论': ['ch7-s1', 'ch7-s2'],
  '蓝晒工艺': ['ch6-s2', 'ch6-s3'],
  '摩尔盐相关': ['ch3-s2', 'ch8-s2'],
  '草酸配合物': ['ch10-s1']
};

let changed = 0;
FAQ.forEach(item => {
  if ((!Array.isArray(item.manual_refs) || !item.manual_refs.length) &&
      (!Array.isArray(item.corpus_refs) || !item.corpus_refs.length)) {
    const catRefs = CATEGORY_REFS[item.category || item.subfield || ''];
    if (catRefs) item.manual_refs = catRefs.slice();
  }
  if (String(item.detail || '').trim().length >= 20) return;
  let detail = '';
  if (Array.isArray(item.manual_refs)) {
    for (const ref of item.manual_refs) {
      const sec = manualSections.get(ref);
      if (sec && snippet(sec.content)) {
        detail = '手册补充：' + snippet(sec.content) + '（来源：' + ref + '）';
        break;
      }
    }
  }
  if (!detail && Array.isArray(item.corpus_refs)) {
    for (const ref of item.corpus_refs) {
      const id = String(ref).match(/(?:语料|文献)?#\s*(\d{1,4})/);
      if (!id) continue;
      const e = corpusEntries.get(String(Number(id[1])));
      if (e && snippet(e.abstract || e.content || e.objects || e.methods)) {
        detail = '文献补充：' + snippet(e.abstract || e.content || e.objects || e.methods) + '（来源：语料#' + e.id + '）';
        break;
      }
    }
  }
  if (detail) {
    item.detail = detail;
    changed++;
  }
});

writeJSON('data/faq_unified.json', FAQ);
console.log('details filled from refs:', changed);
