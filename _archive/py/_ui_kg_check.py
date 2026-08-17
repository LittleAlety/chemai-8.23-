# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='msedge')

    # 1. 浅色主题对比度
    pg = b.new_page(viewport={'width': 1360, 'height': 900})
    pg.goto('http://127.0.0.1:8898/knowledge.html', wait_until='domcontentloaded', timeout=25000)
    pg.wait_for_timeout(2000)
    pg.evaluate("()=>{document.documentElement.setAttribute('data-theme','light');}")
    pg.wait_for_timeout(300)
    lp = pg.eval_on_selector('.legend-panel', "el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor, color:s.color}}")
    sb = pg.eval_on_selector('.statsbar', "el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor, color:s.color}}")
    zo = pg.eval_on_selector('.zoom-ctrl button', "el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor, color:s.color}}")
    seg = pg.eval_on_selector('.seg button.on', "el=>{const s=getComputedStyle(el);return {color:s.color}}")
    print('浅色主题 → 图例面板:', lp, '| 统计条:', sb, '| 缩放按钮:', zo, '| seg.on文字:', seg)
    pg.screenshot(path='_kg_light.png', full_page=False)
    pg.close()

    # 2. 移动端布局 (390px)
    pg2 = b.new_page(viewport={'width': 390, 'height': 844})
    pg2.goto('http://127.0.0.1:8898/knowledge.html', wait_until='domcontentloaded', timeout=25000)
    pg2.wait_for_timeout(2500)
    sw = pg2.evaluate('()=>document.documentElement.scrollWidth')
    cw = pg2.evaluate('()=>document.documentElement.clientWidth')
    legend_vis = pg2.eval_on_selector('.tb-legend', "el=>getComputedStyle(el).display")
    stage_h = pg2.eval_on_selector('.stage', "el=>getComputedStyle(el).height")
    toolbar_h = pg2.eval_on_selector('.toolbar', "el=>getComputedStyle(el).height")
    print('移动端390 → 横向溢出:', sw > cw + 2, f'(sw={sw} cw={cw})', '| tb-legend显示:', legend_vis, '| stage高:', stage_h, '| toolbar高:', toolbar_h)
    pg2.screenshot(path='_kg_mobile.png', full_page=False)
    pg2.close()
    b.close()
print('DONE')
