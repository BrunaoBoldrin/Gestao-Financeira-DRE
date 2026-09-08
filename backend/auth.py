from __future__ import annotations

import base64
import hashlib
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import HTTPException, Request, Response, status
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel, Field

from .database import database_configured, ensure_schema, transaction
from .encryption import decrypt_json, encrypt_json, encryption_configured, lookup_fingerprint


COOKIE_NAME = "rf_admin_session"
SESSION_MAX_AGE_SECONDS = int(os.getenv("DATA_SESSION_MAX_AGE_SECONDS", str(12 * 60 * 60)))
PASSWORD_ITERATIONS = int(os.getenv("PASSWORD_PBKDF2_ITERATIONS", "600000"))
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
USERNAME_PATTERN = re.compile(r"^[a-z0-9_.-]{3,64}$")


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class SetupAdminRequest(BaseModel):
    setupToken: str = Field(min_length=16, max_length=500)
    name: str = Field(min_length=2, max_length=150)
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=12, max_length=128)


class CreateUserRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=12, max_length=128)
    role: Literal["ADMIN", "FINANCE", "AUDITOR"]
    unit: str = Field(min_length=2, max_length=150)
    active: bool = True


class UpdateUserRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    username: str = Field(min_length=3, max_length=64)
    password: str | None = Field(default=None, min_length=12, max_length=128)
    role: Literal["ADMIN", "FINANCE", "AUDITOR"]
    unit: str = Field(min_length=2, max_length=150)
    active: bool



def ensure_username_migration() -> None:
    ensure_schema()
    with transaction() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(hashtext('rf-username-migration'))")
            cursor.execute("SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 3) AS applied")
            if cursor.fetchone()["applied"]:
                return
            cursor.execute("SELECT id::text, profile_nonce, profile_ciphertext, key_version, role FROM auth_users ORDER BY created_at, id")
            rows = cursor.fetchall()
            used = set()
            admin_assigned = False
            for row in rows:
                profile = decrypt_json(bytes(row["profile_nonce"]), bytes(row["profile_ciphertext"]),
                                       f"auth_users:profile:{row['id']}", row["key_version"])
                if row["role"] == "ADMIN" and not admin_assigned:
                    username = "admin"
                    admin_assigned = True
                else:
                    base = re.sub(r"[^a-z0-9_.-]", "", profile.get("email", "").split("@")[0].casefold())[:50]
                    if len(base) < 3 or base == "admin":
                        base = "usuario"
                    username = base
                    suffix = 2
                    while username in used:
                        username = f"{base}{suffix}"
                        suffix += 1
                used.add(username)
                profile["username"] = username
                nonce, ciphertext, key_version = encrypt_json(profile, f"auth_users:profile:{row['id']}")
                cursor.execute("UPDATE auth_users SET email_lookup = %s, profile_nonce = %s, profile_ciphertext = %s, key_version = %s WHERE id = %s",
                               (lookup_fingerprint(username, "auth-email"), nonce, ciphertext, key_version, row["id"]))
            cursor.execute("INSERT INTO schema_migrations (version) VALUES (3)")

def _normalize_username(email: str) -> str:
    normalized = email.strip().casefold()
    if not USERNAME_PATTERN.match(normalized):
        raise HTTPException(status_code=422, detail="Use de 3 a 64 letras, números, pontos, hífens ou sublinhados no nome de usuário.")
    return normalized


def _normalized_profile(name: str, email: str, unit: str) -> tuple[dict, str]:
    normalized_name = name.strip()
    normalized_unit = unit.strip()
    if len(normalized_name) < 2:
        raise HTTPException(status_code=422, detail="Informe o nome do usuário.")
    if len(normalized_unit) < 2:
        raise HTTPException(status_code=422, detail="Informe a unidade do usuário.")
    normalized_email = _normalize_username(email)
    return {
        "name": normalized_name,
        "username": normalized_email,
        "unit": normalized_unit,
    }, normalized_email


def _validated_user_id(user_id: str) -> str:
    try:
        return str(uuid.UUID(user_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.") from exc


def _password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PASSWORD_ITERATIONS,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def _verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_text)
        expected = base64.b64decode(digest_text)
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, int(iterations_text)
        )
        return secrets.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


