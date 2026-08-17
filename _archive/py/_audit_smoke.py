# -*- coding: utf-8 -*-
"""ChemAI 5 页综合冒烟测试：加载/控制台错误/关键交互"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8899'
PAGES = {
    'assistant.html': ['qa', 'assess', 'tools', 'wrong'],
    'knowledge.html': [],
    'corpus.html': [],
    'prep.html': [],
    'main.html': [],
    'index.html': [],
}

with sync_playwright() as p:
    browser = None
    for ch in ('msedge', 'chrome', None):
        try:
            browser = p.chromium.launch(headless=True, channel=ch) if ch else p.chromium.launch(headless=True)
            break
        except Exception:
            continue
    all_errors = {}
    for page_name in PAGES:
        errors = []
        page = browser.new_page(viewport={'width': 1360, 'height': 900})
        page.on('console', lambda m, pn=page_name: errors.append('CONSOLE[' + m.type + ']: ' + m.text[:200]) if m.type == 'error' else None)
        page.on('pageerror', lambda e, pn=page_name: errors.append('PAGEERROR: ' + str(e)[:200]))
        url = BASE + '/' + page_name
        try:
            page.goto(url, wait_until='domcontentloaded', timeout=20000)
            page.wait_for_timeout(2500)
            title = page.title()
            print('===== %s | title=%s =====' % (page_name, title))
            # 通用: 检查关键容器是否渲染
            for sel in ['nav', 'footer']:
                print('  %s: %s' % (sel, '有' if page.query_selector(sel) else '缺!'))
            # 分页特有
            if page_name == 'assistant.html':
                for mode in PAGES[page_name]:
                    page.click('button.tab[data-mode="%s"]' % mode, timeout=5000)
                    page.wait_for_timeout(350)
                    vis = page.eval_on_selector('#panel-%s' % mode, "el=>!el.classList.contains('hidden')")
                    print('  tab[%s] 面板可见: %s' % (mode, vis))
                # 计算工具实测
                page.click('button.tab[data-mode="tools"]')
                page.wait_for_timeout(300)
                page.fill('#calcMol', 'K3[Fe(C2O4)3]·3H2O')
                page.click('#panel-tools button[onclick="calcMolar()"]')
                page.wait_for_timeout(200)
                out = page.text_content('#calcMolOut')
                print('  摩尔质量 K3[Fe(C2O4)3]·3H2O →', out and out.strip())
                # 语料是否加载
                sc = page.text_content('#statCorpus')
                print('  statCorpus:', sc)
            elif page_name == 'knowledge.html':
                # 右侧节点详情面板可开关
                pnl = page.eval_on_selector('#panel', "el=>getComputedStyle(el).transform")
                page.eval_on_selector('#panel', "el=>el.classList.add('open')")
                page.wait_for_timeout(400)
                pnl_open = page.eval_on_selector('#panel', "el=>getComputedStyle(el).transform")
                page.click('#panelClose', timeout=4000)
                page.wait_for_timeout(400)
                pnl_closed = page.eval_on_selector('#panel', "el=>getComputedStyle(el).transform")
                print('  图谱面板: 初始=%s 打开=%s 关闭后=%s' % (pnl[:30], pnl_open[:30], pnl_closed[:30]))
                # 图例折叠
                page.click('#legToggle')
                page.wait_for_timeout(250)
                leg_collapsed = page.eval_on_selector('#legBody', "el=>el.classList.contains('collapsed')")
                print('  图例折叠: %s' % leg_collapsed)
                # 统计数字是否渲染
                print('  节点统计:', page.text_content('#statNodes'), '| 链接:', page.text_content('#statLinks'))
            elif page_name == 'corpus.html':
                pass
            elif page_name == 'prep.html':
                pass
            elif page_name == 'main.html':
                pass
        except Exception as ex:
            errors.append('TEST-EXC: ' + str(ex)[:200])
        all_errors[page_name] = errors
        page.screenshot(path='_audit_%s.png' % page_name.replace('.html', ''), full_page=False)
        page.close()

    print('\n================= 控制台/页面错误汇总 =================')
    total = 0
    for pn, errs in all_errors.items():
        real = [e for e in errs if 'favicon' not in e.lower()]
        print('%s: %d 条错误' % (pn, len(real)))
        for e in real[:10]:
            print('   ', e[:160])
        total += len(real)
    print('总计 %d 条' % total)
    browser.close()
print('DONE')
