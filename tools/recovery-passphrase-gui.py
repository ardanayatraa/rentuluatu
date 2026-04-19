#!/usr/bin/env python3
"""
Wavy Recovery Passphrase GUI

GUI helper for developers:
- Pick backup file (.wavy)
- Pick recovery key file (.key.wavy)
- Check key/backup compatibility
- Apply recovered passphrase to target .backup-key path
"""

from __future__ import annotations

import json
import os
import platform
from pathlib import Path
import hashlib
import socket
import tkinter as tk
from tkinter import filedialog, messagebox

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    raise SystemExit(
        "Module 'cryptography' belum terpasang.\n"
        "Install dulu: pip install cryptography"
    )


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
        raise ValueError("Header file bukan format Wavy")

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
    except Exception as exc:
        raise ValueError("Decrypt gagal (password salah / file rusak)") from exc


def parse_recovery_payload(key_file: Path, recovery_password: str) -> dict:
    raw = key_file.read_bytes()
    decrypted = decrypt_wavy_blob(raw, recovery_password)
    payload = json.loads(decrypted.decode("utf-8"))
    if not isinstance(payload, dict) or not payload.get("passphrase"):
        raise ValueError("Recovery key tidak valid")
    return payload


def default_user_data_dir(app_name: str = "wavy") -> Path:
    system = platform.system().lower()
    if system == "windows":
        base = os.environ.get("APPDATA")
        if not base:
            raise RuntimeError("APPDATA tidak ditemukan")
        return Path(base) / app_name
    if system == "darwin":
        return Path.home() / "Library" / "Application Support" / app_name
    return Path.home() / ".config" / app_name


def get_machine_id() -> str:
    """
    Mirror app logic from src/main/lib/license.js:
    sha256(hostname|platform|arch|cpuModel).slice(0,16).toUpperCase()
    """
    hostname = socket.gethostname()
    plat = platform.system().lower()
    arch = platform.machine().lower()
    cpu_model = platform.processor() or ""
    info = f"{hostname}|{plat}|{arch}|{cpu_model}"
    return hashlib.sha256(info.encode("utf-8")).hexdigest()[:16].upper()


