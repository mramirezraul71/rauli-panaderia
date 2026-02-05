# -*- coding: utf-8 -*-
"""
Sube AAB y mapping a Google Play vía API (opcional).
Requiere: cuenta de servicio con Android Publisher API habilitada.
Ver GOOGLE_PLAY_SETUP.md para configurar.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = "com.raulipanaderia.app"


def _load_creds():
    paths = [
        Path(r"C:\dev\credenciales.txt"),
        ROOT / "credenciales.txt",
        Path.home() / "credenciales.txt",
    ]
    for p in paths:
        if p.exists():
            try:
                for line in p.read_text(encoding="utf-8").splitlines():
                    if "=" in line and not line.strip().startswith("#"):
                        k, _, v = line.partition("=")
                        if k.strip() == "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON" and v.strip():
                            return v.strip().strip("'\"").strip()
            except Exception:
                pass
    return os.environ.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "")


def main() -> int:
    json_path = _load_creds()
    if not json_path or not Path(json_path).exists():
        print("Configura GOOGLE_PLAY_SERVICE_ACCOUNT_JSON en credenciales.txt")
        print("Ruta al JSON de la cuenta de servicio. Ver GOOGLE_PLAY_SETUP.md")
        return 1

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
    except ImportError:
        print("Instala: pip install google-auth google-api-python-client")
        return 1

    # Leer version desde version.js
    vjs = ROOT / "frontend" / "src" / "config" / "version.js"
    version = "2026.02.02"
    if vjs.exists():
        import re
        m = re.search(r'APP_VERSION\s*=\s*["\']([^"\']+)["\']', vjs.read_text(encoding="utf-8"))
        if m:
            version = m.group(1)
    version_code = int(version.replace(".", ""))
    aab = ROOT / f"RauliERP-Panaderia-{version}-release.aab"
    mapping = ROOT / f"mapping-{version}.txt"

    if not aab.exists():
        print(f"No existe {aab}. Ejecuta PUBLICAR_ANDROID.bat primero.")
        return 1

    creds = service_account.Credentials.from_service_account_file(
        json_path,
        scopes=["https://www.googleapis.com/auth/androidpublisher"],
    )
    service = build("androidpublisher", "v3", credentials=creds)

    edit = service.edits().insert(packageName=PACKAGE, body={}).execute()
    edit_id = edit["id"]

    print("Subiendo AAB...")
    bundle = service.edits().bundles().upload(
        editId=edit_id,
        packageName=PACKAGE,
        media_body=MediaFileUpload(str(aab), mimetype="application/octet-stream", resumable=True),
    ).execute()
    ver_code = bundle.get("versionCode")

    if mapping.exists() and ver_code:
        print("Subiendo mapping...")
        # Mapping se sube al bundle; la API v3 lo maneja en deobfuscationFiles
        # Ver docs: edits.deobfuscationfiles.upload
        try:
            service.edits().deobfuscationfiles().upload(
                editId=edit_id,
                packageName=PACKAGE,
                apkVersionCode=ver_code,
                deobfuscationFileType="proguard",
                media_body=MediaFileUpload(str(mapping), mimetype="application/octet-stream"),
            ).execute()
        except Exception as e:
            print("Mapping (opcional):", e)

    if ver_code:
        print("Asignando a Internal testing...")
        service.edits().tracks().update(
            editId=edit_id,
            packageName=PACKAGE,
            track="internal",
            body={"releases": [{"versionCodes": [ver_code], "status": "completed"}]},
        ).execute()

    commit = service.edits().commit(editId=edit_id, packageName=PACKAGE).execute()
    print("Listo. Version", ver_code, "en Internal testing.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
