'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const FAQ_PATH = path.join(root, 'data', 'faq_unified.json');
const FAQ = JSON.parse(fs.readFileSync(FAQ_PATH, 'utf8').replace(/^\uFEFF/, ''));

let changed = 0;
FAQ.forEach(item => {
  const answer = String(item.answer || '');
  if (answer.trim().length >= 60) return;
  const detail = String(item.detail || '');
  const addition = detail.trim().length > 20 ? detail : null;
  if (addition && !answer.includes(addition.slice(0, 30))) {
    item.answer = answer.trim() + '\n\n' + addition;
    changed++;
  }
});

fs.writeFileSync(FAQ_PATH, JSON.stringify(FAQ, null, 2), 'utf8');
console.log('expanded short answers:', changed);
