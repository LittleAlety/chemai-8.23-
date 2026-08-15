'use strict';
/** v46 全局版面美化：向 5 页注入统一增强样式 + 滚动显现（安全，无 JS 时内容始终可见） */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PAGES = ['assistant.html', 'main.html', 'corpus.html', 'prep.html', 'knowledge.html'];

const BLOCK = `<style>
/* === ChemAI 全局美化 v46 === */
::selection{background:rgba(16,185,129,.22)}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(148,163,184,.22);border-radius:6px;border:2px solid transparent;background-clip:content-box}
::-webkit-scrollbar-thumb:hover{background:rgba(148,163,184,.42);background-clip:content-box;border:2px solid transparent}
.card,.side-card,.calc-card,.wrong-item,.doc-card,.qcard,.learn-card{transition:transform .28s cubic-bezier(.2,.8,.3,1),box-shadow .28s ease,border-color .28s ease}
.card:hover,.side-card:hover,.calc-card:hover,.wrong-item:hover,.doc-card:hover,.qcard:hover,.learn-card:hover{transform:translateY(-2px);border-color:var(--bd2,rgba(148,163,184,.18));box-shadow:0 10px 30px rgba(2,6,23,.14)}
.btn.primary:hover{filter:brightness(1.08);box-shadow:0 4px 16px rgba(16,185,129,.25)}
.side-link:hover{transform:translateX(3px)}
.chip:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(2,6,23,.2)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
<script>
/* 滚动显现（安全：仅对首屏以下元素，无 IntersectionObserver 时不影响） */
document.addEventListener('DOMContentLoaded',function(){
  if(!('IntersectionObserver' in window)) return;
  try{
    var els=document.querySelectorAll('.card,.side-card,.calc-card,.wrong-item,.doc-card,.qcard,.learn-card,.banner');
    var fold=[];
    for(var i=0;i<els.length;i++){
      var r=els[i].getBoundingClientRect();
      if(r.top>window.innerHeight-60 && r.bottom>0){
        els[i].style.opacity='0'; els[i].style.transform='translateY(18px)';
        els[i].style.transition='opacity .6s ease,transform .6s cubic-bezier(.2,.8,.3,1)';
        fold.push(els[i]);
      }
    }
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.style.opacity='1'; e.target.style.transform='none'; io.unobserve(e.target); } }); },{threshold:.06});
    fold.forEach(function(el){ io.observe(el); });
  }catch(e){}
});
</script>
`;

for (const f of PAGES) {
  const fp = path.join(ROOT, f);
  let s = fs.readFileSync(fp, 'utf8');
  if (s.includes('ChemAI 全局美化 v46')) { console.log('已注入，跳过 ' + f); continue; }
  const idx = s.lastIndexOf('</body>');
  if (idx < 0) { console.error('❌ ' + f + ' 未找到 </body>'); process.exit(1); }
  s = s.slice(0, idx) + BLOCK + s.slice(idx);
  fs.writeFileSync(fp, s, 'utf8');
  console.log('✓ ' + f);
}
console.log('完成');
