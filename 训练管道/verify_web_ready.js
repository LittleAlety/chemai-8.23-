'use strict';
/**
 * ChemAI 外层守卫 · 网页可实现性校验
 *
 * 大循环（外层）的"检查是否能在网页上实现"步骤：验证运行时 FAQ 作为
 * 浏览器(assistant.html fetch) 与 无头(local_answer.js readFAQRuntime) 共读的单源是否健康、
 * 无乱码、能正常进回答路径。若本题实际部署是 branch 构建，此校验是"上线前健康体检"。
 *
 * 用法：
 *   node 训练管道/verify_web_ready.js            # 全量校验 + 乱码扫描 + 无头冒烟
 *   node 训练管道/verify_web_ready.js --no-smoke  # 只做结构与乱码，不做回答冒烟（省 LLM-free）
 *   node 训练管道/verify_web_ready.js --json      # 输出 JSON 结论
 * 退出码：0=健康；1=结构/乱码不达标。
 */
const path = require('path');
const { readFAQRuntime } = require(path.join(__dirname, '..', 'scripts', 'lib-assistant-faq.js'));

const root = path.join(__dirname, '..');
const W = p => path.join(root, p);

const ARGS = process.argv.slice(2);
const DO_SMOKE = !ARGS.includes('--no-smoke');
const DO_JSON = ARGS.includes('--json');

// 权威子域（categories.json 官方案）：子域归一后应落在其中
const CANON = ['合成制备', '反应原理', '实验操作', '分析测定', '光化学应用', '结构表征', '磁性研究',
  '热分析', '安全与废物处理', '配位化学理论', '实验教学', '综合研究', '化学史', '高等理论',
  '蓝晒工艺', '摩尔盐相关', '草酸配合物'];

// 乱码检测：替换符 U+FFFD、控制字符（除 \t\r\n）、BOM、孤代理
function garbledInfo(s) {
  const out = { fffd: 0, control: 0, bom: 0, surrogate: 0, bad: 0, sample: '' };
  const str = String(s || '');
  for (const ch of str) {
    const c = ch.codePointAt(0);
    if (ch === '�') out.fffd++;
    else if (c === 0xFEFF) out.bom++;
    else if ((c < 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0D) || c === 0x7F) out.control++;
    else if (c >= 0xD800 && c <= 0xDFFF) out.surrogate++;
    else continue;
    out.bad++;
    if (!out.sample && ch !== '�') out.sample = ch;
    else if (ch === '�' && !out.sample.includes('�')) out.sample = '�';
  }
  if (out.bad > 0 && !out.sample) out.sample = '(不可见控制符)';
  return out;
}

function scanAll(faq) {
  const agg = { fffd: 0, control: 0, bom: 0, surrogate: 0, bad: 0 };
  const hits = [];
  faq.forEach((e, i) => {
    const fields = [['title', e.title], ['q', e.q], ['answer', e.answer], ['detail', e.detail],
      ['subfield', e.subfield], ['knode', e.knode]];
    fields.forEach(([fk, v]) => {
      const g = garbledInfo(v);
      if (g.bad > 0) {
        agg.fffd += g.fffd; agg.control += g.control; agg.bom += g.bom; agg.surrogate += g.surrogate; agg.bad += g.bad;
        hits.push({ index: i, field: fk, bad: g.bad, sample: g.sample, title: String(e.title || '').slice(0, 24) });
      }
    });
    (e.keys || []).forEach(k => { const g = garbledInfo(k); if (g.bad) { agg.bad += g.bad; agg.fffd += g.fffd; agg.control += g.control; agg.bom += g.bom; hits.push({ index: i, field: 'keys', bad: g.bad, sample: g.sample, title: String(e.title || '').slice(0, 24) }); } });
    (e.ents || []).forEach(k => { const g = garbledInfo(k); if (g.bad) { agg.bad += g.bad; agg.fffd += g.fffd; agg.control += g.control; hits.push({ index: i, field: 'ents', bad: g.bad, sample: g.sample, title: String(e.title || '').slice(0, 24) }); } });
  });
  return { agg, hits };
}

