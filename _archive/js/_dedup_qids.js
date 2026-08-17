const fs = require('fs');
const path = require('path');
const root = __dirname;
const rd = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').replace(/^﻿/, ''));
const wr = (f, d) => fs.writeFileSync(path.join(root, f), JSON.stringify(d, null, 2), 'utf8');
const fin = rd('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json');
console.log('条目数:', fin.length);
const idCount = {}; fin.forEach(q => idCount[q.id] = (idCount[q.id] || 0) + 1);
const dups = Object.entries(idCount).filter(([, c]) => c > 1);
console.log('重复id:', dups.length, dups.slice(0, 10).map(([k, c]) => k + '×' + c).join(', '));
// 去重: 按 question 文本保留唯一, 重新分配唯一id
const seenQ = new Set();
const uniq = [];
fin.forEach(q => {
  const t = q.question;
  if (seenQ.has(t)) return;
  seenQ.add(t);
  uniq.push({ ...q, id: 'Q' + String(uniq.length + 1).padStart(3, '0') });
});
console.log('去重后:', uniq.length);
// 校验新id无重复
const idC2 = {}; uniq.forEach(q => idC2[q.id] = (idC2[q.id] || 0) + 1);
console.log('新id重复:', Object.values(idC2).filter(c => c > 1).length);
wr('Agent工作区/Agent-B-问题生成/self_train_q_n200_final.json', uniq);
console.log('已写回去重后的题目集');
