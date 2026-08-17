# -*- coding: utf-8 -*-
"""验证 v48 按键边界规则生效"""
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

    def css(sel, prop):
        return page.eval_on_selector(sel, "(el,p)=>getComputedStyle(el).getPropertyValue(p)", prop).strip()

    print('ghost 按钮: bg=%s border=%s shadow=%s' % (css('.btn.ghost','background-color'), css('.btn.ghost','border-color'), css('.btn.ghost','box-shadow')))
    print('tab(未选中): bg=%s border=%s' % (css('.tab:not(.on)','background-color'), css('.tab:not(.on)','border-color')))
    print('tab.on: bg=%s border=%s' % (css('.tab.on','background-image'), css('.tab.on','border-color')))
    print('chip: bg=%s border=%s' % (css('.chip','background-color'), css('.chip','border-color')))
    print('warn: border=%s' % css('.btn.warn','border-color'))

    # 检查 tab 栏内相邻 tab 是否有可见分隔（相邻 tab 边框）
    tabs = page.query_selector_all('.tabs .tab')
    if len(tabs) >= 2:
        b0 = tabs[0].bounding_box(); b1 = tabs[1].bounding_box()
        print('相邻 tab 间距: %.0f px' % (b1['x'] - (b0['x'] + b0['width'])))
        # 计算边框宽度
        bw = page.eval_on_selector('.tabs .tab', "el=>getComputedStyle(el).borderTopWidth")
        print('tab 边框宽度:', bw)

    page.screenshot(path='_ui_buttons.png', full_page=False)
    browser.close()
print('DONE')
