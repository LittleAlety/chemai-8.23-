# -*- coding: utf-8 -*-
"""移动端(390px)横向溢出检查"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8899'
with sync_playwright() as p:
    b = None
    for ch in ('msedge', 'chrome', None):
        try:
            b = p.chromium.launch(headless=True, channel=ch) if ch else p.chromium.launch(headless=True)
            break
        except Exception:
            continue
    for pg in ('assistant.html', 'knowledge.html', 'corpus.html', 'prep.html', 'main.html', 'index.html'):
        page = b.new_page(viewport={'width': 390, 'height': 844})
        page.goto(BASE + '/' + pg, wait_until='domcontentloaded', timeout=20000)
        page.wait_for_timeout(1800)
        sw = page.evaluate('()=>document.documentElement.scrollWidth')
        cw = page.evaluate('()=>document.documentElement.clientWidth')
        print(pg, 'scrollWidth=%d clientWidth=%d %s' % (sw, cw, 'WARN 横向溢出' if sw > cw + 2 else 'OK'))
        page.close()
    b.close()
print('DONE')
