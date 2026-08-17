# -*- coding: utf-8 -*-
"""验证 assistant.html：计算工具面板是否移出侧边栏 + 页面加载是否报错"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

URL = 'file:///C:/Users/Little%20Alety/Desktop/Claude%20Code/version7-25/assistant.html'

with sync_playwright() as p:
    browser = None
    for ch in ('msedge', 'chrome', None):
        try:
            if ch:
                browser = p.chromium.launch(headless=True, channel=ch)
            else:
                browser = p.chromium.launch(headless=True)
            print('使用浏览器 channel:', ch or 'default')
            break
        except Exception as e:
            print('channel 失败:', ch, str(e)[:80])
    if not browser:
        raise SystemExit('无可用浏览器')
    page = browser.new_page(viewport={'width': 1360, 'height': 900})
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append('PAGEERROR: ' + str(e)))

    page.goto(URL, wait_until='domcontentloaded')
    page.wait_for_timeout(1500)

    # 1. 截图首页
    page.screenshot(path='_ui_home.png', full_page=False)

    # 2. 点击「计算工具」tab
    page.click('button.tab[data-mode="tools"]')
    page.wait_for_timeout(700)

    # 3. 测量 panel-tools 与侧边栏位置
    tools = page.query_selector('#panel-tools')
    tb = tools.bounding_box()
    aside = page.query_selector('aside.col-side')
    ab = aside.bounding_box()
    print('viewport: 1360x900')
    print('panel-tools box:', {k: round(v, 1) for k, v in tb.items()})
    print('aside box:     ', {k: round(v, 1) for k, v in ab.items()})
    print('panel-tools 宽度: %.0f px' % tb['width'])
    print('panel-tools 是否在主栏(x<aside.x):', tb['x'] < ab['x'])
    print('panel-tools 是否覆盖到侧边栏区(x+width>aside.x):', (tb['x'] + tb['width']) > ab['x'])
    # 计算卡片列数（calc-grid 内实际可见的 calc-card）
    cards = page.query_selector_all('#panel-tools .calc-card')
    print('计算工具卡片数量:', len(cards))
    if cards:
        c0 = cards[0].bounding_box(); c1 = cards[1].bounding_box()
        print('前两张卡片是否并排(y 相近):', abs(c0['y'] - c1['y']) < 40)

    page.screenshot(path='_ui_tools.png', full_page=False)

    # 4. 切回问答，确认无 JS 报错
    page.click('button.tab[data-mode="qa"]')
    page.wait_for_timeout(400)
    print('\n控制台错误数:', len(errors))
    for e in errors[:8]:
        print('  ', e[:160])

    # 5. 滚动显现是否生效（body 上应有 v47 滚动显现脚本）
    has_v47 = page.evaluate("() => document.documentElement.innerHTML.includes('滚动显现 v47')")
    has_css = page.evaluate("() => { const s=[...document.styleSheets].map(x=>x.ownerNode.textContent||'').join(''); return s.includes('translateY(28px)'); }")
    print('v47 滚动显现脚本存在:', has_v47)
    print('v47 fadeUp(28px) 样式存在:', has_css)

    browser.close()
print('DONE')
