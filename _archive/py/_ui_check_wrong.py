# -*- coding: utf-8 -*-
"""验证错题本面板 panel-wrong 渲染位置"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

URL = 'file:///C:/Users/Little%20Alety/Desktop/Claude%20Code/version7-25/assistant.html'

with sync_playwright() as p:
    browser = None
    for ch in ('msedge', 'chrome', None):
        try:
            browser = p.chromium.launch(headless=True, channel=ch) if ch else p.chromium.launch(headless=True)
            print('浏览器:', ch or 'default')
            break
        except Exception:
            continue
    page = browser.new_page(viewport={'width': 1360, 'height': 900})
    page.goto(URL, wait_until='domcontentloaded')
    page.wait_for_timeout(1200)

    page.click('button.tab[data-mode="wrong"]')
    page.wait_for_timeout(700)

    wb = page.query_selector('#panel-wrong').bounding_box()
    aside = page.query_selector('aside.col-side').bounding_box()
    tabs = page.query_selector('.tabs').bounding_box()
    print('panel-wrong box:', {k: round(v, 1) for k, v in wb.items()})
    print('aside box:      ', {k: round(v, 1) for k, v in aside.items()})
    print('tabs box:       ', {k: round(v, 1) for k, v in tabs.items()})
    print('宽度: %.0f px' % wb['width'])
    print('位于主栏(x<aside.x):', wb['x'] < aside['x'])
    print('位于 tab 栏下方(y>tabs.y):', wb['y'] > tabs['y'])
    print('未覆盖侧栏区(x+width<=aside.x):', (wb['x'] + wb['width']) <= aside['x'])
    page.screenshot(path='_ui_wrong.png', full_page=False)
    browser.close()
print('DONE')
