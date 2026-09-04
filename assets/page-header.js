/* ===== ChemAI 统一页头：按身份切换副标题（六内容页共用）=====
   各页 .banner 加 data-page=<页key>，副标题 <p id="bannerSub">；本脚本按角色(chem-user.state.role)换文案。
   无角色默认 chemistry。 */
(function () {
  'use strict';
  var CONFIG = {
    main: {
      chemistry: '三草酸合铁酸钾制备实验手册 · 从原理、操作到表征的完整内容，按「课前/课中/课后」总览引导。',
      'non-chemistry': '用生活化的语言带你看懂这个实验的每一步，安全省心。',
      teacher: '教学参考 + 智能出题 + 报告评估，助力备课与学情掌握。'
    },
    prep: {
      chemistry: '进实验室前：AI 多轮对话测评定位薄弱 → 题库练习巩固 → 预习检测达标。',
      'non-chemistry': '轻松认识产物、了解步骤、避开安全坑，再做一次快速自测。',
      teacher: '课前组织预习：测评定薄弱 + 题库巩固 + 预习检测，掌握学情再进实验室。'
    },
    assistant: {
      chemistry: '深度检索 + 类比推理 + 置信度评分 + 自我检查，实验课随问随答。',
      'non-chemistry': '通俗解答「怎么做、为什么、要注意什么」，随时提问。',
      teacher: '授课辅助问答 + 多轮测评 + 可视化模板，课堂随问随答。'
    },
    knowledge: {
      chemistry: '把零散知识点连成网，薄弱环节可视定位、一键追问。',
      'non-chemistry': '一张趣味知识图，看看配合物与光化学由哪些概念连成。',
      teacher: '课堂演示知识关联，结合图谱讲解结构。'
    },
    corpus: {
      chemistry: '445 篇文献知识清单，深挖文献、持续更新知识库。',
      'non-chemistry': '',
      teacher: '文献资料 + 上传学习，持续丰富教学素材。'
    },
    generator: {
      chemistry: '教师组卷——基于站内题库，题型/难度/知识点可控，导出 Word/PDF。',
      'non-chemistry': '（教师专用）智能命题工具，需教师身份。',
      teacher: '智能组卷：试卷信息/题型分配/难度分布/知识点范围，一键导出 Word/PDF。'
    }
  };
  function getRole() {
    try { var o = JSON.parse(localStorage.getItem('chem-user')); return o && o.state ? o.state.role : null; } catch (e) { return null; }
  }
  function init() {
    var banner = document.querySelector('.banner[data-page]');
    if (!banner) return;
    var page = banner.getAttribute('data-page');
    var cfg = CONFIG[page];
    if (!cfg) return;
    var sub = document.getElementById('bannerSub');
    if (sub) {
      var r = getRole() || 'chemistry';
      var t = cfg[r] || cfg.chemistry;
      if (t) sub.textContent = t; else sub.style.display = 'none';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.PageHeader = { init: init, CONFIG: CONFIG };
})();
