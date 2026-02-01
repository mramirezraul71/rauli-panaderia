# -*- coding: utf-8 -*-
"""
Incrementa la versión patch en version.js (1.0.8 -> 1.0.9).
Cada deploy de arreglos = nueva versión visible para los usuarios.
Uso: python scripts/bump_version.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_JS = ROOT / "frontend" / "src" / "config" / "version.js"


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
    new_text = re.sub(
        r'APP_VERSION\s*=\s*["\'][^"\']+["\']',
        f'APP_VERSION = "{new_ver}"',
        text,
        count=1,
    )
    VERSION_JS.write_text(new_text, encoding="utf-8")
    print(new_ver)
    return 0


if __name__ == "__main__":
    sys.exit(main())
