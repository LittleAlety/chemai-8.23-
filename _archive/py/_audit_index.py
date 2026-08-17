# -*- coding: utf-8 -*-
import sys, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='msedge')
    pg = b.new_page(viewport={'width': 1360, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)[:200]))
    pg.on('console', lambda m: errs.append(m.text[:150]) if m.type == 'error' else None)
    pg.goto('http://127.0.0.1:8899/index.html', wait_until='networkidle', timeout=30000)
    pg.wait_for_timeout(4000)
    print('title:', pg.title())
    print('root:', pg.evaluate('()=>{const r=document.getElementById("root"); return r?("存在, 子节点="+r.children.length+" htmlLen="+r.innerHTML.length):"NULL"}'))
    print('body 文本长度:', pg.evaluate('()=>document.body.innerText.length'))
    real = [e for e in errs if 'favicon' not in e]
    print('错误数:', len(real))
    for e in real[:10]:
        print('  ', e[:200])
    pg.screenshot(path='_audit_index_kimi.png', full_page=False)
    b.close()
print('DONE')
