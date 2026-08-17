# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

def test(path):
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, channel='msedge')
        pg = b.new_page(viewport={'width': 1360, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:80]))
        pg.goto('http://127.0.0.1:8898/' + path, wait_until='domcontentloaded', timeout=25000)
        pg.wait_for_timeout(2500)
        try:
            pg.click('button.tab[data-mode="tools"]', timeout=5000)
            pg.wait_for_timeout(300)
            vis = pg.eval_on_selector('#panel-tools', "el=>!el.classList.contains('hidden')")
            print(path, '| tab[tools] 可见:', vis, '| 错误:', errs[:3] if errs else '无')
        except Exception as e:
            print(path, '| 点击失败:', str(e)[:80], '| 错误:', errs[:3] if errs else '无')
        b.close()

test('_tmp_588_test.html')
