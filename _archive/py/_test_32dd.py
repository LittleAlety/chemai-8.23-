# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='msedge')
    pg = b.new_page(viewport={'width': 1360, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:100]))
    pg.goto('http://127.0.0.1:8898/_tmp_32dd_test.html', wait_until='domcontentloaded', timeout=25000)
    pg.wait_for_timeout(2500)
    try:
        pg.click('button.tab[data-mode="tools"]', timeout=5000)
        pg.wait_for_timeout(300)
        vis = pg.eval_on_selector('#panel-tools', "el=>!el.classList.contains('hidden')")
        print('32dd49e 版 tab[tools] 可见:', vis)
    except Exception as e:
        print('点击失败:', str(e)[:80])
    print('页面错误:', errs[:5] if errs else '无')
    b.close()
print('DONE')
