/* =====================================================================
   ChemAI 网页研究员模块 —— 智能体集群的「网页调用 skill」
   ---------------------------------------------------------------------
   - 自包含：不依赖 assistant.html 的 IIFE 内变量，只读 window + 同源 data/
   - 职责：数据获取/检索/冲突校验；不做 DOM 渲染（渲染由 assistant.html 统一 esc 转义）
   - 源链（按权重）：站内题库/KG(同源) > PubChem > Wikipedia(zh/en) > Bing(CORS代理·实验性)
   - 应变：6s 超时 / 重试1次 / 源熔断(连续2次失败本会话停用5min) / 全败降级给链接兜底
   - 权威层级：实验讲义 > 文献 > 搜索 —— 网页结果仅供补充，冲突以讲义为准
   ===================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'chemai_agent_config';
  var FAIL_LIMIT = 2;          // 连续失败 N 次 → 熔断
  var BLOCK_MS = 5 * 60 * 1000; // 熔断时长
  var fails = {}, blockedUntil = {};

  /* ---------- 小工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[\s　]+/g, ''); }
  function stripTags(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function getLS() { try { return window.localStorage; } catch (e) { return null; } }
  function clone(o) { return o ? JSON.parse(JSON.stringify(o)) : o; }
  function mergeDeep(base, extra) {
    if (!extra) return base;
    Object.keys(extra).forEach(function (k) {
      var v = extra[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') mergeDeep(base[k], v);
      else if (v !== undefined) base[k] = v;
    });
    return base;
  }

  /* ---------- 配置（localStorage 持久化） ---------- */
  var DEFAULTS = {
    autoWebOnLow: true,        // 低置信度自动触发网页研究员
    supplementMedium: false,   // 中置信度追加网页补充（默认关，降噪）
    sources: { site: true, pubchem: true, wiki: true, bing: true }, // bing 走 CORS 代理，实验性
    skills: {                  // 集群专业技能（计算官/手册官/安全官/图谱官/视频官）
      enabled: true,           // 技能总开关
      auto: true,              // 自动模式：按问题类型自动派发
      calc: true, manual: true, safety: true, kg: true, video: true
    }
  };
  var _cfg = null;
  function getConfig() {
    if (_cfg) return _cfg;
    var ls = getLS(), saved = null;
    try { if (ls) saved = JSON.parse(ls.getItem(STORAGE_KEY) || 'null'); } catch (e) { /* ignore */ }
    _cfg = mergeDeep(clone(DEFAULTS), saved || {});
    return _cfg;
  }
  function setConfig(path, value) {
    var cfg = getConfig(), parts = String(path).split('.'), o = cfg;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = value;
    var ls = getLS();
    try { if (ls) ls.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
    return cfg;
  }

  /* ---------- 熔断器 ---------- */
  function isBlocked(key) { return blockedUntil[key] && Date.now() < blockedUntil[key]; }
  function noteFail(key) {
    fails[key] = (fails[key] || 0) + 1;
    if (fails[key] >= FAIL_LIMIT) { blockedUntil[key] = Date.now() + BLOCK_MS; }
  }
  function noteOk(key) { fails[key] = 0; }

  /* ---------- fetch：超时 + 重试 ---------- */
  function fetchWithTimeout(url, opts) {
    opts = opts || {};
    var ms = opts.timeout || 6000;
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r;
    }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }
  function fetchWithRetry(url, opts) {
    opts = opts || {};
    var retries = (opts.retries != null) ? opts.retries : 1;
    var attempt = 0;
    function tryOnce() {
      return fetchWithTimeout(url, opts).catch(function (e) {
        if (e.status === 404 || attempt >= retries) throw e; // 404=未收录，不重试
        attempt++;
        return new Promise(function (res) { setTimeout(res, 300); }).then(tryOnce);
      });
    }
    return tryOnce();
  }

  /* ---------- 源：站内题库 / 知识图谱 / 语料库（同源，最可靠） ---------- */
  var _siteCache = null, _sitePromise = null;
  function loadSiteData() {
    if (_sitePromise) return _sitePromise;
    _sitePromise = Promise.all([
      fetch('data/questions_bank.json').then(function (r) { if (!r.ok) throw new Error('qb'); return r.json(); }).catch(function () { return null; }),
      fetch('data/kg.json').then(function (r) { if (!r.ok) throw new Error('kg'); return r.json(); }).catch(function () { return null; }),
      fetch('data/corpus.json').then(function (r) { if (!r.ok) throw new Error('corpus'); return r.json(); }).catch(function () { return null; })
    ]).then(function (arr) {
      _siteCache = {
        questions: (arr[0] && arr[0].questions) || [],
        nodes: (arr[1] && arr[1].nodes) || [],
        corpus: (arr[2] && (arr[2].entries || arr[2])) || []
      };
      return _siteCache;
    });
    return _sitePromise;
  }
  function fetchSite(input) {
    return loadSiteData().then(function (cache) {
      var nq = norm(input.q);
      var kws = (input.kws || []).map(norm);
      var scored = [];
      cache.questions.forEach(function (q) {
        var qtext = norm(q.question || '');
        var text = norm((q.question || '') + ' ' + (q.category || '') + ' ' + (q.answer || '') + ' ' + (q.explanation || ''));
        var s = 0;
        if (nq && (text.indexOf(nq) >= 0 || qtext.indexOf(nq) >= 0)) s += 3;
        for (var i = 0; i < kws.length; i++) { if (kws[i] && text.indexOf(kws[i]) >= 0) s += 1; }
        if (s > 0) scored.push({ s: s, item: {
          sourceLabel: '站内题库', title: String(q.question || '').slice(0, 120),
          snippet: String(q.answer || q.referenceAnswer || '').slice(0, 200),
          fullText: String(q.answer || q.referenceAnswer || ''),
          url: '', badge: '站内题库', weight: 10, internal: true
        } });
      });
      cache.nodes.forEach(function (n) {
        var text = norm((n.name || '') + ' ' + (n.description || ''));
        var s = 0;
        if (nq && text.indexOf(nq) >= 0) s += 3;
        for (var i = 0; i < kws.length; i++) { if (kws[i] && text.indexOf(kws[i]) >= 0) s += 1; }
        if (s > 0) scored.push({ s: s, item: {
          sourceLabel: '知识图谱', title: 'KG·' + (n.name || ''),
          snippet: String(n.description || '').slice(0, 200),
          url: 'knowledge.html', badge: '站内知识图谱', weight: 9, internal: true
        } });
      });
      // 语料库（与正常路径同一 corpus.json，带 corpus.html?id 深链）
      cache.corpus.forEach(function (c) {
        var qtext = norm((c.questions || []).join(' '));
        var text = norm((c.title || '') + ' ' + (c.subfield || '') + ' ' + (c.objects || '') + ' ' + (c.methods || '') + ' ' + (c.abstract || '') + ' ' + qtext);
        var s = 0;
        if (nq && (text.indexOf(nq) >= 0 || qtext.indexOf(nq) >= 0)) s += 3;
        for (var i = 0; i < kws.length; i++) { if (kws[i] && text.indexOf(kws[i]) >= 0) s += 1; }
        if (s > 0) scored.push({ s: s, item: {
          sourceLabel: '站内语料', title: String(c.title || '').slice(0, 120),
          snippet: String((c.abstract || (c.questions && c.questions[0]) || '').slice(0, 200)),
          url: 'corpus.html?id=' + encodeURIComponent(String(c.id)),
          badge: '站内语料·#' + String(c.id), weight: 10, internal: true
        } });
      });
      scored.sort(function (a, b) { return b.s - a.s; });
      return { items: scored.slice(0, 6).map(function (x) { return x.item; }) };
    });
  }

  /* ---------- 源：PubChem（CORS 开放，检出试剂时） ---------- */
  function fetchPubChemName(name) {
    var base = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/' + encodeURIComponent(name);
    return fetchWithRetry(base + '/property/MolecularFormula,MolecularWeight,IUPACName/JSON', { timeout: 6000 })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var p = (j && j.PropertyTable && j.PropertyTable.Properties && j.PropertyTable.Properties[0]) || null;
        if (!p) return null;
        return {
          sourceLabel: 'PubChem', title: name + (p.MolecularFormula ? (' · ' + p.MolecularFormula) : ''),
          snippet: ['分子式 ' + (p.MolecularFormula || '—'), '摩尔质量 ' + (p.MolecularWeight ? p.MolecularWeight + ' g/mol' : '—'),
                    p.IUPACName ? ('IUPAC: ' + p.IUPACName) : ''].filter(Boolean).join('；'),
          url: 'https://pubchem.ncbi.nlm.nih.gov/compound/' + encodeURIComponent(String(p.CID || name)),
          badge: 'PubChem', weight: 8
        };
      });
  }
  function fetchPubChem(input) {
    var names = ((input.enChems || []).map(function (c) { return c.en; }).filter(Boolean));
    if (!names.length) names = (input.kws || []).slice(0, 1);
    if (!names.length) return Promise.resolve({ items: [] });
    names = names.slice(0, 2);
    return Promise.all(names.map(function (name) {
      return fetchPubChemName(name).then(function (it) { return { item: it }; }).catch(function (err) {
        if (err && err.status === 404) return { item: null }; // 未收录该化合物，非故障
        throw err;
      });
    })).then(function (list) {
      return { items: list.map(function (x) { return x.item; }).filter(Boolean) };
    });
  }

  /* ---------- 源：Wikipedia（zh/en，CORS origin=*） ---------- */
  function wikiSearch(lang, query) {
    var url = 'https://' + lang + '.wikipedia.org/w/api.php?action=query&list=search&srsearch='
      + encodeURIComponent(query) + '&format=json&origin=*&srlimit=5';
    return fetchWithRetry(url, { timeout: 6000 }).then(function (r) { return r.json(); }).then(function (j) {
      var res = (j && j.query && j.query.search) || [];
      if (!res.length) return null;
      var top = res[0], encTitle = encodeURIComponent(top.title);
      var sumUrl = 'https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/' + encTitle;
      return fetchWithRetry(sumUrl, { timeout: 6000 }).then(function (r) { return r.json(); }).then(function (s) {
        return {
          sourceLabel: '维基百科(' + (lang === 'zh' ? '中文' : 'English') + ')',
          title: (s && s.title) || top.title,
          snippet: stripTags((s && s.extract) || '').slice(0, 300),
          url: (s && s.content_urls && s.content_urls.desktop && s.content_urls.desktop.page)
               || ('https://' + lang + '.wikipedia.org/wiki/' + encTitle),
          badge: 'Wikipedia', weight: lang === 'zh' ? 6 : 7 // en 对该化合物覆盖更全
        };
      }).catch(function () {
        // 摘要接口失败则退用搜索结果片段
        return {
          sourceLabel: '维基百科(' + (lang === 'zh' ? '中文' : 'English') + ')',
          title: top.title, snippet: stripTags(top.snippet || '').slice(0, 300),
          url: 'https://' + lang + '.wikipedia.org/wiki/' + encTitle, badge: 'Wikipedia', weight: 6
        };
      });
    });
  }
  function fetchWiki(input) {
    var q = input.q || '';
    var enChems = (input.enChems || []).map(function (c) { return c.en; }).filter(Boolean);
    var tasks = [];
    if (q) tasks.push(wikiSearch('zh', q));
    if (enChems.length && enChems[0] !== q) tasks.push(wikiSearch('en', enChems[0]));
    if (!tasks.length) return Promise.resolve({ items: [] });
    return Promise.all(tasks.map(function (p) { return p.catch(function () { return null; }); })).then(function (list) {
      return { items: list.filter(Boolean) };
    });
  }

  /* ---------- 源：Bing（CORS 代理，实验性） ---------- */
  function bingViaProxy(targetUrl) {
    var proxies = ['https://api.allorigins.win/raw?url=', 'https://corsproxy.io/?url='];
    function tryProxy(i) {
      if (i >= proxies.length) return Promise.reject(new Error('proxies exhausted'));
      var url = proxies[i] + encodeURIComponent(targetUrl);
      return fetchWithTimeout(url, { timeout: 7000, retries: 0 }).then(function (r) { return r.text(); })
        .catch(function () { return tryProxy(i + 1); });
    }
    return tryProxy(0);
  }
  function fetchBing(input) {
    var q = input.q || '';
    if (!q) return Promise.resolve({ items: [] });
    var target = 'https://www.bing.com/search?q=' + encodeURIComponent(q);
    return bingViaProxy(target).then(function (html) {
      var items = [], re = /<li class="b_algo"[\s\S]*?<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?/g, m, n = 0;
      while ((m = re.exec(html)) !== null && n < 3) {
        var href = m[1], title = stripTags(m[2]), snip = stripTags(m[3] || '');
        if (/bing\.com|c\.bing/.test(href) || !/^https?:/.test(href)) continue;
        items.push({ sourceLabel: 'Bing·实验性', title: title.slice(0, 120), snippet: snip.slice(0, 250), url: href, badge: 'Bing', weight: 3, experimental: true });
        n++;
      }
      if (!items.length) throw new Error('bing parse empty');
      return { items: items };
    });
  }

  /* ---------- 源注册表 ---------- */
  var SOURCES = [
    { key: 'site', label: '站内资料', weight: 10, run: fetchSite },
    { key: 'pubchem', label: 'PubChem', weight: 8, run: fetchPubChem },
    { key: 'wiki', label: '维基百科', weight: 6, run: fetchWiki },
    { key: 'bing', label: 'Bing·实验性', weight: 3, run: fetchBing, experimental: true }
  ];

  /* ---------- 去重 + 排序 ---------- */
  function dedupe(items) {
    var seen = {}, out = [];
    items.forEach(function (it) {
      var key = (it.url || (it.source + '|' + (it.title || ''))).toLowerCase().replace(/\s+/g, '');
      if (!key) key = 'k' + Math.random().toString(36).slice(2);
      if (seen[key]) return;
      seen[key] = 1; out.push(it);
    });
    return out;
  }
  function score(items, q, kws) {
    var nq = norm(q);
    items.forEach(function (it) {
      var text = norm((it.title || '') + ' ' + (it.snippet || ''));
      var hits = 0;
      (kws || []).forEach(function (k) { if (k && text.indexOf(norm(k)) >= 0) hits++; });
      if (nq && text.indexOf(nq) >= 0) hits += 1;
      it._rank = (it.weight || 0) + hits * 1.5;
    });
    return items;
  }

  /* ---------- 主入口 research() ---------- */
  function research(input, opts) {
    opts = opts || {};
    var cfg = getConfig();
    var q = String((input && input.q) || '');
    var kws = (input && input.kws) || [];
    var enChems = (input && input.enChems) || [];
    var t0 = Date.now();
    var stats = { attempted: [], ok: [], failed: [], blocked: [], skipped: [], results: 0, ms: 0 };
    var tasks = [];
    SOURCES.forEach(function (src) {
      if (!cfg.sources[src.key]) { stats.skipped.push(src.key); return; }
      if (isBlocked(src.key)) { stats.blocked.push(src.key); return; }
      stats.attempted.push(src.key);
      tasks.push(src.run({ q: q, kws: kws, enChems: enChems }, opts).then(function (res) {
        var list = ((res && res.items) || []).slice(0);
        list.forEach(function (it) {
          it.source = src.key;
          if (it.sourceLabel == null) it.sourceLabel = src.label;
          if (it.weight == null) it.weight = src.weight;
          if (src.experimental) it.experimental = true;
        });
        noteOk(src.key);
        return { key: src.key, list: list };
      }).catch(function (err) {
        noteFail(src.key);
        stats.failed.push(src.key);
        return { key: src.key, list: [] };
      }));
    });
    return Promise.all(tasks).then(function (outs) {
      var all = [];
      outs.forEach(function (o) { if (o.list && o.list.length) { stats.ok.push(o.key); all = all.concat(o.list); } });
      all = dedupe(all); all = score(all, q, kws);
      all.sort(function (a, b) { return (b._rank || 0) - (a._rank || 0); });
      var max = opts.maxResults || 6;
      if (all.length > max) all = all.slice(0, max);
      all.forEach(function (it) { delete it._rank; });
      var snippets = all.map(function (it) { return [it.snippet, it.fullText].filter(Boolean).join('\n'); }).join('\n');
      var conflicts = webCrossCheck(q, snippets);
      stats.results = all.length; stats.ms = Date.now() - t0;
      return { ok: all.length > 0, results: all, conflicts: conflicts, stats: stats };
    });
  }

  /* ---------- 网页事实 vs 讲义权威 冲突校验 ---------- */
  var AUTHORITY_RULES = [
    { re: /30\s*%\s*(h2o2|双氧水|过氧化氢)/i, warn: '网页资料提及 30% H₂O₂；本实验（武汉大学讲义）使用 6% H₂O₂（30% 需稀释），以讲义为准。' },
    { re: /氧化[^\n。;；]{0,12}(60|80|100)\s*[℃度]/, warn: '网页资料称氧化阶段温度 60/80/100℃；讲义规定 40℃ 水浴（过高会加速 H₂O₂ 分解），以讲义为准。' },
    { re: /(烘干|干燥|烘箱)[^\n。;；]{0,14}11[0-5]\s*[℃度]|11[0-5]\s*[℃度][^\n。;；]{0,12}(烘干|干燥|烘箱)/, warn: '网页资料称烘干温度 110℃；本实验产物烘干为 50℃（110℃ 会使产物脱水变质），以讲义为准。' },
    { re: /失(去|掉)?\s*结晶水[^\n。;；]{0,14}11[0-5]\s*[℃度]/, warn: '网页资料称失结晶水温度 110/113℃；讲义规定约 100℃（70-100℃，理论失重 11.0%），以讲义为准。' },
    { re: /(h(?:₂|2)o(?:₂|2)|双氧水|过氧化氢)[^\n。;；]{0,12}10\s*ml|10\s*ml[^\n。;；]{0,12}(h(?:₂|2)o(?:₂|2)|双氧水|过氧化氢)/i, warn: '网页资料称 H₂O₂ 用量约 10mL；本实验（讲义）以 5.0g 莫尔盐为基准约 8mL，以讲义为准。' },
    { re: /配位数\s*[为是约]?\s*[4四]|(^|[^非不])[4四]\s*配位|四配位/, warn: '网页资料称配位数为 4；草酸根为双齿配体，[Fe(C₂O₄)₃]³⁻ 配位数为 6，以讲义为准。' },
    { re: /产率.{0,10}(以|用).{0,4}草酸|基准.{0,6}草酸/, warn: '网页资料称产率以草酸为基准；本实验以莫尔盐为基准（Fe 元素守恒），以讲义为准。' },
    { re: /fe\s*\(?\s*oh\s*\)?\s*2.{0,20}(7\.5|7\.6|7\.8|≈\s*7|约\s*7)/i, warn: '网页资料称 Fe(OH)₂ 沉淀 pH≈7.5；实际约 6.3（Ksp≈8×10⁻¹⁶），以讲义为准。' },
    { re: /氯(离子|化物)[^\n。;；]{0,8}杂质|杂质[^\n。;；]{0,8}氯(离子|化物)/, warn: '网页资料提到氯离子杂质；本体系铁源为莫尔盐，可溶性杂质为 K₂SO₄/(NH₄)₂SO₄/K₂C₂O₄，无氯离子，以讲义为准。' }
  ];
  function webCrossCheck(q, snippets) {
    var text = String(snippets || '');
    var conflicts = [];
    AUTHORITY_RULES.forEach(function (rule) { if (rule.re.test(text)) conflicts.push(rule.warn); });
    return conflicts;
  }

  /* ---------- 集群状态面板 HTML（模块生成，IIFE 负责注入与事件刷新） ---------- */
  function sourceStatusHTML() {
    var cfg = getConfig();
    return SOURCES.map(function (src) {
      var on = cfg.sources[src.key];
      var st = 'off';
      if (on) st = isBlocked(src.key) ? 'blocked' : (src.experimental ? 'exp' : 'on');
      var cls = st === 'blocked' ? 'st-blocked' : (st === 'on' ? 'st-on' : (st === 'exp' ? 'st-exp' : 'st-off'));
      return '<div class="ast-row"><span class="ast-dot ' + cls + '"></span>'
        + '<span class="ast-name">' + esc(src.label) + (src.experimental ? '（实验性）' : '') + '</span>'
        + '<label class="ast-sw"><input type="checkbox" data-src="' + src.key + '"'
        + (on ? ' checked' : '') + ' onchange="AgentCluster.setConfig(\'sources.' + src.key + '\',this.checked)">'
        + esc(on ? '开' : '关') + '</label></div>';
    }).join('');
  }
  function skillsStatusHTML() {
    var cfg = getConfig(), s = cfg.skills || {};
    function chk(path, on, label) {
      return '<div class="ast-row"><span class="ast-name">' + label + '</span>'
        + '<label class="ast-sw"><input type="checkbox" data-sk="' + path + '"' + (on ? ' checked' : '')
        + ' onchange="AgentCluster.setConfig(\'' + path + '\',this.checked)"></label></div>';
    }
    return '<div class="ast-title" style="margin-top:8px">🧰 集群技能</div>'
      + chk('skills.enabled', s.enabled, '技能总开关')
      + chk('skills.auto', s.auto, '自动模式（按题派发）')
      + chk('skills.calc', s.calc, '🧮 计算官')
      + chk('skills.manual', s.manual, '📚 手册官')
      + chk('skills.safety', s.safety, '🔬 安全官')
      + chk('skills.kg', s.kg, '📊 图谱官')
      + chk('skills.video', s.video, '🎥 视频官')
      + '<div class="ast-muted">自动模式关：技能不自动派发，由每条回答的「🧰 运行技能」按钮手动触发；总开关关：仅核心流水线 + 网页研究。</div>';
  }
  function getStateHTML() {
    var cfg = getConfig();
    var rows = sourceStatusHTML();
    var extra = '<div class="ast-row"><span class="ast-name">低置信度自动联网</span>'
      + '<label class="ast-sw"><input type="checkbox" data-cfg="autoWebOnLow"' + (cfg.autoWebOnLow ? ' checked' : '')
      + ' onchange="AgentCluster.setConfig(\'autoWebOnLow\',this.checked)"></label></div>'
      + '<div class="ast-row"><span class="ast-name">中置信度补充检索</span>'
      + '<label class="ast-sw"><input type="checkbox" data-cfg="supplementMedium"' + (cfg.supplementMedium ? ' checked' : '')
      + ' onchange="AgentCluster.setConfig(\'supplementMedium\',this.checked)"></label></div>';
    return '<div class="ast-panel"><div class="ast-title">🛰 集群状态 · 网页源</div>'
      + rows + extra + skillsStatusHTML()
      + '<div class="ast-muted">网络资料权威层级：实验讲义 &gt; 文献 &gt; 搜索；网页结果仅供补充，与讲义冲突时以讲义为准。Bing 源经第三方代理，仅作实验性探索。</div></div>';
  }

  /* ---------- 技能：🧮 计算官（确定性定量计算） ---------- */
  var ATOMIC_MASS = {H:1.008,He:4.003,Li:6.94,Be:9.012,B:10.81,C:12.011,N:14.007,O:15.999,F:18.998,Ne:20.18,Na:22.99,Mg:24.305,Al:26.982,Si:28.085,P:30.974,S:32.06,Cl:35.45,K:39.098,Ca:40.078,Sc:44.956,Ti:47.867,V:50.942,Cr:51.996,Mn:54.938,Fe:55.845,Co:58.933,Ni:58.693,Cu:63.546,Zn:65.38,Ga:69.723,As:74.922,Se:78.96,Br:79.904,Sr:87.62,Y:88.906,Zr:91.224,Mo:95.95,Ag:107.868,Cd:112.414,In:114.818,Sn:118.71,Sb:121.76,Te:127.6,I:126.904,Ba:137.327,La:138.905,Ce:140.116,W:183.84,Pt:195.084,Au:196.967,Hg:200.592,Pb:207.2,Bi:208.98,Th:232.038,U:238.029};
  var KNOWN_MASS = {
    '(NH4)2Fe(SO4)2·6H2O':392.14,'硫酸亚铁铵':392.14,'莫尔盐':392.14,'摩尔盐':392.14,
    'H2C2O4·2H2O':126.07,'草酸二水合物':126.07,'草酸':90.03,'H2C2O4':90.03,
    'FeC2O4·2H2O':179.90,'草酸亚铁':143.87,'FeC2O4':143.87,
    'K2C2O4·H2O':184.24,'草酸钾一水合物':184.24,'K2C2O4':166.22,
    'K3[Fe(C2O4)3]·3H2O':491.25,'三草酸合铁酸钾':491.25,'产物':491.25,
    'K3[Fe(C2O4)3]':437.20,'H2O2':34.01,'H2O':18.02,'CO2':44.01,'CO':28.01,
    'C2H5OH':46.07,'乙醇':46.07,'H2SO4':98.08,'Fe2O3':159.69,'K2CO3':138.21,
    'Fe(OH)3':106.87,'FeSO4':151.91,'KMnO4':158.03,'K3[Fe(CN)6]':329.24,'(NH4)2SO4':132.14
  };
  function formulaMass(f) {
    var s = String(f || '').replace(/\s+/g, '').replace(/·/g, '.').replace(/[+\-]+\d*[+\-]?$/, '');
    var total = 0, i = 0, n = s.length, mult = [1];
    function digits(k) { var j = k; while (j < n && s[j] >= '0' && s[j] <= '9') j++; return j; }
    while (i < n) {
      var c = s[i];
      if (c === '(' || c === '[') { mult.push(mult[mult.length - 1]); i++; }
      else if (c === ')' || c === ']') {
        var e = digits(i + 1); var num = (e > i + 1) ? parseFloat(s.slice(i + 1, e)) : 1;
        mult.pop(); mult[mult.length - 1] *= num; i = e;
      }
      else if (c >= 'A' && c <= 'Z') {
        var el = c, j = i + 1;
        if (j < n && s[j] >= 'a' && s[j] <= 'z') { el += s[j]; j++; }
        var e2 = digits(j); var cnt = (e2 > j) ? parseFloat(s.slice(j, e2)) : 1;
        var m = ATOMIC_MASS[el]; if (m) total += m * cnt * mult[mult.length - 1];
        i = e2;
      } else { i++; }
    }
    return total;
  }
  function molarMassOf(term) {
    var key = norm(term);
    if (KNOWN_MASS[term]) return KNOWN_MASS[term];
    for (var k in KNOWN_MASS) if (norm(k) === key) return KNOWN_MASS[k];
    // 提取公式形态（含元素+数字+括号）
    var fm = String(term || '').match(/[A-Z][a-z]?[\d\.·\[\]\(\)A-Za-z]*/);
    if (fm) { var m = formulaMass(fm[0]); if (m > 10) return m; }
    return null;
  }
  function calcSkill(q) {
    var t = String(q || '');
    var out = { matched: false, type: '', title: '', lines: [], formula: '', note: '' };
    // ① 产率
    if (/产率|收率|百分产率/.test(t)) {
      out.matched = true; out.type = 'yield'; out.title = '🧮 产率计算';
      var nums = (t.match(/(\d+(?:\.\d+)?)\s*(g|克)/g) || []).map(function (x) { return parseFloat(x); });
      var actual = null, theory = null;
      nums.forEach(function (n) { if (n > 0.5 && n < 15) { if (actual === null && /实际|得到|得|回收/.test(t) === false) theory = n; } });
      // 5.0g 莫尔盐 → 理论 6.26g；若提莫尔盐质量则算理论产量
      var salt = (t.match(/(\d+(?:\.\d+)?)\s*g\s*(莫尔盐|摩尔盐|硫酸亚铁铵)/) || [])[1];
      if (salt) theory = parseFloat(salt) * 491.25 / 392.14;
      var actualM = (t.match(/(\d+(?:\.\d+)?)\s*g\s*(产物|晶体|实际|最后)/) || [])[1];
      if (actualM) actual = parseFloat(actualM);
      out.formula = '产率(%) = 实际产量 ÷ 理论产量 × 100%';
      if (actual && theory) {
        var y = actual / theory * 100;
        out.lines.push('实际 ' + actual.toFixed(2) + ' g ÷ 理论 ' + theory.toFixed(2) + ' g × 100% = ' + y.toFixed(1) + '%');
      } else if (theory) {
        out.lines.push('以莫尔盐为基准（Fe 守恒），1 mol 莫尔盐 → 1 mol 产物。');
        out.lines.push('理论产量 = m(莫尔盐) × 491.25/392.14 = ' + theory.toFixed(2) + ' g');
        out.lines.push('产率 = 实际产量 ÷ ' + theory.toFixed(2) + ' × 100%');
      } else {
        out.lines.push('以莫尔盐（限量试剂）为基准：1 mol 莫尔盐 → 1 mol 产物。');
        out.lines.push('理论产量 = m(莫尔盐) × 491.25/392.14；产率 = 实际产量/理论产量 × 100%。');
        out.note = '标准例：5.0 g 莫尔盐 → 理论 6.26 g，正常产率 50-70%。';
      }
      return out;
    }
    // ② 摩尔质量
    var mm = t.match(/摩尔质量|分子量|相对分子质量|M\s*(?:\(|=)/);
    if (mm || /K3\[Fe|Fe\(C2O4|莫尔盐|三草酸/.test(t)) {
      var known = null, kname = '';
      ['三草酸合铁酸钾','K3[Fe(C2O4)3]·3H2O','莫尔盐','(NH4)2Fe(SO4)2·6H2O','草酸','H2C2O4','草酸亚铁','K2C2O4','乙醇'].forEach(function (k) {
        if (!known && t.indexOf(k) >= 0) { known = molarMassOf(k); kname = k; }
      });
      if (known) {
        out.matched = true; out.type = 'mass'; out.title = '🧮 摩尔质量';
        out.formula = 'M(' + kname + ') = ' + known.toFixed(2) + ' g/mol';
        out.lines.push('由原子量加和求得：M = ' + known.toFixed(2) + ' g/mol。');
        out.note = '常见：莫尔盐 392.14；产物 K3[Fe(C2O4)3]·3H2O 491.25。';
        return out;
      }
    }
    // ③ 溶液配制 m=c·V·M
    var sol = t.match(/配制|称取|需要.*g/);
    if (sol) {
      var n3 = (t.match(/(\d+(?:\.\d+)?)/g) || []).map(parseFloat);
      if (n3.length >= 3) {
        out.matched = true; out.type = 'prepare'; out.title = '🧮 溶液配制';
        out.formula = 'm = c × V × M';
        out.lines.push('需要溶质质量 = ' + n3[0] + ' mol/L × ' + n3[1] + ' L × ' + n3[2] + ' g/mol = ' + (n3[0]*n3[1]*n3[2]).toFixed(2) + ' g');
        return out;
      }
    }
    return out;
  }

  /* ---------- 技能：📚 手册官（实验讲义检索） ---------- */
  var _manualCache = null, _manualPromise = null;
  function loadManual() {
    if (_manualPromise) return _manualPromise;
    _manualPromise = fetch('data/manual.json').then(function (r) { if (!r.ok) throw new Error('manual'); return r.json(); }).then(function (j) {
      var sections = [];
      (j.chapters || []).forEach(function (ch) {
        (ch.sections || []).forEach(function (s) {
          sections.push({ ch: ch.title || ch.id, title: s.title || s.id, id: s.id, keywords: (s.keywords || []).join(' '), content: s.content || '', source: s.source || '' });
        });
      });
      _manualCache = sections;
      return _manualCache;
    });
    return _manualPromise;
  }
  function manualSkill(q, kws) {
    return loadManual().then(function (sections) {
      var nq = norm(q);
      var nk = (kws || []).map(norm);
      var scored = [];
      sections.forEach(function (s) {
        var text = norm((s.title || '') + ' ' + (s.keywords || '') + ' ' + (s.ch || ''));
        var sc = 0;
        if (nq && (text.indexOf(nq) >= 0 || norm(s.content || '').indexOf(nq) >= 0)) sc += 3;
        for (var i = 0; i < nk.length; i++) { if (nk[i] && text.indexOf(nk[i]) >= 0) sc += 1; }
        if (sc > 0) scored.push({ sc: sc, s: s });
      });
      scored.sort(function (a, b) { return b.sc - a.sc; });
      var top = scored.slice(0, 2).map(function (x) {
        var c = String(x.s.content || '');
        var snip = c.slice(0, 220) + (c.length > 220 ? '…' : '');
        return { ch: x.s.ch, title: x.s.title, id: x.s.id, snippet: snip, source: x.s.source };
      });
      return { matched: top.length > 0, items: top };
    });
  }

  /* ---------- 技能：🔬 安全官（安全规则 + MSDS 入口） ---------- */
  var SAFETY_FACTS = [
    { chem: '草酸', hazard: '有毒：吸入/误服危害健康，刺激皮肤眼睛', advice: '戴手套护目镜、通风操作，避免皮肤接触' },
    { chem: '过氧化氢', hazard: '腐蚀性 + 强氧化性：接触皮肤刺激，高温分解放氧', advice: '戴护目镜手套、防飞溅，远离热源；本实验用 6%' },
    { chem: '乙醇', hazard: '易燃、挥发性', advice: '远离明火，通风处操作' },
    { chem: '三草酸合铁', hazard: '产物低毒，光敏易分解', advice: '避光（棕色瓶）保存' },
    { chem: '废液', hazard: '含铁 + 草酸盐属重金属废液', advice: '严禁直排下水道，倒入专用回收桶（加碱中和沉淀后处置）' }
  ];
  function safetySkill(q, chems) {
    var t = String(q || '');
    var safetyIntent = /安全|废液|防护|危险|中毒|腐蚀|易燃|泄露|应急|手套|护目镜|通风|回收|危害/.test(t);
    var chemsList = (chems || []).map(function (c) { return c.name || ''; });
    var matched = safetyIntent || chemsList.length > 0;
    if (!matched) return { matched: false, items: [] };
    var items = SAFETY_FACTS.filter(function (f) {
      for (var i = 0; i < chemsList.length; i++) { if (f.chem.length >= 2 && chemsList[i].indexOf(f.chem.slice(0, 2)) >= 0) return true; }
      return t.indexOf(f.chem) >= 0;
    });
    if (!items.length) items = SAFETY_FACTS.slice(0, 4);
    return { matched: true, items: items };
  }

  /* ---------- 技能：📊 图谱官（知识图谱节点） ---------- */
  var _kgCache = null, _kgPromise = null;
  function loadKG() {
    if (_kgPromise) return _kgPromise;
    _kgPromise = fetch('data/kg.json').then(function (r) { if (!r.ok) throw new Error('kg'); return r.json(); }).then(function (j) {
      _kgCache = (j.nodes || []);
      return _kgCache;
    });
    return _kgPromise;
  }
  function kgSkill(q, kws) {
    return loadKG().then(function (nodes) {
      var nq = norm(q), nk = (kws || []).map(norm);
      var scored = [];
      nodes.forEach(function (n) {
        var text = norm((n.name || '') + ' ' + (n.description || '') + ' ' + (n.subfield || ''));
        var sc = 0;
        if (nq && (text.indexOf(nq) >= 0)) sc += 3;
        for (var i = 0; i < nk.length; i++) { if (nk[i] && text.indexOf(nk[i]) >= 0) sc += 1; }
        if (sc > 0) scored.push({ sc: sc, n: n });
      });
      scored.sort(function (a, b) { return b.sc - a.sc; });
      var top = scored.slice(0, 3).map(function (x) {
        return { name: x.n.name, category: x.n.category, description: String(x.n.description || '').slice(0, 150), url: 'knowledge.html' };
      });
      return { matched: top.length > 0, items: top };
    });
  }

  /* ---------- 技能：🎥 视频官（操作检测 → 视频推荐关键词） ---------- */
  var OP_VIDEO_MAP = [
    { op: '抽滤', kw: '抽滤操作' }, { op: '减压过滤', kw: '减压过滤' }, { op: '过滤', kw: '减压过滤' },
    { op: '重结晶', kw: '重结晶' }, { op: '结晶', kw: '重结晶' },
    { op: '滴定', kw: '滴定操作' }, { op: '氧化', kw: '制备' }, { op: '避光', kw: '制备' },
    { op: '干燥', kw: '制备' }, { op: '洗涤', kw: '制备' }
  ];
  function videoSkill(q, ops) {
    var t = String(q || '');
    var opsList = (ops || []).slice();
    OP_VIDEO_MAP.forEach(function (v) { if (t.indexOf(v.op) >= 0 && opsList.indexOf(v.op) < 0) opsList.push(v.op); });
    if (!opsList.length) return { matched: false, items: [] };
    var items = OP_VIDEO_MAP.filter(function (v) { return opsList.indexOf(v.op) >= 0; })
      .map(function (v) { return { op: v.op, kw: v.kw }; });
    return { matched: true, items: items };
  }

  /* ---------- 导出 ---------- */
  if (!window.AgentCluster) {
    window.AgentCluster = {
      getConfig: getConfig,
      setConfig: setConfig,
      research: research,
      webCrossCheck: function (q, s) { return webCrossCheck(q, s); },
      getStateHTML: getStateHTML,
      isBroken: isBlocked,
      esc: esc,
      skills: {
        calc: calcSkill,
        manual: manualSkill,
        safety: safetySkill,
        kg: kgSkill,
        video: videoSkill,
        molarMass: molarMassOf
      }
    };
  }
})();
