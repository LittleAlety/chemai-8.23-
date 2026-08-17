const fs = require('fs');
const { execSync } = require('child_process');
// 从 git 588bd69 恢复替换前的 assistant.html（含 890 逐题专属条目）
const before = execSync('git show 588bd69:assistant.html', { maxBuffer: 50 * 1024 * 1024 }).toString('utf8');
fs.writeFileSync('_tmp_before.html', before, 'utf8');
const { parseFAQ } = require('./scripts/lib-assistant-faq.js');
const spec = parseFAQ(before).filter(f => (f.q || '').length > 30);
fs.writeFileSync('Agent工作区/Agent-优化/generalize_spec_entries.json', JSON.stringify(spec.map(f => ({ title: f.title, q: f.q })), null, 2), 'utf8');
console.log('已恢复逐题专属条目数:', spec.length);
// 检查当前 assistant.html 状态
const cur = parseFAQ(fs.readFileSync('assistant.html', 'utf8'));
console.log('当前 FAQ 条数:', cur.length);
console.log('当前含通用条目(标题含"综合|通用"或来自 generalize_entries):', cur.filter(f => f.q === '').length, '条 q 为空');