async function main() {
  const report = { at: new Date().toISOString(), ok: false, checks: {} };
  try {
    const faq = readFAQRuntime();
    report.checks.parses = { ok: true, count: faq.length };

    // 结构健康
    let missingTitle = 0, missingQ = 0, missingAnswer = 0, emptyKeys = 0, badSubfield = 0;
    const badSubfields = new Set();
    for (const e of faq) {
      if (!e.title || !String(e.title).trim()) missingTitle++;
      if (!e.q && !e.title) missingQ++;
      if (!e.answer || String(e.answer).length < 10) missingAnswer++;
      if (!(e.keys || []).length && !(e.ents || []).length) emptyKeys++;
      const sf = e.subfield || '';
      if (sf && !CANON.includes(sf)) { badSubfield++; badSubfields.add(sf); }
    }
    report.checks.structure = { ok: missingTitle === 0 && missingAnswer === 0 && badSubfield === 0,
      count: faq.length, missingTitle, missingAnswer, emptyKeys, badSubfield, badSubfields: [...badSubfields] };

    // 乱码扫描
    const { agg, hits } = scanAll(faq);
    report.checks.garbled = { ok: agg.bad === 0, totalBad: agg.bad, fffd: agg.fffd, control: agg.control, bom: agg.bom, surrogate: agg.surrogate, hitCount: hits.length };

    // 无头回答冒烟（近 GATE 校验，本地 local_answer 与浏览器逐字镜像）
    if (DO_SMOKE) {
      const localAnswer = require(path.join(__dirname, 'local_answer.js'));
      localAnswer.init();
      const probe = ['6%过氧化氢加多少毫升', '烘干温度多少', '产物摩尔质量是多少', '如何计算产率'];
      const smokes = probe.map(q => {
        try { const r = localAnswer.answer(q); return { q, ok: !!(r && r.answerText && r.answerText.length > 20), answerText: (r && r.answerText || '').slice(0, 40), matched: !!r.matchedFAQ, conf: r.confidence && r.confidence.level }; }
        catch (e) { return { q, ok: false, err: e.message.slice(0, 60) }; }
      });
      report.checks.smoke = { ok: smokes.every(s => s.ok), items: smokes };
    }

    report.ok = report.checks.parses.ok && report.checks.structure.ok && report.checks.garbled.ok && (!report.checks.smoke || report.checks.smoke.ok);
  } catch (e) {
    report.checks.parses = { ok: false, error: e.message.slice(0, 120) };
    report.ok = false;
  }

  if (DO_JSON) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('=== 网页可实现性校验 ===');
    const p = report.checks.parses; console.log('解析: ' + (p.ok ? 'OK ' + p.count + ' 条' : '失败 ' + p.error));
    if (report.checks.structure) {
      const s = report.checks.structure;
      console.log('结构: ' + (s.ok ? 'OK' : '降级') + ' (缺title=' + s.missingTitle + ' 短answer=' + s.missingAnswer + ' 无keys=' + s.emptyKeys + ' 无正规子域=' + s.badSubfield + (s.badSubfields.length ? ' ' + s.badSubfields.join(',') : '') + ')');
    }
    if (report.checks.garbled) {
      const g = report.checks.garbled;
      console.log('乱码: ' + (g.ok ? '干净' : '⚠ ' + g.totalBad + ' 处 (FFFD=' + g.fffd + ' 控制符=' + g.control + ' BOM=' + g.bom + ' 代理=' + g.surrogate + ') 命中条目=' + g.hitCount));
      if (!g.ok) g.hits && g.hits.slice(0, 8).forEach(h => console.log('    [' + h.index + '] ' + h.field + ' 乱码' + h.bad + ' ' + h.sample + ' ← ' + h.title));
    }
    if (report.checks.smoke) {
      console.log('冒烟: ' + (report.checks.smoke.ok ? 'OK' : '降级'));
      report.checks.smoke.items.forEach(s => console.log('    ' + (s.ok ? '✓' : '✗') + ' ' + s.q + ' → ' + (s.ok ? (s.answerText + '…') : s.err || '无答案')));
    }
    console.log('总判定: ' + (report.ok ? '✅ 可实现' : '❌ 未达标（需处理 乱码/结构/冒烟）'));
  }
  process.exit(report.ok ? 0 : 1);
}
main();
