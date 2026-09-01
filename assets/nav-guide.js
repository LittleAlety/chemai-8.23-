/* ============================================================
   nav-guide.js —— 全站「阶段指示」+ logo 小字（返回主页）
   由各静态页 <script defer> 共享加载。defer 脚本在 DOM 解析后、DOMContentLoaded 前执行，
   因此可直接查询/增改 DOM，与各页内联 IIFE 无时序冲突。
   ============================================================ */
(function(){
"use strict";

/* 模块 → 阶段（按 href 正则命中；首页链接 index.html / main.html 不加 chip） */
var PHMAP=[
  {re:/assistant\.html/,  ph:'mid',  label:'课中'},     /* AI助手（课中随问随答） */
  {re:/knowledge\.html/,  ph:'post', label:'课后'},     /* 知识图谱（课后查漏补缺） */
  {re:/prep\.html/,       ph:'pre',  label:'课前'},     /* 课前预习（对话测评/题库/错题本） */
  {re:/#\/videos/,        ph:'pre',  label:'课前'},     /* 视频资源（课前看操作演示） */
  {re:/#\/report/,        ph:'post', label:'课后'},     /* 报告评估（课后·教师） */
  {re:/generator\.html/,  ph:'pre',  label:'课前'},     /* 智能命题（教师课前组卷） */
  {re:/corpus\.html/,     ph:'post', label:'课后'},     /* 语料库（课后深挖文献） */
  {re:/#\/explore/,       ph:'pre',  label:'课前'}      /* 科普探索（课前兴趣·非化学） */
];
function phOf(href){for(var i=0;i<PHMAP.length;i++)if(PHMAP[i].re.test(href||''))return PHMAP[i];return null;}

/* 1) 导航链接阶段胶囊 */
(function(){
  var links=document.querySelectorAll('.nav-links a');
  for(var i=0;i<links.length;i++){
    var m=phOf(links[i].getAttribute('href'));
    if(!m)continue;
    var s=document.createElement('span');
    s.className='nav-ph';s.setAttribute('data-ph',m.ph);
    s.innerHTML='<i></i>'+m.label;
    links[i].appendChild(s);
  }
})();

/* 2) logo：小字改为「返回主页」（替换化学式副标，缩短导航宽度避免挤占；无则建一个） */
(function(){
  var logo=document.querySelector('.navbar a.logo, #landing a.logo');
  if(!logo)return;
  var sub=logo.querySelector('.logo-sub');
  if(!sub){sub=document.createElement('div');sub.className='logo-sub';logo.appendChild(sub);}
  sub.textContent='返回主页';
})();

/* 3) 「🧭 怎么用」按钮：data-href 以 # 开头 → 页内平滑滚动；否则跳转 */
(function(){
  var btns=document.querySelectorAll('.path-btn');
  for(var i=0;i<btns.length;i++){(function(b){
    b.addEventListener('click',function(){
      var h=b.getAttribute('data-href');
      if(!h)return;
      if(h.charAt(0)==='#'){
        var el=document.getElementById(h.slice(1));
        if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
      }else location.href=h;
    });
  })(btns[i]);}
})();
})();