_DUMMY_PASSWORD_HASH = _password_hash("invalid-password-used-only-for-timing")


def _session_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _set_session_cookie(response: Response, token: str) -> None:
    secure_cookie = os.getenv("COOKIE_SECURE", "true").lower() != "false"
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=secure_cookie,
        samesite="strict",
        path="/",
    )


def _profile_from_row(row: dict) -> dict:
    profile = decrypt_json(
        bytes(row["profile_nonce"]),
        bytes(row["profile_ciphertext"]),
        f"auth_users:profile:{row['id']}",
        row["key_version"],
    )
    return {
        "id": row["id"],
        "name": profile["name"],
        "username": profile["username"],
        "role": row["role"],
        "unit": profile.get("unit", "Todas as Unidades"),
        "active": row["active"],
        "lastAccess": row["last_login_at"].isoformat() if row.get("last_login_at") else "Primeiro acesso",
    }


def current_authenticated_user(request: Request) -> dict | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token or not database_configured() or not encryption_configured():
        return None
    ensure_username_migration()
    with transaction() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT u.id::text, u.profile_nonce, u.profile_ciphertext, u.key_version,
                       u.role, u.active, u.last_login_at
                FROM auth_sessions s
                JOIN auth_users u ON u.id = s.user_id
                WHERE s.token_hash = %s AND s.revoked_at IS NULL
                  AND s.expires_at > NOW() AND u.active = TRUE
                LIMIT 1
                """,
                (_session_hash(token),),
            )
            row = cursor.fetchone()
    return _profile_from_row(row) if row else None


def _create_session(cursor, user_id: str, response: Response) -> None:
    token = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=SESSION_MAX_AGE_SECONDS)
    cursor.execute(
        "INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (%s, %s, %s, %s)",
        (str(uuid.uuid4()), user_id, _session_hash(token), expires_at),
    )
    _set_session_cookie(response, token)


def setup_admin(payload: SetupAdminRequest, response: Response) -> dict:
    if not database_configured() or not encryption_configured():
        raise HTTPException(status_code=503, detail="Configure a conexão e a chave de criptografia primeiro.")
    configured_token = os.getenv("APP_SETUP_TOKEN", "")
    if not configured_token or not secrets.compare_digest(payload.setupToken, configured_token):
        raise HTTPException(status_code=401, detail="Chave de configuração inicial inválida.")

    email = "admin"
    ensure_username_migration()
    user_id = str(uuid.uuid4())
    profile = {"name": payload.name.strip(), "username": email, "unit": "Todas as Unidades"}
    profile_nonce, profile_ciphertext, key_version = encrypt_json(
        profile, f"auth_users:profile:{user_id}"
    )

    with transaction() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(hashtext('rf-initial-admin-setup'))")
            cursor.execute("SELECT COUNT(*) AS total FROM auth_users")
            if int(cursor.fetchone()["total"]) > 0:
                raise HTTPException(status_code=409, detail="O administrador inicial já foi configurado.")
            cursor.execute(
                """
                INSERT INTO auth_users (
                    id, email_lookup, password_hash, profile_nonce, profile_ciphertext,
                    key_version, role, active, last_login_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'ADMIN', TRUE, NOW())
                RETURNING id::text, profile_nonce, profile_ciphertext, key_version,
                          role, active, last_login_at
                """,
                (
                    user_id,
                    lookup_fingerprint(email, "auth-email"),
                    _password_hash(payload.password),
                    profile_nonce,
                    profile_ciphertext,
                    key_version,
                ),
            )
            row = cursor.fetchone()
            _create_session(cursor, user_id, response)
    return _profile_from_row(row)


def login_user(payload: LoginRequest, response: Response) -> dict:
    if not database_configured() or not encryption_configured():
        raise HTTPException(status_code=503, detail="Banco ou criptografia não configurados.")
    email = _normalize_username(payload.username)
    email_lookup = lookup_fingerprint(email, "auth-email")
    ensure_username_migration()
    invalid_credentials = False

    with transaction() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                "DELETE FROM auth_login_attempts WHERE attempted_at <= NOW() - INTERVAL '24 hours'"
            )
            cursor.execute(
                """
                SELECT COUNT(*) AS total FROM auth_login_attempts
                WHERE email_lookup = %s AND successful = FALSE
                  AND attempted_at > NOW() - INTERVAL '15 minutes'
                """,
                (email_lookup,),
            )
            if int(cursor.fetchone()["total"]) >= MAX_FAILED_ATTEMPTS:
                raise HTTPException(
                    status_code=429,
                    detail=f"Muitas tentativas. Aguarde {LOCKOUT_MINUTES} minutos antes de tentar novamente.",
                )

            cursor.execute(
                """
                SELECT id::text, password_hash, profile_nonce, profile_ciphertext,
                       key_version, role, active, last_login_at
                FROM auth_users WHERE email_lookup = %s LIMIT 1
                """,
                (email_lookup,),
            )
            row = cursor.fetchone()
            valid_password = _verify_password(
                payload.password, row["password_hash"] if row else _DUMMY_PASSWORD_HASH
            )
            if not row or not valid_password or not row["active"]:
                cursor.execute(
                    "INSERT INTO auth_login_attempts (email_lookup, successful) VALUES (%s, FALSE)",
                    (email_lookup,),
                )
                invalid_credentials = True
            else:
                cursor.execute(
                    "UPDATE auth_users SET last_login_at = NOW() WHERE id = %s RETURNING last_login_at",
                    (row["id"],),
                )
                row["last_login_at"] = cursor.fetchone()["last_login_at"]
                cursor.execute("DELETE FROM auth_login_attempts WHERE email_lookup = %s", (email_lookup,))
                cursor.execute("DELETE FROM auth_sessions WHERE expires_at <= NOW() OR revoked_at IS NOT NULL")
                _create_session(cursor, row["id"], response)
    if invalid_credentials:
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos.")
    return _profile_from_row(row)


def create_auth_user(payload: CreateUserRequest) -> dict:
    if not database_configured() or not encryption_configured():
        raise HTTPException(status_code=503, detail="Banco ou criptografia não configurados.")

    profile, email = _normalized_profile(payload.name, payload.username, payload.unit)
    if payload.role == "FINANCE" and profile["unit"] == "Todas as Unidades":
        raise HTTPException(status_code=422, detail="Defina uma unidade específica para o perfil Financeiro.")
    user_id = str(uuid.uuid4())
    email_lookup = lookup_fingerprint(email, "auth-email")
    profile_nonce, profile_ciphertext, key_version = encrypt_json(
        profile, f"auth_users:profile:{user_id}"
    )
    ensure_username_migration()

    with transaction() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(hashtext('rf-auth-user-management'))")
            cursor.execute(
                "SELECT EXISTS (SELECT 1 FROM auth_users WHERE email_lookup = %s) AS present",
                (email_lookup,),
            )
            if cursor.fetchone()["present"]:
                raise HTTPException(status_code=409, detail="Já existe um usuário com este nome de usuário.")
            cursor.execute(
                """
                INSERT INTO auth_users (
                    id, email_lookup, password_hash, profile_nonce, profile_ciphertext,
                    key_version, role, active
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id::text, profile_nonce, profile_ciphertext, key_version,
                          role, active, last_login_at
                """,
                (
                    user_id,
                    email_lookup,
                    _password_hash(payload.password),
                    profile_nonce,
                    profile_ciphertext,
                    key_version,
                    payload.role,
                    payload.active,
                ),
            )
            row = cursor.fetchone()
    return _profile_from_row(row)


def list_auth_users() -> list[dict]:
    ensure_username_migration()
    with transaction() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT id::text, profile_nonce, profile_ciphertext, key_version,
                       role, active, last_login_at
                FROM auth_users
                ORDER BY created_at ASC
                """
            )
            rows = cursor.fetchall()
    return [_profile_from_row(row) for row in rows]


