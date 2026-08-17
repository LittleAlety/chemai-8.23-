# -*- coding: utf-8 -*-
"""验证 knowledge.html #panel 隐藏 bug：fadeUp both 填充态是否覆盖 transform"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

URL = 'file:///C:/Users/Little%20Alety/Desktop/Claude%20Code/version7-25/knowledge.html'

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
    page.wait_for_timeout(1500)

    panel = page.query_selector('#panel')
    tf = page.eval_on_selector('#panel', "el=>getComputedStyle(el).transform")
    anim = page.eval_on_selector('#panel', "el=>getComputedStyle(el).animationName")
    print('#panel 计算 transform:', tf)
    print('#panel 计算 animation-name:', anim)
    # 模拟 openPanel: 加 open 类后再移除（closePanel）
    page.eval_on_selector('#panel', "el=>el.classList.add('open')")
    page.wait_for_timeout(400)
    tf_open = page.eval_on_selector('#panel', "el=>getComputedStyle(el).transform")
    print('加 open 类后 transform:', tf_open)
    page.eval_on_selector('#panel', "el=>el.classList.remove('open')")
    page.wait_for_timeout(400)
    tf_closed = page.eval_on_selector('#panel', "el=>getComputedStyle(el).transform")
    print('移除 open 类后 transform:', tf_closed)
    print('移除后是否回到隐藏位置(应含 100% 或 1048px 以上 x 偏移):', '1048' in tf_closed or '100%' in tf_closed)
    browser.close()
print('DONE')
