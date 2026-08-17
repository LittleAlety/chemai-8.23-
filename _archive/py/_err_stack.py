# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='msedge')
    pg = b.new_page()
    pg.on('pageerror', lambda e: print('PAGEERROR STACK:\n' + (str(e)[:600])))
    pg.goto('http://127.0.0.1:8898/assistant.html', wait_until='domcontentloaded', timeout=25000)
    pg.wait_for_timeout(2500)
    b.close()
print('DONE')