class App:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Wavy Recovery Passphrase GUI")
        self.root.geometry("820x500")

        self.backup_path = tk.StringVar()
        self.key_path = tk.StringVar()
        self.recovery_password = tk.StringVar(value=DEFAULT_RECOVERY_PASSWORD)
        self.local_machine_id = get_machine_id()
        self.target_device_id = tk.StringVar(value=self.local_machine_id)
        self.status_text = tk.StringVar(value="Pilih file backup dan recovery key.")
        self.recovered_passphrase = ""

        self._build_ui()

    def _build_ui(self):
        container = tk.Frame(self.root, padx=12, pady=12)
        container.pack(fill="both", expand=True)

        tk.Label(container, text="Backup (.wavy):").grid(row=0, column=0, sticky="w")
        tk.Entry(container, textvariable=self.backup_path, width=85).grid(
            row=1, column=0, sticky="we", padx=(0, 8)
        )
        tk.Button(container, text="Pilih Backup", command=self.pick_backup).grid(
            row=1, column=1
        )

        tk.Label(container, text="Recovery Key (.key.wavy):").grid(row=2, column=0, sticky="w", pady=(12, 0))
        tk.Entry(container, textvariable=self.key_path, width=85).grid(
            row=3, column=0, sticky="we", padx=(0, 8)
        )
        tk.Button(container, text="Pilih Key", command=self.pick_key).grid(row=3, column=1)

        tk.Label(container, text="Recovery Password (default):").grid(row=4, column=0, sticky="w", pady=(12, 0))
        tk.Entry(container, textvariable=self.recovery_password, width=40, show="*").grid(
            row=5, column=0, sticky="w"
        )

        tk.Label(container, text=f"ID Perangkat Saat Ini: {self.local_machine_id}").grid(
            row=6, column=0, sticky="w", pady=(12, 0)
        )
        tk.Label(container, text="ID Perangkat Target:").grid(row=7, column=0, sticky="w")
        tk.Entry(container, textvariable=self.target_device_id, width=40).grid(
            row=8, column=0, sticky="w"
        )

        action_frame = tk.Frame(container, pady=12)
        action_frame.grid(row=9, column=0, columnspan=2, sticky="w")
        tk.Button(action_frame, text="Check Cocok / Tidak", command=self.check_match).pack(side="left", padx=(0, 8))
        tk.Button(action_frame, text="Apply Key ke Device Ini", command=self.apply_key).pack(side="left", padx=(0, 8))
        tk.Button(action_frame, text="Cek + Apply", command=self.check_and_apply).pack(side="left")

        status_box = tk.LabelFrame(container, text="Status / Hasil", padx=8, pady=8)
        status_box.grid(row=10, column=0, columnspan=2, sticky="nsew")
        container.grid_rowconfigure(10, weight=1)
        container.grid_columnconfigure(0, weight=1)

        self.status_widget = tk.Text(status_box, wrap="word", height=14)
        self.status_widget.pack(fill="both", expand=True)
        self._append_status(self.status_text.get())

    def _append_status(self, text: str):
        self.status_widget.insert("end", f"{text}\n")
        self.status_widget.see("end")

    def pick_backup(self):
        path = filedialog.askopenfilename(
            title="Pilih file backup .wavy",
            filetypes=[("Wavy backup", "*.wavy"), ("All files", "*.*")],
        )
        if path:
            self.backup_path.set(path)

    def pick_key(self):
        path = filedialog.askopenfilename(
            title="Pilih file recovery key .key.wavy",
            filetypes=[("Recovery key", "*.key.wavy"), ("All files", "*.*")],
        )
        if path:
            self.key_path.set(path)

    def _load_and_check(self):
        backup = Path(self.backup_path.get().strip())
        key = Path(self.key_path.get().strip())
        if not backup.exists():
            raise ValueError("File backup tidak ditemukan")
        if not key.exists():
            raise ValueError("File recovery key tidak ditemukan")

        payload = parse_recovery_payload(key, self.recovery_password.get().strip())
        passphrase = str(payload.get("passphrase", "")).strip()
        payload_backup_name = str(payload.get("backupFilename", "")).strip()
        if not passphrase:
            raise ValueError("Passphrase kosong di recovery key")

        if payload_backup_name and payload_backup_name != backup.name:
            raise ValueError(
                f"Tidak cocok: key untuk '{payload_backup_name}', "
                f"tapi backup dipilih '{backup.name}'"
            )

        # Real check: test decrypt backup with extracted passphrase.
        try:
            decrypt_wavy_blob(backup.read_bytes(), passphrase)
        except Exception as exc:
            raise ValueError(f"Key tidak cocok untuk backup ini: {exc}") from exc

        self.recovered_passphrase = passphrase
        return payload

    def check_match(self):
        try:
            payload = self._load_and_check()
        except Exception as exc:
            self._append_status(f"[ERROR] {exc}")
            messagebox.showerror("Tidak Cocok", str(exc))
            return

        self._append_status("[OK] Recovery key cocok dengan file backup.")
        self._append_status(f"backupFilename: {payload.get('backupFilename', '-')}")
        self._append_status(f"createdAt: {payload.get('createdAt', '-')}")
        messagebox.showinfo("Cocok", "Recovery key cocok dan backup bisa didecrypt.")

    def apply_key(self):
        if not self.recovered_passphrase:
            messagebox.showwarning("Belum Dicek", "Jalankan 'Check Cocok / Tidak' dulu.")
            return
        target_device_id = self.target_device_id.get().strip().upper()
        if not target_device_id:
            messagebox.showerror("ID Target", "ID perangkat target wajib diisi.")
            return
        if target_device_id != self.local_machine_id:
            proceed = messagebox.askyesno(
                "ID Berbeda",
                "ID perangkat target berbeda dengan ID perangkat terdeteksi.\n"
                "Lanjut apply ke perangkat ini tetap?"
            )
            if not proceed:
                return
        target = default_user_data_dir("wavy") / ".backup-key"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(self.recovered_passphrase, encoding="utf-8")
        self._append_status(f"[OK] Passphrase ditulis ke perangkat {target_device_id}: {target}")
        messagebox.showinfo(
            "Sukses",
            f"Passphrase berhasil di-apply.\nPerangkat: {target_device_id}\nPath: {target}"
        )

    def check_and_apply(self):
        try:
            self._load_and_check()
            self.apply_key()
        except Exception as exc:
            self._append_status(f"[ERROR] {exc}")
            messagebox.showerror("Gagal", str(exc))


def main():
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
