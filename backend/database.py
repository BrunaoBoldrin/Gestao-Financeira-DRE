from __future__ import annotations

import os
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import psycopg2
from psycopg2.extensions import connection as PostgreSQLConnection


_REQUIRED_SPLIT_VARS = ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD")
_schema_lock = threading.Lock()
_schema_ready = False


def database_configured() -> bool:
    return bool(os.getenv("DATABASE_URL")) or all(os.getenv(name) for name in _REQUIRED_SPLIT_VARS)


def _connection_kwargs() -> dict[str, str | int]:
    if not database_configured():
        raise RuntimeError(
            "Banco PostgreSQL não configurado. Defina DATABASE_URL ou "
            "DB_HOST, DB_PORT, DB_NAME, DB_USER e DB_PASSWORD no Render."
        )

    return {
        "host": os.environ["DB_HOST"],
        "port": int(os.getenv("DB_PORT", "5432")),
        "dbname": os.environ["DB_NAME"],
        "user": os.environ["DB_USER"],
        "password": os.environ["DB_PASSWORD"],
        "sslmode": os.getenv("DB_SSLMODE", "require"),
        "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "10")),
        "application_name": "gestao-financeira-dre",
    }


def connect() -> PostgreSQLConnection:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return psycopg2.connect(
            database_url,
            sslmode=os.getenv("DB_SSLMODE", "require"),
            connect_timeout=int(os.getenv("DB_CONNECT_TIMEOUT", "10")),
            application_name="gestao-financeira-dre",
        )
    return psycopg2.connect(**_connection_kwargs())


@contextmanager
def transaction() -> Iterator[PostgreSQLConnection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def ensure_schema() -> None:
    global _schema_ready
    if _schema_ready:
        return
    if not database_configured():
        raise RuntimeError("Banco PostgreSQL não configurado.")

    with _schema_lock:
        if _schema_ready:
            return
        migration_path = Path(__file__).with_name("migrations") / "001_neon_persistence.sql"
        migration_sql = migration_path.read_text(encoding="utf-8")
        with transaction() as conn:
            with conn.cursor() as cursor:
                cursor.execute(migration_sql)
        _schema_ready = True


def database_health() -> dict[str, str | bool]:
    if not database_configured():
        return {"configured": False, "status": "not_configured"}

    try:
        ensure_schema()
        conn = connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        finally:
            conn.close()
        return {"configured": True, "status": "ok"}
    except Exception as exc:
        return {
            "configured": True,
            "status": "error",
            "detail": exc.__class__.__name__,
        }
