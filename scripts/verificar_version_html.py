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
    # Debug: buscar cualquier mención de version o APP_VERSION
    if "__APP_VERSION__" in html:
        print("__APP_VERSION__ presente pero regex no matchea")
    elif "1.0.5" in html or "1.0.4" in html:
        print("Version numerica en HTML, script puede estar minificado")
    else:
        print("NO: __APP_VERSION__ no encontrado en el HTML")
    # Mostrar fragmento del head
    start = html.find("<head")
    if start != -1:
        frag = html[start:start+1500]
        print("Fragmento head:", frag[:800])
