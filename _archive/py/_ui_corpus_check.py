# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='msedge')
    pg = b.new_page(viewport={'width': 1360, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:120]))
    pg.goto('http://127.0.0.1:8898/corpus.html', wait_until='networkidle', timeout=25000)
    pg.wait_for_timeout(2500)
    bars = pg.query_selector_all('#barChart .bar-fill')
    names = pg.query_selector_all('#barChart .bar-name')
    pcts = pg.query_selector_all('#barChart .bar-pct')
    print('柱条数:', len(bars), '| 名称数:', len(names), '| 占比标签数:', len(pcts))
    if bars:
        # 检查不同柱条是否有不同颜色(背景)
        colors = set()
        for i in range(min(5, len(bars))):
            bg = pg.eval_on_selector('#barChart .bar-fill:nth-child(%d)' % (i + 1), "el=>getComputedStyle(el).backgroundImage") if False else None
        # 用JS读内联背景
        for i in range(min(5, len(bars))):
            c = pg.evaluate("(i)=>{const els=document.querySelectorAll('#barChart .bar-fill');return els[i]?els[i].style.background:''}", i)
            colors.add(c[:40])
        print('不同柱条背景数量:', len(colors))
        for c in list(colors)[:3]: print('  样:', c[:50])
    print('页面错误:', errs[:5] if errs else '无')
    pg.screenshot(path='_ui_corpus_v50.png', full_page=False)
    b.close()
print('DONE')
