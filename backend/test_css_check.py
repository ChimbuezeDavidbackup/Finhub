import urllib.request
import re

try:
    with urllib.request.urlopen('http://localhost:3000', timeout=5) as resp:
        html = resp.read().decode('utf-8')
        print('[OK] Home Page loaded. Length:', len(html))
        css_links = re.findall(r'href="(/_next/static/css/[^"]+)"', html)
        print('[OK] Found CSS links in HTML:', css_links)
        for link in css_links:
            with urllib.request.urlopen('http://localhost:3000' + link, timeout=5) as c_resp:
                css_data = c_resp.read()
                print(f'[OK] CSS File {link}: Status={c_resp.status}, Content-Type={c_resp.headers.get("Content-Type")}, Bytes={len(css_data)}')
except Exception as e:
    print('[FAIL]:', e)
