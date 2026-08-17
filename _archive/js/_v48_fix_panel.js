// 修复：fadeUp 动画排除 #panel（knowledge 图谱节点详情侧栏用 transform 隐藏，动画填充态会覆盖它）
const fs = require('fs');
const OLD = '.page-head,.panel,.side-card,.report,.banner{animation:fadeUp .55s cubic-bezier(.22,.9,.35,1) both}';
const NEW = '.page-head,.panel:not(#panel),.side-card,.report,.banner{animation:fadeUp .55s cubic-bezier(.22,.9,.35,1) both}';
const files = ['assistant.html', 'main.html', 'corpus.html', 'prep.html', 'knowledge.html'];
let ok = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes(OLD)) {
    s = s.replace(OLD, NEW);
    fs.writeFileSync(f, s, 'utf8');
    ok++;
    console.log(f + ': ✓ 已排除 #panel');
  } else if (s.includes(NEW)) {
    console.log(f + ': 已修复，跳过');
  } else {
    console.log(f + ': ✗ 未找到动画规则');
  }
}
console.log('完成 ' + ok + ' 个文件');
