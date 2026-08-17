# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='msedge')
    for pg_name, sel in [('assistant.html', '.page-head h1'), ('corpus.html', '.banner h1')]:
        pg = b.new_page(viewport={'width': 1360, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:100]))
        pg.goto('http://127.0.0.1:8898/' + pg_name, wait_until='domcontentloaded', timeout=25000)
        pg.wait_for_timeout(2000)
        title = pg.text_content(sel)
        anim = pg.eval_on_selector(sel, "el=>getComputedStyle(el).animationName")
        clip = pg.eval_on_selector(sel, "el=>getComputedStyle(el).webkitBackgroundClip || getComputedStyle(el).backgroundClip")
        fill = pg.eval_on_selector(sel, "el=>getComputedStyle(el).webkitTextFillColor")
        print(pg_name, '| 标题:', (title or '').strip()[:30], '| 动画:', anim, '| clip:', clip, '| fill:', fill)
        print('  错误:', errs[:3] if errs else '无')
        pg.screenshot(path='_ui_%s_v51.png' % pg_name.split('.')[0], full_page=False)
        pg.close()
    b.close()
print('DONE')