def update_auth_user(user_id: str, payload: UpdateUserRequest, actor: dict) -> dict:
    validated_user_id = _validated_user_id(user_id)
    if actor["id"] == validated_user_id:
        raise HTTPException(
            status_code=409,
            detail="Não é possível alterar o próprio usuário nesta tela.",
        )

    profile, email = _normalized_profile(payload.name, payload.username, payload.unit)
    if payload.role == "FINANCE" and profile["unit"] == "Todas as Unidades":
        raise HTTPException(status_code=422, detail="Defina uma unidade específica para o perfil Financeiro.")
    email_lookup = lookup_fingerprint(email, "auth-email")
    profile_nonce, profile_ciphertext, key_version = encrypt_json(
        profile, f"auth_users:profile:{validated_user_id}"
    )
    password_hash = _password_hash(payload.password) if payload.password else None
    ensure_username_migration()

    with transaction() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(hashtext('rf-auth-user-management'))")
            cursor.execute(
                "SELECT EXISTS (SELECT 1 FROM auth_users WHERE email_lookup = %s AND id <> %s) AS present",
                (email_lookup, validated_user_id),
            )
            if cursor.fetchone()["present"]:
                raise HTTPException(status_code=409, detail="Já existe outro usuário com este nome de usuário.")
            cursor.execute(
                """
                UPDATE auth_users
                SET email_lookup = %s,
                    password_hash = COALESCE(%s, password_hash),
                    profile_nonce = %s,
                    profile_ciphertext = %s,
                    key_version = %s,
                    role = %s,
                    active = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING id::text, profile_nonce, profile_ciphertext, key_version,
                          role, active, last_login_at
                """,
                (
                    email_lookup,
                    password_hash,
                    profile_nonce,
                    profile_ciphertext,
                    key_version,
                    payload.role,
                    payload.active,
                    validated_user_id,
                ),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Usuário não encontrado.")
            cursor.execute(
                "UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = %s AND revoked_at IS NULL",
                (validated_user_id,),
            )
    return _profile_from_row(row)


def delete_auth_user(user_id: str, actor: dict) -> None:
    validated_user_id = _validated_user_id(user_id)
    if actor["id"] == validated_user_id:
        raise HTTPException(
            status_code=409,
            detail="Não é possível excluir o próprio usuário durante a sessão.",
        )

    ensure_username_migration()
    with transaction() as conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM auth_users WHERE id = %s RETURNING id", (validated_user_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Usuário não encontrado.")


