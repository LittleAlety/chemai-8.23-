# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='msedge')
    for name in ['assistant.html', 'corpus.html']:
        pg = b.new_page(viewport={'width': 1360, 'height': 900})
        pg.goto('http://127.0.0.1:8898/' + name, wait_until='domcontentloaded', timeout=25000)
        pg.wait_for_timeout(2500)
        nav_bf = pg.eval_on_selector('.navbar', "el=>getComputedStyle(el).backdropFilter")
        orb = pg.evaluate("()=>{const s=getComputedStyle(document.body,'::after');return {bg:!!s.backgroundImage&&s.backgroundImage!=='none', anim:s.animationName}}")
        nav_after = pg.evaluate("()=>{const a=document.querySelector('.nav-links a');const s=a?getComputedStyle(a,'::after'):null;return s?{hasContent:!!s.content&&s.content!=='none', transform:s.transform}:null}")
        print(name, '| 导航毛玻璃:', nav_bf[:30], '| 光斑:', orb['bg'], orb['anim'], '| 导航下划线:', nav_after)
        pg.screenshot(path='_ui_%s_v52.png' % name.split('.')[0], full_page=False)
        pg.close()
    b.close()
print('DONE')
