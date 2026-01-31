# -*- coding: utf-8 -*-
"""
Instala el sistema de actualización automática (version.json + VersionChecker) en un proyecto.
Funciona en este repo o en cualquier otro con estructura frontend (Vite + React).

Uso:
  python scripts/instalar_sistema_actualizacion.py
  python scripts/instalar_sistema_actualizacion.py --proyecto C:\dev\OtroProyecto
  python scripts/instalar_sistema_actualizacion.py --proyecto . --frontend ./web

La plantilla se toma de templates/update-system (o --template-dir).
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = ROOT / "templates" / "update-system"


def parse_args():
    p = argparse.ArgumentParser(description="Instala sistema de actualización automática en un proyecto.")
    p.add_argument("--proyecto", type=Path, default=ROOT, help="Raíz del proyecto")
    p.add_argument("--frontend", type=Path, default=None, help="Carpeta frontend (default: proyecto/frontend)")
    p.add_argument("--template-dir", type=Path, default=TEMPLATE_DIR, help="Carpeta plantilla update-system")
    p.add_argument("--dry-run", action="store_true", help="Solo mostrar qué se haría")
    return p.parse_args()


def ensure_dir(d: Path) -> None:
    d.mkdir(parents=True, exist_ok=True)


def patch_build_script(package_json: Path, dry_run: bool) -> bool:
    """Asegura que el script build incluya write-version.js antes de vite build."""
    text = package_json.read_text(encoding="utf-8")
    if "write-version.js" in text:
        return False
    # "build": "vite build" -> "build": "node scripts/write-version.js && vite build"
    new_text = re.sub(
        r'"build"\s*:\s*"vite build"',
        '"build": "node scripts/write-version.js && vite build"',
        text,
        count=1,
    )
    if new_text == text:
        # Quizá es "vite build" con más cosas
        new_text = re.sub(
            r'"build"\s*:\s*"([^"]*vite build[^"]*)"',
            r'"build": "node scripts/write-version.js && \1"',
            text,
            count=1,
        )
    if new_text != text:
        if not dry_run:
            package_json.write_text(new_text, encoding="utf-8")
        return True
    return False


def patch_main_sw(main_path: Path, dry_run: bool) -> bool:
    """Añade updateViaCache: 'none' al registrar el Service Worker si no está."""
    text = main_path.read_text(encoding="utf-8")
    if "updateViaCache" in text:
        return False
    # .register('/sw.js') -> .register('/sw.js', { updateViaCache: 'none' })
    new_text = re.sub(
        r"\.register\s*\(\s*['\"]\/sw\.js['\"]\s*\)",
        ".register('/sw.js', { updateViaCache: 'none' })",
        text,
        count=1,
    )
    if new_text != text:
        if not dry_run:
            main_path.write_text(new_text, encoding="utf-8")
        return True
    return False


def patch_vercel_headers(vercel_path: Path, dry_run: bool) -> bool:
    """Añade cabeceras no-cache para /, index.html y version.json si no existen."""
    text = vercel_path.read_text(encoding="utf-8")
    if "/version.json" in text and "no-store" in text:
        return False
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return False
    headers = data.get("headers", [])
    needed = {
        "/": "no-store, no-cache, must-revalidate",
        "/index.html": "no-store, no-cache, must-revalidate",
        "/version.json": "no-store, max-age=0",
    }
    existing_sources = {h.get("source") for h in headers if isinstance(h.get("headers"), list)}
    for source, value in needed.items():
        if source in existing_sources:
            continue
        for h in headers:
            if h.get("source") == source:
                for inner in h.get("headers", []):
                    if inner.get("key") == "Cache-Control":
                        inner["value"] = value
                break
        else:
            headers.append({
                "source": source,
                "headers": [{"key": "Cache-Control", "value": value}],
            })
    data["headers"] = headers
    if not dry_run:
        vercel_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return True


def ensure_version_checker_in_app(app_path: Path, dry_run: bool) -> bool:
    """Añade import y componente VersionChecker si no están."""
    text = app_path.read_text(encoding="utf-8")
    if "VersionChecker" in text:
        return False
    # Añadir import después del primer import de React o al inicio de imports
    if "import VersionChecker" not in text and "from \"./components/VersionChecker\"" not in text:
        # Buscar línea de import típica para insertar después
        insert_import = 'import VersionChecker from "./components/VersionChecker";\n'
        if "from \"react\"" in text or "from 'react'" in text:
            text = re.sub(
                r"(import .+ from [\"']react[\"'];?\n)",
                r"\1" + insert_import,
                text,
                count=1,
            )
        else:
            # Añadir tras el primer import
            first_import = re.search(r"^import .+;\n", text, re.MULTILINE)
            if first_import:
                pos = first_import.end()
                text = text[:pos] + insert_import + text[pos:]
            else:
                text = insert_import + text
    # Añadir <VersionChecker /> dentro del return principal (ej. justo después de <> o del primer div)
    if "<VersionChecker" not in text:
        # Intentar después de return ( o return \n (
        text = re.sub(
            r"(return\s*\(\s*)(<\s*(?:Fragment|>|div))",
            r"\1<>\n      <VersionChecker />\n      \2",
            text,
            count=1,
        )
        if "<VersionChecker" not in text:
            text = re.sub(
                r"(return\s*\(\s*<[A-Za-z]+)",
                r"\1\n      <VersionChecker />",
                text,
                count=1,
            )
    if not dry_run and "VersionChecker" in text and ("import VersionChecker" in text or "from \"./components/VersionChecker\"" in text):
        app_path.write_text(text, encoding="utf-8")
        return True
    return False


def main():
    args = parse_args()
    proyecto = args.proyecto.resolve()
    frontend = (args.frontend or (proyecto / "frontend")).resolve()
    template = args.template_dir.resolve()
    dry = args.dry_run

    if not template.exists():
        print(f"ERROR: No existe la plantilla: {template}")
        print("  Crea templates/update-system con write-version.js, VersionChecker.jsx y version.js.example")
        return 1

    print(f"Proyecto: {proyecto}")
    print(f"Frontend: {frontend}")
    print(f"Plantilla: {template}")
    if dry:
        print("(modo dry-run: no se escriben archivos)\n")

    # Copiar archivos
    scripts_dir = frontend / "scripts"
    components_dir = frontend / "src" / "components"
    config_dir = frontend / "src" / "config"

    ensure_dir(scripts_dir)
    ensure_dir(components_dir)
    ensure_dir(config_dir)

    for name, dest_subdir in [
        ("write-version.js", scripts_dir),
        ("VersionChecker.jsx", components_dir),
    ]:
        src = template / name
        if not src.exists():
            print(f"  Saltando {name}: no en plantilla")
            continue
        dest = dest_subdir / name
        if not dry:
            shutil.copy2(src, dest)
        print(f"  {'(dry) ' if dry else ''}Copiado: {dest.relative_to(proyecto)}")

    version_js = config_dir / "version.js"
    if not version_js.exists():
        example = template / "version.js.example"
        if example.exists():
            if not dry:
                shutil.copy2(example, version_js)
            print(f"  {'(dry) ' if dry else ''}Creado: {version_js.relative_to(proyecto)}")
    else:
        print(f"  Ya existe: {version_js.relative_to(proyecto)}")

    # Patches
    pkg = frontend / "package.json"
    if pkg.exists():
        if patch_build_script(pkg, dry):
            print(f"  {'(dry) ' if dry else ''}Modificado package.json: script build con write-version.js")
    else:
        print("  AVISO: No existe package.json; añade manualmente al build: node scripts/write-version.js && vite build")

    main_jsx = frontend / "src" / "main.jsx"
    if not main_jsx.exists():
        main_jsx = frontend / "src" / "main.tsx"
    if main_jsx.exists() and "serviceWorker" in main_jsx.read_text():
        if patch_main_sw(main_jsx, dry):
            print(f"  {'(dry) ' if dry else ''}Modificado main: updateViaCache: 'none' en SW")
    else:
        print("  AVISO: Si usas Service Worker, regístralo con { updateViaCache: 'none' }")

    vercel = frontend / "vercel.json"
    if vercel.exists():
        if patch_vercel_headers(vercel, dry):
            print(f"  {'(dry) ' if dry else ''}Modificado vercel.json: cabeceras no-cache para /, index.html, version.json")
    else:
        print("  AVISO: Crea vercel.json con headers Cache-Control para /, /index.html y /version.json (ver ACTUALIZACION_AUTO.md)")

    app_candidates = [frontend / "src" / "App.jsx", frontend / "src" / "App.tsx"]
    app_path = next((f for f in app_candidates if f.exists()), None)
    if app_path:
        try:
            if ensure_version_checker_in_app(app_path, dry):
                print(f"  {'(dry) ' if dry else ''}Modificado App: import y <VersionChecker />")
        except Exception as e:
            print(f"  AVISO: No se pudo inyectar VersionChecker en App: {e}")
            print("  Añade manualmente: import VersionChecker from './components/VersionChecker'; y <VersionChecker /> en el layout.")
    else:
        print("  AVISO: No se encontró App.jsx/App.tsx. Añade <VersionChecker /> en tu layout principal.")

    print("\nListo. Siguiente paso: subir versión en src/config/version.js, hacer build y desplegar.")
    print("Ver ACTUALIZACION_AUTO.md para despliegue y script deploy_y_notificar.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
