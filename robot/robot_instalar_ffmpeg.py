# -*- coding: utf-8 -*-
r"""
robot_instalar_ffmpeg.py — Busca o descarga ffmpeg.exe y lo copia a robot/.

Uso: python robot_instalar_ffmpeg.py  |  python robot_instalar_ffmpeg.py --download
"""
from __future__ import annotations

import shutil
import sys
import zipfile
from pathlib import Path
from urllib.request import urlretrieve

BASE = Path(__file__).resolve().parent
DESTINO = BASE / "ffmpeg.exe"
FFMPEG_WIN_ZIP = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.0-latest-win64-gpl-shared-8.0.zip"

BUSCAR_EN = [
    Path.home() / "Downloads",
    Path.home() / "Desktop",
    Path.home() / "Escritorio",
    BASE,
]


def buscar_ffmpeg(extra: Path | None) -> Path | None:
    dirs = list(BUSCAR_EN)
    if extra and extra.is_dir():
        dirs.insert(0, extra)
    for d in dirs:
        if not d.exists():
            continue
        for p in d.rglob("ffmpeg.exe"):
            return p
        for sub in d.iterdir():
            if sub.is_dir() and "ffmpeg" in sub.name.lower():
                for p in sub.rglob("ffmpeg.exe"):
                    return p
    return None


def descargar_e_instalar() -> bool:
    zip_path = BASE / "ffmpeg_download.zip"
    try:
        print("Descargando build Windows (BtbN)...")
        urlretrieve(FFMPEG_WIN_ZIP, zip_path)
    except Exception as e:
        print(f"Error descargando: {e}")
        return False
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            for name in z.namelist():
                if "bin/ffmpeg.exe" in name.replace("\\", "/"):
                    exe = z.extract(name, BASE)
                    extracted = Path(exe)
                    if extracted.is_file():
                        shutil.copy2(extracted, DESTINO)
                        top = extracted.parent.parent
                        shutil.rmtree(top, ignore_errors=True)
                    break
        zip_path.unlink(missing_ok=True)
        return DESTINO.exists()
    except Exception as e:
        print(f"Error extrayendo: {e}")
        zip_path.unlink(missing_ok=True)
        return False


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--download"]
    do_download = "--download" in sys.argv[1:]
    if do_download:
        print("Modo --download: instalando ffmpeg desde BtbN.")
        if descargar_e_instalar():
            print(f"Listo. ffmpeg.exe en: {DESTINO}")
            return
        print("Falló la descarga.")
        sys.exit(1)
    extra = Path(args[0]) if args else None
    print("Buscando ffmpeg.exe...")
    src = buscar_ffmpeg(extra)
    if not src:
        print("No se encontró. Ejecuta: python robot_instalar_ffmpeg.py --download")
        sys.exit(1)
    shutil.copy2(src, DESTINO)
    print(f"Copiado a: {DESTINO}")


if __name__ == "__main__":
    main()
