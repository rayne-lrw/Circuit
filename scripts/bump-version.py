#!/usr/bin/env python3
"""更新 index.html 裡的版本號。

GitHub Pages 會讓 css/js 留在快取裡一段時間，瀏覽器重新整理也可能拿到舊檔。
每個 css/js 網址後面加上 ?v=版本號，每次發布換一個號碼，瀏覽器就會重新下載。
版本號同時顯示在標題旁邊，方便確認看到的是不是新版。

用法：python3 scripts/bump-version.py
"""
import re, datetime, pathlib

p = pathlib.Path(__file__).resolve().parent.parent / 'index.html'
s = p.read_text(encoding='utf-8')
v = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).strftime('%Y%m%d.%H%M')
s = re.sub(r'((?:src|href)="(?:js|css)/[\w.-]+\.(?:js|css))(?:\?v=[\w.]+)?"', lambda m: f'{m.group(1)}?v={v}"', s)
s = re.sub(r'<span id="ver"[^>]*>[^<]*</span>', f'<span id="ver" title="目前版本；更新後這個號碼會改變">v{v}</span>', s)
p.write_text(s, encoding='utf-8')
print('version', v)
