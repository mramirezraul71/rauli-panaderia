# -*- coding: utf-8 -*-
"""
DEPRECADO: Usar scripts/verificar_version_api.py (cadena automatizada vía API).
Fallback si la API no está disponible.
"""
import json
import sys
import urllib.request

# Intentar API primero (canónico)
API_URL = "https://rauli-panaderia-1.onrender.com/api/version"
try:
    req = urllib.request.Request(API_URL, headers={"Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read().decode())
        print("OK version vía API:", data.get("version", "?"))
        sys.exit(0)
except Exception as e:
    print("API no disponible ({})".format(e), file=sys.stderr)
    print("Usa: python scripts/verificar_version_api.py")
    sys.exit(1)
