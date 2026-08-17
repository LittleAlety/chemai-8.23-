# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='msedge')
    pg = b.new_page(viewport={'width': 1360, 'height': 900})
    pg.goto('http://127.0.0.1:8898/assistant.html', wait_until='domcontentloaded', timeout=25000)
    pg.wait_for_timeout(2000)
    # tab 切换
    for mode in ['tools', 'wrong', 'assess']:
        pg.click('button.tab[data-mode="%s"]' % mode, timeout=5000)
        pg.wait_for_timeout(250)
        vis = pg.eval_on_selector('#panel-%s' % mode, "el=>!el.classList.contains('hidden')")
        print('tab[' + mode + '] 可见:', vis)
    # 计算工具
    pg.click('button.tab[data-mode="tools"]'); pg.wait_for_timeout(250)
    pg.fill('#calcMol', 'K3[Fe(C2O4)3]·3H2O')
    pg.click('#panel-tools button[onclick="calcMolar()"]'); pg.wait_for_timeout(200)
    print('摩尔质量:', pg.text_content('#calcMolOut').strip())
    print('FAQ stat:', pg.text_content('#statCorpus'))
    b.close()
print('DONE')
