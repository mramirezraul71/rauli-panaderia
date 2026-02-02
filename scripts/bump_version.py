# -*- coding: utf-8 -*-
"""
Incrementa la versión y actualiza toda la cadena (version.js, version.json, index.html).
Cadena automatizada: API sirve version.json -> frontend detecta actualizaciones.
Uso: python scripts/bump_version.py
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_JS = ROOT / "frontend" / "src" / "config" / "version.js"
VERSION_JSON = ROOT / "backend" / "version.json"
INDEX_HTML = ROOT / "frontend" / "index.html"


def main() -> int:
    if not VERSION_JS.exists():
        return 1
    text = VERSION_JS.read_text(encoding="utf-8")
    m = re.search(r'(APP_VERSION\s*=\s*["\'])(\d+)\.(\d+)\.(\d+)(["\'])', text)
    if not m:
        return 1
    major, minor, patch = int(m.group(2)), int(m.group(3)), int(m.group(4))
    patch += 1
    new_ver = f"{major}.{minor}.{patch}"
    now = datetime.utcnow()
    build = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    code = now.strftime("%Y%m%d%H%M%S")

    # 1) version.js
    new_text = re.sub(
        r'APP_VERSION\s*=\s*["\'][^"\']+["\']',
        f'APP_VERSION = "{new_ver}"',
        text,
        count=1,
    )
    VERSION_JS.write_text(new_text, encoding="utf-8")

    # 2) backend/version.json (API source of truth)
    VERSION_JSON.write_text(
        json.dumps({"version": new_ver, "build": build, "code": code}, indent=2),
        encoding="utf-8",
    )

    # 3) index.html
    if INDEX_HTML.exists():
        html = INDEX_HTML.read_text(encoding="utf-8")
        html = re.sub(r'window\.__APP_VERSION__\s*=\s*["\'][^"\']*["\']', f'window.__APP_VERSION__="{new_ver}"', html)
        html = re.sub(r'window\.__APP_BUILD__\s*=\s*["\'][^"\']*["\']', f'window.__APP_BUILD__="{build}"', html)
        INDEX_HTML.write_text(html, encoding="utf-8")

    print(new_ver)
    return 0


if __name__ == "__main__":
    sys.exit(main())
