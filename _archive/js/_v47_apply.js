// 将 5 页的 v46 注入块替换为 v47（动态效果强化版）
const fs = require('fs');

const v47 = `<style>
/* === ChemAI 全局美化 v47：动态效果强化 === */
::selection{background:rgba(16,185,129,.22)}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(148,163,184,.22);border-radius:6px;border:2px solid transparent;background-clip:content-box}
::-webkit-scrollbar-thumb:hover{background:rgba(148,163,184,.42);background-clip:content-box;border:2px solid transparent}

/* —— 入场：位移更大 + 轻微缩放 + 弹性缓动 —— */
@keyframes fadeUp{from{opacity:0;transform:translateY(28px) scale(.97)}to{opacity:1;transform:none}}
.page-head,.panel,.side-card,.report,.banner{animation:fadeUp .55s cubic-bezier(.22,.9,.35,1) both}
.stat-card,.tab{animation:fadeUp .55s cubic-bezier(.22,.9,.35,1) both}
.stat-cards .stat-card:nth-child(1){animation-delay:.05s}
.stat-cards .stat-card:nth-child(2){animation-delay:.12s}
.stat-cards .stat-card:nth-child(3){animation-delay:.19s}
.stat-cards .stat-card:nth-child(4){animation-delay:.26s}
.tabs .tab:nth-child(1){animation-delay:.03s}
.tabs .tab:nth-child(2){animation-delay:.09s}
.tabs .tab:nth-child(3){animation-delay:.15s}
.tabs .tab:nth-child(4){animation-delay:.21s}

/* —— 悬浮：明显抬起 + 光晕 + 微放大 —— */
.card,.side-card,.calc-card,.wrong-item,.doc-card,.qcard,.learn-card,.stat-card{transition:transform .32s cubic-bezier(.2,.9,.3,1.25),box-shadow .32s ease,border-color .32s ease,filter .32s ease}
.card:hover,.side-card:hover,.calc-card:hover,.wrong-item:hover,.doc-card:hover,.qcard:hover,.learn-card:hover{transform:translateY(-7px) scale(1.018);border-color:rgba(16,185,129,.5);box-shadow:0 20px 48px rgba(2,6,23,.38),0 0 0 1px rgba(16,185,129,.12),0 0 30px rgba(16,185,129,.18);filter:brightness(1.05)}
.stat-card:hover{transform:translateY(-5px) scale(1.03);border-color:rgba(16,185,129,.45);box-shadow:0 16px 38px rgba(2,6,23,.34),0 0 24px rgba(16,185,129,.16)}

/* —— 按钮：按下回弹 + 主按钮悬浮光晕 —— */
.btn{transition:transform .15s cubic-bezier(.2,.9,.3,1.5),box-shadow .25s ease,filter .25s ease,background .2s ease,border-color .2s ease,color .2s ease}
.btn:active{transform:scale(.93)}
.btn.primary:hover{filter:brightness(1.13);box-shadow:0 6px 24px rgba(16,185,129,.42);transform:translateY(-2px)}
.btn.primary:active{transform:scale(.95)}
.side-link:hover{transform:translateX(5px)}
.chip:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 6px 16px rgba(2,6,23,.28)}

/* —— 对话消息与主题切换 —— */
.msg{animation:fadeUp .42s cubic-bezier(.22,.9,.35,1) both}
.theme-toggle{transition:transform .4s cubic-bezier(.2,.9,.3,1.7)}
.theme-toggle:hover{transform:rotate(40deg) scale(1.18)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
<script>
/* 滚动显现 v47：位移/缩放更大，逐项错落 */
document.addEventListener('DOMContentLoaded',function(){
  if(!('IntersectionObserver' in window)) return;
  try{
    var els=document.querySelectorAll('.card,.side-card,.calc-card,.wrong-item,.doc-card,.qcard,.learn-card,.banner,.stat-card,.tab');
    var fold=[];
    for(var i=0;i<els.length;i++){
      var r=els[i].getBoundingClientRect();
      if(r.top>window.innerHeight-60 && r.bottom>0){
        var d=(i%7)*55;
        els[i].style.opacity='0'; els[i].style.transform='translateY(46px) scale(.95)';
        els[i].style.transition='opacity .55s ease '+d+'ms,transform .7s cubic-bezier(.2,.9,.3,1.18) '+d+'ms';
        fold.push(els[i]);
      }
    }
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.style.opacity='1'; e.target.style.transform='none'; io.unobserve(e.target); } }); },{threshold:.08});
    fold.forEach(function(el){ io.observe(el); });
  }catch(e){}
});
</script>`;

const files = ['assistant.html', 'main.html', 'corpus.html', 'prep.html', 'knowledge.html'];
const re = /<\s*style\s*>\s*\/\* === ChemAI 全局美化 v46 === \*\/[\s\S]*?<\/script>(?=\s*<\/body>)/;

let anyFail = false;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (re.test(s)) {
    s = s.replace(re, v47);
    fs.writeFileSync(f, s, 'utf8');
    console.log(f + ': ✓ v46 → v47');
  } else {
    anyFail = true;
    console.log(f + ': ✗ 未找到 v46 块');
  }
}
// 验证
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const ok = s.includes('v47') && !s.includes('v46');
  console.log('  验证 ' + f + ': ' + (ok ? 'OK' : 'FAIL'));
}
console.log(anyFail ? '部分失败，请检查' : '全部完成');
