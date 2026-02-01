# -*- coding: utf-8 -*-
"""Comprueba que la app en producción tenga __APP_VERSION__ en el HTML."""
import re
import urllib.request

URL = "https://rauli-panaderia-app.vercel.app/?t=1"
try:
    with urllib.request.urlopen(URL, timeout=15) as r:
        html = r.read().decode()
except Exception as e:
    print("Error:", e)
    exit(1)
m = re.search(r'window\.__APP_VERSION__\s*=\s*["\']([^"\']+)["\']', html)
if m:
    print("OK version en HTML:", m.group(1))
else:
    print("NO: __APP_VERSION__ no encontrado (deploy puede estar en curso o cache)")
