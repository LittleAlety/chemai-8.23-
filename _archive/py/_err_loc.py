# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='msedge')
    pg = b.new_page()
    pg.add_init_script("window.__errs=[];window.addEventListener('error',function(e){window.__errs.push({msg:e.message,src:e.filename,line:e.lineno,col:e.colno});});")
    pg.goto('http://127.0.0.1:8898/_tmp_588_test.html', wait_until='domcontentloaded', timeout=25000)
    pg.wait_for_timeout(2500)
    errs = pg.evaluate("()=>window.__errs")
    for e in (errs or [])[:10]:
        print('ERR:', e['msg'][:80], '| line:', e['line'], '| col:', e['col'], '| src末尾:', (e['src'] or '')[-40:])
    b.close()
print('DONE')
