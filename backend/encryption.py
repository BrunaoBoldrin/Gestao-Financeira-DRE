from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


KEY_VERSION = 1


def encryption_configured() -> bool:
    try:
        encryption_key()
        return True
    except RuntimeError:
        return False


def encryption_key() -> bytes:
    encoded = os.getenv("APP_ENCRYPTION_KEY", "").strip()
    if not encoded:
        raise RuntimeError("APP_ENCRYPTION_KEY não foi configurada no Render.")
    try:
        key = base64.b64decode(encoded, validate=True)
    except ValueError as exc:
        raise RuntimeError("APP_ENCRYPTION_KEY deve estar em Base64.") from exc
    if len(key) != 32:
        raise RuntimeError("APP_ENCRYPTION_KEY deve representar exatamente 32 bytes.")
    return key


def encrypt_bytes(content: bytes, associated_data: str) -> tuple[bytes, bytes, int]:
    nonce = secrets.token_bytes(12)
    ciphertext = AESGCM(encryption_key()).encrypt(
        nonce,
        content,
        associated_data.encode("utf-8"),
    )
    return nonce, ciphertext, KEY_VERSION


def decrypt_bytes(nonce: bytes, ciphertext: bytes, associated_data: str, key_version: int) -> bytes:
    if key_version != KEY_VERSION:
        raise RuntimeError(f"Versão de chave não suportada: {key_version}")
    return AESGCM(encryption_key()).decrypt(
        nonce,
        ciphertext,
        associated_data.encode("utf-8"),
    )


def encrypt_json(payload: Any, associated_data: str) -> tuple[bytes, bytes, int]:
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return encrypt_bytes(serialized, associated_data)


def decrypt_json(nonce: bytes, ciphertext: bytes, associated_data: str, key_version: int) -> Any:
    serialized = decrypt_bytes(nonce, ciphertext, associated_data, key_version)
    return json.loads(serialized.decode("utf-8"))


def lookup_fingerprint(value: str, purpose: str) -> str:
    normalized = value.strip().casefold().encode("utf-8")
    derived_key = hmac.new(encryption_key(), f"lookup:{purpose}".encode("utf-8"), hashlib.sha256).digest()
    return hmac.new(derived_key, normalized, hashlib.sha256).hexdigest()
