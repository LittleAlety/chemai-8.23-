/* bg-particles.js — 全站背景粒子氛围（v63.1）
 * 轻量 canvas：青色漂浮点 + 邻近连线，作为视口固定的环境层。
 * 落地页(index.html #particles)为 hero 内联版(64 个 + 鼠标交互)；
 * 这是内容页共享版：粒子更少(42)、无鼠标交互、z-index:-1 置于内容之后，
 * 避免在密集正文上产生遮挡/干扰。尊重 prefers-reduced-motion。
 *
 * 页面通过 <script src="assets/bg-particles.js" defer> 启用；设置
 * <body data-no-particles="1"> 可整页禁用。
 */
(function () {
  "use strict";
  var N = 42;        // 粒子数（落地页 64，内容页酌情减半）
  var LINK = 110;    // 连线距离阈值
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  function start() {
    var body = document.body;
    if (body.getAttribute("data-no-particles") === "1") return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    c.style.cssText = "position:fixed;inset:0;z-index:-1;pointer-events:none;";
    document.body.appendChild(c); // z-index:-1 → 置于内容/环境光斑之后

    var ctx = c.getContext("2d"), W = 0, H = 0, pts = [];

    function rs() {
      W = window.innerWidth; H = window.innerHeight;
      c.width = W * DPR; c.height = H * DPR;
      c.style.width = W + "px"; c.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function mk() {
      return { x: Math.random() * W, y: Math.random() * H,
               vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
               r: Math.random() * 1.5 + .6 };
    }

    function step() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < N; i++) {
        var p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      }
      ctx.lineWidth = 1;
      for (var i = 0; i < N; i++) {
        for (var j = i + 1; j < N; j++) {
          var a = pts[i], b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx.strokeStyle = "rgba(45,212,191," + ((1 - d / LINK) * .2).toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (var i = 0; i < N; i++) {
        var q = pts[i];
        ctx.fillStyle = "rgba(52,211,153,.55)";
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill();
      }
      requestAnimationFrame(step);
    }

    rs();
    while (pts.length < N) pts.push(mk());
    window.addEventListener("resize", function () { rs(); pts = []; while (pts.length < N) pts.push(mk()); });
    step();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
