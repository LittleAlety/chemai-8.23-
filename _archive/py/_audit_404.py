# -*- coding: utf-8 -*-
"""定位 index.html 的 404 资源"""
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
    page = b.new_page()
    bad = []
    page.on('response', lambda r: bad.append((r.status, r.url)) if r.status == 404 else None)
    page.goto(BASE + '/index.html', wait_until='domcontentloaded', timeout=20000)
    page.wait_for_timeout(2500)
    for st, u in bad:
        print('404:', u.replace(BASE, ''))
    if not bad:
        print('无 404')
    b.close()
print('DONE')
