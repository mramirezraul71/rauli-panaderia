# -*- coding: utf-8 -*-
"""
Incrementa la versión y actualiza toda la cadena (version.js, version.json, index.html, etc.).
Cadena: API sirve version.json -> frontend detecta actualizaciones.
Uso: python scripts/bump_version.py         # incrementa patch
     python scripts/bump_version.py --today # usa fecha de hoy YYYY.MM.DD
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_JS = ROOT / "frontend" / "src" / "config" / "version.js"
VERSION_JSON = ROOT / "backend" / "version.json"
VERSION_PUBLIC = ROOT / "frontend" / "public" / "version.json"
INDEX_HTML = ROOT / "frontend" / "index.html"
BACKEND_MAIN = ROOT / "backend" / "main.py"
GRADLE = ROOT / "frontend" / "android" / "app" / "build.gradle"


def get_current_version() -> str | None:
    if not VERSION_JS.exists():
        return None
    m = re.search(r'APP_VERSION\s*=\s*["\'](\d+\.\d+\.\d+)["\']', VERSION_JS.read_text(encoding="utf-8"))
    return m.group(1) if m else None


def apply_version(new_ver: str) -> None:
    now = datetime.utcnow()
    build = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    code = now.strftime("%Y%m%d%H%M%S")

    # 1) version.js
    if VERSION_JS.exists():
        text = VERSION_JS.read_text(encoding="utf-8")
        text = re.sub(r'APP_VERSION\s*=\s*["\'][^"\']+["\']', f'APP_VERSION = "{new_ver}"', text, count=1)
        VERSION_JS.write_text(text, encoding="utf-8")

    # 2) backend/version.json
    VERSION_JSON.write_text(
        json.dumps({"version": new_ver, "build": build, "code": code}, indent=2),
        encoding="utf-8",
    )

    # 3) frontend/public/version.json
    VERSION_PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    VERSION_PUBLIC.write_text(
        json.dumps({"version": new_ver, "build": build}, indent=2),
        encoding="utf-8",
    )

    # 4) index.html
    if INDEX_HTML.exists():
        html = INDEX_HTML.read_text(encoding="utf-8")
        html = re.sub(r'window\.__APP_VERSION__\s*=\s*["\'][^"\']*["\']', f'window.__APP_VERSION__="{new_ver}"', html)
        html = re.sub(r'window\.__APP_BUILD__\s*=\s*["\'][^"\']*["\']', f'window.__APP_BUILD__="{build}"', html)
        INDEX_HTML.write_text(html, encoding="utf-8")

    # 5) backend/main.py
    if BACKEND_MAIN.exists():
        mt = BACKEND_MAIN.read_text(encoding="utf-8")
        mt = re.sub(r'version\s*=\s*["\'][^"\']*["\']', f'version="{new_ver}"', mt, count=1)
        BACKEND_MAIN.write_text(mt, encoding="utf-8")

    # 6) Android build.gradle
    if GRADLE.exists():
        gtext = GRADLE.read_text(encoding="utf-8")
        version_code = int(new_ver.replace(".", ""))
        gtext = re.sub(r'versionCode\s+\d+', f'versionCode {version_code}', gtext)
        gtext = re.sub(r'versionName\s+["\'][^"\']*["\']', f'versionName "{new_ver}"', gtext)
        GRADLE.write_text(gtext, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Bump version en toda la cadena")
    parser.add_argument("--today", action="store_true", help="Usar fecha de hoy (YYYY.MM.DD)")
    args = parser.parse_args()

    if args.today:
        now = datetime.utcnow()
        new_ver = now.strftime("%Y.%m.%d")
    else:
        cur = get_current_version()
        if not cur:
            print("No se encontró versión actual", file=sys.stderr)
            return 1
        m = re.match(r"(\d+)\.(\d+)\.(\d+)", cur)
        if not m:
            return 1
        major, minor, patch = int(m.group(1)), int(m.group(2)), int(m.group(3))
        patch += 1
        new_ver = f"{major}.{minor}.{patch}"

    apply_version(new_ver)
    print(new_ver)
    return 0


if __name__ == "__main__":
    sys.exit(main())
