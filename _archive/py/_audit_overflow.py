# -*- coding: utf-8 -*-
"""定位 assistant.html 移动端横向溢出的元素"""
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
    page = b.new_page(viewport={'width': 390, 'height': 844})
    page.goto(BASE + '/assistant.html', wait_until='domcontentloaded', timeout=20000)
    page.wait_for_timeout(1800)
    # 找所有 scrollWidth/right 超出 viewport 的元素
    offenders = page.evaluate('''() => {
      const vw = document.documentElement.clientWidth;
      const out = [];
      document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 && r.width > 0) {
          out.push({tag: el.tagName, cls: (el.className||'').toString().slice(0,40), id: el.id||'', right: Math.round(r.right), left: Math.round(r.left), width: Math.round(r.width)});
        }
      });
      return out.slice(0, 25);
    }''')
    for o in offenders:
        print('%-12s cls=%-42s id=%-16s right=%d left=%d width=%d' % (o['tag'], o['cls'], o['id'], o['right'], o['left'], o['width']))
    b.close()
print('DONE')
