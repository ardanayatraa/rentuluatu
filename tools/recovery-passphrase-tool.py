#!/usr/bin/env python3
"""
Wavy recovery passphrase tool (standalone, outside app).

Use this script to read a recovery key file (*.key.wavy), extract the backup
passphrase, and optionally write it to the local `.backup-key` file so restore
works on a replacement laptop.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import sys
from pathlib import Path
from typing import Any

import hashlib

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError as exc:  # pragma: no cover
    print(
        "Module 'cryptography' belum terpasang.\n"
        "Install dulu: pip install cryptography",
        file=sys.stderr,
    )
    raise SystemExit(2) from exc


ENC_MAGIC = b"WAVY01"
SALT_LEN = 32
IV_LEN = 12
TAG_LEN = 16
DEFAULT_RECOVERY_PASSWORD = "wavy2026"


def derive_key(passphrase: str, salt: bytes) -> bytes:
    return hashlib.scrypt(
        passphrase.encode("utf-8"),
        salt=salt,
        n=16384,
        r=8,
        p=1,
        dklen=32,
    )


def decrypt_wavy_blob(blob: bytes, passphrase: str) -> bytes:
    if len(blob) < 6 + SALT_LEN + IV_LEN + TAG_LEN:
        raise ValueError("File terlalu kecil / tidak valid")

    if blob[:6] != ENC_MAGIC:
        raise ValueError("Header file bukan backup/recovery Wavy")

    offset = 6
    salt = blob[offset : offset + SALT_LEN]
    offset += SALT_LEN
    iv = blob[offset : offset + IV_LEN]
    offset += IV_LEN
    tag = blob[offset : offset + TAG_LEN]
    offset += TAG_LEN
    ciphertext = blob[offset:]

    key = derive_key(passphrase, salt)
    aesgcm = AESGCM(key)
    try:
        return aesgcm.decrypt(iv, ciphertext + tag, None)
    except Exception as exc:  # pragma: no cover
        raise ValueError("Password recovery salah atau file rusak") from exc


def default_user_data_dir(app_name: str) -> Path:
    app_name = app_name.strip() or "wavy"
    system = platform.system().lower()

    if system == "windows":
        base = os.environ.get("APPDATA")
        if not base:
            raise RuntimeError("APPDATA tidak ditemukan")
        return Path(base) / app_name
    if system == "darwin":
        return Path.home() / "Library" / "Application Support" / app_name
    return Path.home() / ".config" / app_name


def load_payload(key_file: Path, recovery_password: str) -> dict[str, Any]:
    raw = key_file.read_bytes()
    decrypted = decrypt_wavy_blob(raw, recovery_password)
    try:
        payload = json.loads(decrypted.decode("utf-8"))
    except Exception as exc:  # pragma: no cover
        raise ValueError("Isi recovery key tidak valid (bukan JSON)") from exc
    if not isinstance(payload, dict):
        raise ValueError("Format payload recovery key tidak valid")
    if "passphrase" not in payload:
        raise ValueError("Field passphrase tidak ditemukan di recovery key")
    return payload


def mask_secret(value: str) -> str:
    if len(value) <= 6:
        return "*" * len(value)
    return f"{value[:3]}{'*' * (len(value) - 6)}{value[-3:]}"


def write_passphrase_file(path: Path, passphrase: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(passphrase, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract/apply Wavy backup passphrase from recovery key file."
    )
    parser.add_argument(
        "--key-file",
        required=True,
        help="Path file recovery key (*.key.wavy).",
    )
    parser.add_argument(
        "--backup-name",
        default="",
        help="Optional expected backup filename for validation.",
    )
    parser.add_argument(
        "--recovery-password",
        default=DEFAULT_RECOVERY_PASSWORD,
        help=f"Password pembuka recovery key (default: {DEFAULT_RECOVERY_PASSWORD}).",
    )
    parser.add_argument(
        "--show-passphrase",
        action="store_true",
        help="Tampilkan passphrase asli di console.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Tulis passphrase ke file .backup-key target.",
    )
    parser.add_argument(
        "--app-name",
        default="wavy",
        help="Nama folder app di user data (default: wavy).",
    )
    parser.add_argument(
        "--user-data-dir",
        default="",
        help="Override folder user data app. Jika kosong, pakai default OS.",
    )
    parser.add_argument(
        "--key-path",
        default="",
        help="Override path file .backup-key target.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    key_file = Path(args.key_file).expanduser().resolve()
    if not key_file.exists():
        print(f"File recovery key tidak ditemukan: {key_file}", file=sys.stderr)
        return 1

    try:
        payload = load_payload(key_file, args.recovery_password)
    except Exception as exc:
        print(f"Gagal baca recovery key: {exc}", file=sys.stderr)
        return 1

    backup_filename = str(payload.get("backupFilename", "")).strip()
    passphrase = str(payload.get("passphrase", "")).strip()
    created_at = str(payload.get("createdAt", "")).strip()

    if not passphrase:
        print("Passphrase kosong di payload recovery key", file=sys.stderr)
        return 1

    expected_backup = str(args.backup_name or "").strip()
    if expected_backup and backup_filename and expected_backup != backup_filename:
        print(
            f"Backup name tidak cocok. expected={expected_backup} actual={backup_filename}",
            file=sys.stderr,
        )
        return 1

    print("Recovery key valid.")
    print(f"- backupFilename : {backup_filename or '(tidak ada)'}")
    print(f"- createdAt      : {created_at or '(tidak ada)'}")
    if args.show_passphrase:
        print(f"- passphrase     : {passphrase}")
    else:
        print(f"- passphrase     : {mask_secret(passphrase)}")

    if not args.apply:
        return 0

    if args.key_path:
        target = Path(args.key_path).expanduser().resolve()
    else:
        if args.user_data_dir:
            user_data_dir = Path(args.user_data_dir).expanduser().resolve()
        else:
            user_data_dir = default_user_data_dir(args.app_name)
        target = user_data_dir / ".backup-key"

    try:
        write_passphrase_file(target, passphrase)
    except Exception as exc:
        print(f"Gagal menulis file key: {exc}", file=sys.stderr)
        return 1

    print(f"Berhasil set passphrase ke: {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
