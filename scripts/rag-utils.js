/**
 * ChemAI 共享 RAG 检索模块
 *
 * 统一 FAQ 匹配、BM25 检索、语料库检索和上下文构建等核心函数。
 * 所有函数接受数据作为参数（无全局状态），支持 Node.js 和浏览器双环境。
 *
 * 用法:
 *   Node.js:    const rag = require('./scripts/rag-utils');
 *   浏览器:     <script src="scripts/rag-utils.js"></script>  →  window.RagUtils
 *
 * 包含:
 *   - norm / kbTokens / readJSON — 文本处理基础设施
 *   - matchFAQ / createFAQIndex / matchFAQIndexed — FAQ 关键词+Bigram 匹配
 *   - createKBIndex / bm25MatchKB — BM25 知识库检索
 *   - createCorpusIndex / bm25MatchCorpus — 语料库 BM25 检索
 *   - corpusContext / buildContext — RAG 上下文构建
 *   - jaccardSimilarity / isDuplicateFAQ — 语义去重
 */

(function () {
  'use strict';

  // ===== 常量 =====

  const SUBMAP = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
    '⁻': '-', '⁺': '+'
  };

  const AMB = new Set([
    '℃', '°c', '40', '40℃', '100', '100℃', '0', '0℃',
    '20', '20℃', 'g', 'ml', 'mol', '%', 'h', 'ph',
    '水', '酸', '碱', '盐', '色', '热', '光',
    '铁', '氧', '氢', '碳'
  ]);

  const CHEATSHEET = [
    '莫尔盐M=392.14g/mol | 产物M=491.25g/mol | 标准5.0g莫尔盐→理论6.26g',
    '氧化40℃ | 结晶水失重110℃ | 草酸pKa1=1.25 pKa2=4.27',
    'H2O2 φ°=+1.77V | Fe3+/Fe2+ φ°=+0.771V',
    '[Fe(C2O4)3]3- lgKf≈20.2 | 高自旋d5 μeff≈5.92BM'
  ].join(' | ');

  // ===== 文本规范化 =====
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[₀₁₂₃₄₅₆₇₈₉⁻⁺]/g, function (c) { return SUBMAP[c] || c; })
      .replace(/\s+/g, '');
  }

  // ===== 读取 JSON（含 BOM 处理）=====
  function readJSON(fp) {
    var r;
    if (typeof fp === 'string') {
      // Node.js: file path
      var fs = typeof require === 'function' ? require('fs') : null;
      if (!fs) throw new Error('readJSON with file path requires Node.js');
      r = fs.readFileSync(fp, 'utf8');
    } else {
      // 浏览器: string content already loaded
      r = String(fp);
    }
    if (r.charCodeAt(0) === 0xFEFF) r = r.slice(1);
    return JSON.parse(r);
  }

  // ===== 中英混合分词器 =====
  function kbTokens(text) {
    var s = norm(String(text || ''));
    var out = [];
    var i = 0;
    while (i < s.length) {
      var c = s[i];
      if (/[一-鿿]/.test(c)) {
        var j = i;
        while (j < s.length && /[一-鿿]/.test(s[j])) j++;
        var run = s.slice(i, j);
        for (var k = 0; k < run.length - 1; k++) out.push(run.slice(k, k + 2));
        i = j;
      } else if (/[a-z0-9·+\-°℃%()\[\]⁺⁻]/.test(c)) {
        var j2 = i;
        while (j2 < s.length && /[a-z0-9·+\-°℃%()\[\]⁺⁻]/.test(s[j2])) j2++;
        var tk = s.slice(i, j2);
        if (tk.length >= 2 || /\d/.test(tk)) out.push(tk);
        i = j2;
      } else {
        i++;
      }
    }
    return out;
  }

  // ===== FAQ 匹配（O(n) 版本）=====
  function matchFAQ(question, faqEntries) {
    var nq = norm(question);
    var best = null, bestScore = 0;
    var qbg = new Set();
    for (var i = 0; i < nq.length - 1; i++) {
      qbg.add(nq.slice(i, i + 2));
    }
    for (var idx = 0; idx < faqEntries.length; idx++) {
      var f = faqEntries[idx];
      var kh = 0, sh = 0;
      var keys = f.keys || [];
      for (var ki = 0; ki < keys.length; ki++) {
        var nk = norm(keys[ki]);
        if (nk.length < 2 || AMB.has(nk)) continue;
        if (nq.indexOf(nk) !== -1) {
          kh++;
          if (nk.length >= 4) sh++;
        }
      }
      var eh = 0;
      var ents = f.ents || [];
      for (var ei = 0; ei < ents.length; ei++) {
        var ne = norm(ents[ei]);
        if (ne.length >= 2 && nq.indexOf(ne) !== -1) eh++;
      }
      var ft = norm((f.title || '') + ' ' + (f.answer || ''));
      var fbg = new Set();
      for (var fi = 0; fi < ft.length - 1; fi++) {
        fbg.add(ft.slice(fi, fi + 2));
      }
      var bg = 0;
      qbg.forEach(function (b) { if (fbg.has(b)) bg++; });
      var sc = kh * 3 + sh * 6 + eh * 8 + Math.min(bg * 0.4, 15);
      if ((kh >= 1 || eh >= 1 || bg >= 15) && sc >= bestScore) {
        bestScore = sc;
        best = f;
      }
    }
    return best;
  }

  // ===== FAQ 倒排索引 =====
  function createFAQIndex(faqEntries) {
    var idx = new Map();
    faqEntries.forEach(function (f, i) {
      var allKeys = (f.keys || []).concat(f.ents || [])
        .concat([f.title || '', f.subfield || '']);
      allKeys.forEach(function (k) {
        var nk = norm(k);
        if (nk.length >= 2 && !AMB.has(nk)) {
          if (!idx.has(nk)) idx.set(nk, new Set());
          idx.get(nk).add(i);
        }
      });
    });
    return idx;
  }

  function matchFAQIndexed(question, index, faqEntries) {
    var nq = norm(question);
    var scores = new Map();
    for (var i = 0; i < nq.length - 1; i++) {
      var bg = nq.slice(i, i + 2);
      if (AMB.has(bg)) continue;
      var ids = index.get(bg);
      if (ids) {
        ids.forEach(function (id) {
          scores.set(id, (scores.get(id) || 0) + 1);
        });
      }
    }
    index.forEach(function (ids, key) {
      if (key.length >= 3 && nq.indexOf(key) !== -1) {
        ids.forEach(function (id) {
          scores.set(id, (scores.get(id) || 0) + 3);
        });
      }
    });
    if (scores.size === 0) return null;
    var best = null, bestScore = 0;
    scores.forEach(function (sc, id) {
      if (sc > bestScore) {
        bestScore = sc;
        best = faqEntries[id];
      }
    });
    return bestScore >= 3 ? best : null;
  }

  // ===== BM25 知识库索引 =====
  function createKBIndex(kbEntries) {
    var docs = kbEntries.map(function (en) {
      var parts = [];
      kbTokens(en.topic || '').forEach(function (x) {
        parts.push(x, x, x);
      });
      kbTokens((en.keys || []).join(', ')).forEach(function (x) {
        parts.push(x, x);
      });
      kbTokens(en.answer || '').forEach(function (x) {
        parts.push(x);
      });
      var tf = {};
      parts.forEach(function (x) {
        tf[x] = (tf[x] || 0) + 1;
      });
      return { en: en, tf: tf, len: parts.length || 1 };
    });
    var df = {};
    var tot = 0;
    docs.forEach(function (d) {
      tot += d.len;
      for (var t in d.tf) df[t] = (df[t] || 0) + 1;
    });
    return {
      docs: docs,
      df: df,
      avgdl: tot / (docs.length || 1),
      N: docs.length
    };
  }

  function bm25MatchKB(question, index) {
    var qtoks = kbTokens(question).filter(function (t) {
      return t.length >= 2;
    });
    var nq = norm(question);
    var k1 = 1.5, b = 0.75;
    var arr = [];
    for (var di = 0; di < index.docs.length; di++) {
      var d = index.docs[di];
      var sc = 0;
      for (var ti = 0; ti < qtoks.length; ti++) {
        var t = qtoks[ti];
        var f = d.tf[t];
        if (!f) continue;
        var idf = Math.log(1 + (index.N - (index.df[t] || 0) + 0.5) / ((index.df[t] || 0) + 0.5));
        sc += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / index.avgdl));
      }
      var keys = d.en.keys || [];
      for (var ki = 0; ki < keys.length; ki++) {
        var nk = norm(keys[ki]);
        if (nk.length >= 3 && nq.indexOf(nk) !== -1) sc += 6;
      }
      var ents = d.en.ents || [];
      for (var ei = 0; ei < ents.length; ei++) {
        var nt = norm(ents[ei]);
        if (nt.length >= 2 && nq.indexOf(nt) !== -1) sc += 8;
      }
      if (sc <= 0) continue;
      arr.push({ en: d.en, score: sc });
    }
    if (!arr.length) return null;
    arr.sort(function (a, b2) { return b2.score - a.score; });
    if (arr[0].score < 3.0) return null;
    return {
      entry: arr[0].en,
      score: arr[0].score,
      second: arr[1] ? arr[1].en : null
    };
  }

  // ===== 语料库 BM25 索引 =====
  function createCorpusIndex(entries) {
    var docs = entries.map(function (en) {
      var parts = [];
      kbTokens(en.title || '').forEach(function (x) {
        parts.push(x, x, x);
      });
      kbTokens(en.abstract || '').forEach(function (x) {
        parts.push(x, x);
      });
      kbTokens(en.objects || '').forEach(function (x) {
        parts.push(x, x);
      });
      kbTokens(en.methods || '').forEach(function (x) {
        parts.push(x);
      });
      kbTokens((en.questions || []).join(' ')).forEach(function (x) {
        parts.push(x);
      });
      var tf = {};
      parts.forEach(function (x) {
        tf[x] = (tf[x] || 0) + 1;
      });
      return { en: en, tf: tf, len: parts.length || 1 };
    });
    var df = {};
    var tot = 0;
    docs.forEach(function (d) {
      tot += d.len;
      for (var t in d.tf) df[t] = (df[t] || 0) + 1;
    });
    return {
      docs: docs,
      df: df,
      avgdl: tot / (docs.length || 1),
      N: docs.length
    };
  }

  function bm25MatchCorpus(question, index, subfield) {
    var qtoks = kbTokens(question).filter(function (t) {
      return t.length >= 2;
    });
    var nq = norm(question);
    var k1 = 1.5, b = 0.75;
    var arr = [];
    for (var di = 0; di < index.docs.length; di++) {
      var d = index.docs[di];
      var sc = 0;
      for (var ti = 0; ti < qtoks.length; ti++) {
        var t = qtoks[ti];
        var f = d.tf[t];
        if (!f) continue;
        var idf = Math.log(1 + (index.N - (index.df[t] || 0) + 0.5) / ((index.df[t] || 0) + 0.5));
        sc += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / index.avgdl));
      }
      if (subfield && d.en.subfield === subfield) sc += 5;
      if (d.en.objects) {
        var nobj = norm(d.en.objects);
        if (nobj.length >= 2 && nq.indexOf(nobj) !== -1) sc += 4;
      }
      if (d.en.methods) {
        var nm = norm(d.en.methods);
        if (nm.length >= 2 && nq.indexOf(nm) !== -1) sc += 3;
      }
      var questions = d.en.questions || [];
      for (var qi = 0; qi < questions.length; qi++) {
        var nqq = norm(questions[qi]);
        if (nqq.length >= 4 && nq.indexOf(nqq.slice(0, 4)) !== -1) sc += 6;
      }
      if (sc <= 0) continue;
      arr.push({ en: d.en, score: sc });
    }
    if (!arr.length) return [];
    arr.sort(function (a, b2) { return b2.score - a.score; });
    if (arr[0].score < 2.5) return [];
    return arr.slice(0, 3);
  }

  // ===== 语料库上下文构建 =====
  function corpusContext(question, subfield, corpusIndex) {
    var matches = bm25MatchCorpus(question, corpusIndex, subfield);
    if (!matches.length) return '';
    return matches.map(function (m) {
      var e = m.en;
      var ctx = '【语料#' + e.id + ' · ' + (e.title || '').slice(0, 80) + '】';
      if (e.journal) ctx += '\n期刊: ' + e.journal + (e.volume ? ' Vol.' + e.volume : '') + (e.issue ? '(' + e.issue + ')' : '') + (e.pages ? ' pp.' + e.pages : '');
      if (e.doi) ctx += '\nDOI: ' + e.doi;
      if (e.abstract) ctx += '\n摘要: ' + e.abstract.slice(0, 400);
      if (e.objects) ctx += '\n研究对象: ' + e.objects;
      if (e.methods) ctx += '\n方法: ' + e.methods;
      return ctx;
    }).join('\n\n');
  }

  // ===== 完整 RAG 上下文构建 =====
  function buildContext(question, subfield, faqEntries, kbIndex, corpusIndex) {
    var parts = [];

    // 1) FAQ 检索
    var faqIdx = createFAQIndex(faqEntries);
    var faq = matchFAQIndexed(question, faqIdx, faqEntries) || matchFAQ(question, faqEntries);
    if (faq) {
      parts.push('【FAQ · ' + faq.title + '】\n' +
        (faq.answer || '') +
        (faq.detail ? '\n' + faq.detail : ''));
    }

    // 2) KB BM25 检索
    var m = bm25MatchKB(question, kbIndex);
    if (m) {
      parts.push('【KB · ' + m.entry.topic + '】\n' + (m.entry.answer || ''));
      if (m.second && m.second.topic) {
        parts.push('【KB补充 · ' + m.second.topic + '】\n' + (m.second.answer || ''));
      }
    }

    // 3) 语料库检索
    var ctx = corpusContext(question, subfield, corpusIndex);
    if (ctx) parts.push('【语料库文献】\n' + ctx);

    // 4) 实验关键参数
    parts.push('【实验关键参数】' + CHEATSHEET);

    return parts.join('\n\n---\n\n');
  }

  // ===== Jaccard 语义去重 =====
  function jaccardSimilarity(a, b) {
    var ka = new Set((a.keys || []).map(function (k) {
      return norm(k);
    }).filter(function (k) {
      return k.length >= 2 && !AMB.has(k);
    }));
    var kb2 = new Set((b.keys || []).map(function (k) {
      return norm(k);
    }).filter(function (k) {
      return k.length >= 2 && !AMB.has(k);
    }));
    if (ka.size === 0 && kb2.size === 0) return 0;
    var intersection = 0;
    ka.forEach(function (k) { if (kb2.has(k)) intersection++; });
    var union = ka.size + kb2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  function isDuplicateFAQ(newEntry, existingEntries, threshold) {
    var t = typeof threshold === 'number' ? threshold : 0.6;
    for (var i = 0; i < existingEntries.length; i++) {
      var existing = existingEntries[i];
      if (norm(existing.q || existing.title || '') === norm(newEntry.q || newEntry.title || '')) return true;
      if (jaccardSimilarity(newEntry, existing) > t) return true;
    }
    return false;
  }

  // ===== 导出 =====
  var api = {
    // 常量
    SUBMAP: SUBMAP,
    AMB: AMB,
    CHEATSHEET: CHEATSHEET,

    // 工具
    norm: norm,
    readJSON: readJSON,
    kbTokens: kbTokens,

    // FAQ 匹配
    matchFAQ: matchFAQ,
    createFAQIndex: createFAQIndex,
    matchFAQIndexed: matchFAQIndexed,

    // KB BM25
    createKBIndex: createKBIndex,
    bm25MatchKB: bm25MatchKB,

    // 语料库 BM25
    createCorpusIndex: createCorpusIndex,
    bm25MatchCorpus: bm25MatchCorpus,
    corpusContext: corpusContext,

    // RAG 上下文
    buildContext: buildContext,

    // 去重
    jaccardSimilarity: jaccardSimilarity,
    isDuplicateFAQ: isDuplicateFAQ
  };

  // Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  // 浏览器
  if (typeof window !== 'undefined') {
    window.RagUtils = api;
  }
})();