def logout(request: Request, response: Response) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if token and database_configured():
        ensure_username_migration()
        with transaction() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE auth_sessions SET revoked_at = NOW() WHERE token_hash = %s",
                    (_session_hash(token),),
                )
    response.delete_cookie(COOKIE_NAME, path="/")


def auth_status(request: Request) -> dict:
    database_ready = database_configured()
    encryption_ready = encryption_configured()
    setup_token_ready = bool(os.getenv("APP_SETUP_TOKEN"))
    admin_exists = False
    user = None
    error = None

    if database_ready and encryption_ready:
        try:
            ensure_username_migration()
            with transaction() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute("SELECT EXISTS (SELECT 1 FROM auth_users) AS present")
                    admin_exists = bool(cursor.fetchone()["present"])
            user = current_authenticated_user(request) if admin_exists else None
        except Exception as exc:
            error = exc.__class__.__name__

    return {
        "databaseConfigured": database_ready,
        "encryptionConfigured": encryption_ready,
        "setupTokenConfigured": setup_token_ready,
        "setupRequired": database_ready and encryption_ready and not admin_exists,
        "authenticated": user is not None,
        "user": user,
        "error": error,
    }


def require_data_access(request: Request) -> dict:
    if not database_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Banco não configurado.")
    if not encryption_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Criptografia não configurada.")
    user = current_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Faça login para continuar.")
    return user


def require_admin_access(request: Request) -> dict:
    user = require_data_access(request)
    if user["role"] != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem gerenciar usuários.",
        )
    return user


def require_write_access(request: Request) -> dict:
    user = require_data_access(request)
    if user["role"] == "AUDITOR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="O perfil de auditoria possui acesso somente para consulta.",
        )
    return user


def require_data_access_when_configured(request: Request) -> None:
    if database_configured():
        require_data_access(request)


def require_write_access_when_configured(request: Request) -> None:
    if database_configured():
        require_write_access(request)
