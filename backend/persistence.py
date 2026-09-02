from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from typing import Any

from psycopg2.extras import RealDictCursor

from .database import ensure_schema, transaction
from .encryption import decrypt_bytes, decrypt_json, encrypt_bytes, encrypt_json
from .state_models import ApplicationState


COLLECTIONS = (
    "units",
    "categorias",
    "centrosCusto",
    "fornecedores",
    "bancos",
    "condicoesPagamento",
    "users",
    "lancamentos",
    "parcelamentos",
    "documentosOCR",
    "auditLogs",
    "regrasAutomacao",
    "dreData",
    "dreVersions",
    "fechamentosMensais",
)
SINGLETONS = ("sessaoCaixa", "fechamentoMensal")
OPERATIONAL_CLEANUP_VERSION = 2
OPERATIONAL_COLLECTIONS_TO_DELETE = (
    "units",
    "bancos",
    "lancamentos",
    "parcelamentos",
    "documentosOCR",
    "auditLogs",
    "dreVersions",
    "fechamentosMensais",
)
EMPTY_OPERATIONAL_SINGLETONS: dict[str, dict[str, Any]] = {
    "sessaoCaixa": {
        "id": "caixa-fisico-continuo",
        "movimentacoes": [],
    },
    "fechamentoMensal": {
        "mesAno": "",
        "status": "ABERTO",
        "checklist": [],
        "observacoes": "",
    },
}


class StateConflictError(RuntimeError):
    def __init__(self, current_revision: int):
        super().__init__("O estado foi alterado por outra sessão.")
        self.current_revision = current_revision


@dataclass(frozen=True)
class StoredFile:
    id: str
    file_name: str
    mime_type: str
    size_bytes: int
    sha256: str


def _validated_entities(collection: str, entities: list[dict[str, Any]]) -> list[tuple[str, dict[str, Any]]]:
    seen: set[str] = set()
    validated: list[tuple[str, dict[str, Any]]] = []
    for position, entity in enumerate(entities):
        identifier = entity.get("id")
        if collection == "dreData" and not identifier:
            identifier = entity.get("codigo")
        entity_id = str(identifier or "").strip()
        if not entity_id:
            raise ValueError(
                f'A coleção "{collection}" possui um registro sem ID'
                f'{" ou código" if collection == "dreData" else ""}.'
            )
        if entity_id in seen:
            if collection != "auditLogs":
                raise ValueError(f'ID duplicado em "{collection}": {entity_id}')

            original_id = entity_id
            entity_id = f"{original_id}-reparado-{position + 1}"
            repair_number = 2
            while entity_id in seen:
                entity_id = f"{original_id}-reparado-{position + 1}-{repair_number}"
                repair_number += 1
            entity = {**entity, "id": entity_id}
        seen.add(entity_id)
        validated.append((entity_id, entity))
    return validated


def _apply_requested_operational_cleanup() -> bool:
    """Apply the user-requested production cleanup exactly once."""
    with transaction() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                "SELECT pg_advisory_xact_lock(hashtext('rf-operational-cleanup-v2'))"
            )
            cursor.execute(
                "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = %s) AS applied",
                (OPERATIONAL_CLEANUP_VERSION,),
            )
            if bool(cursor.fetchone()["applied"]):
                return False

            cursor.execute(
                "DELETE FROM app_entities WHERE collection = ANY(%s)",
                (list(OPERATIONAL_COLLECTIONS_TO_DELETE),),
            )
            cursor.execute("DELETE FROM document_files")
            cursor.execute("DELETE FROM auth_login_attempts")

            for state_key, payload in EMPTY_OPERATIONAL_SINGLETONS.items():
                nonce, ciphertext, key_version = encrypt_json(
                    payload,
                    f"app_singletons:{state_key}",
                )
                cursor.execute(
                    """
                    INSERT INTO app_singletons (
                        state_key, payload_nonce, payload_ciphertext, key_version, updated_at
                    )
                    VALUES (%s, %s, %s, %s, NOW())
                    ON CONFLICT (state_key) DO UPDATE
                    SET payload_nonce = EXCLUDED.payload_nonce,
                        payload_ciphertext = EXCLUDED.payload_ciphertext,
                        key_version = EXCLUDED.key_version,
                        updated_at = NOW()
                    """,
                    (state_key, nonce, ciphertext, key_version),
                )

            cursor.execute(
                """
                UPDATE application_state_meta
                SET revision = revision + 1, updated_at = NOW()
                WHERE singleton = TRUE
                """
            )
            cursor.execute(
                "INSERT INTO schema_migrations (version) VALUES (%s)",
                (OPERATIONAL_CLEANUP_VERSION,),
            )
    return True


def load_application_state() -> tuple[int, ApplicationState | None]:
    ensure_schema()
    _apply_requested_operational_cleanup()
    with transaction() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT revision FROM application_state_meta WHERE singleton = TRUE")
            meta = cursor.fetchone()
            revision = int(meta["revision"] if meta else 0)

            cursor.execute(
                """
                SELECT collection, entity_id, payload_nonce, payload_ciphertext, key_version
                FROM app_entities
                ORDER BY collection, position, entity_id
                """
            )
            entity_rows = cursor.fetchall()
            cursor.execute(
                "SELECT state_key, payload_nonce, payload_ciphertext, key_version FROM app_singletons"
            )
            singleton_rows = cursor.fetchall()

    if not entity_rows and not singleton_rows:
        return revision, None

    raw_state: dict[str, Any] = {collection: [] for collection in COLLECTIONS}
    raw_state.update({key: {} for key in SINGLETONS})
    for row in entity_rows:
        collection = row["collection"]
        if collection in raw_state and isinstance(raw_state[collection], list):
            raw_state[collection].append(
                decrypt_json(
                    bytes(row["payload_nonce"]),
                    bytes(row["payload_ciphertext"]),
                    f"app_entities:{collection}:{row['entity_id']}",
                    row["key_version"],
                )
            )
    for row in singleton_rows:
        if row["state_key"] in SINGLETONS:
            state_key = row["state_key"]
            raw_state[state_key] = decrypt_json(
                bytes(row["payload_nonce"]),
                bytes(row["payload_ciphertext"]),
                f"app_singletons:{state_key}",
                row["key_version"],
            )

    return revision, ApplicationState.model_validate(raw_state)


def save_application_state(
    state: ApplicationState,
    expected_revision: int,
    updated_by: str | None,
) -> int:
    ensure_schema()
    state_dict = state.model_dump(mode="json")
    prepared = {
        collection: _validated_entities(collection, state_dict[collection])
        for collection in COLLECTIONS
    }

    with transaction() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                "SELECT revision FROM application_state_meta WHERE singleton = TRUE FOR UPDATE"
            )
            meta = cursor.fetchone()
            current_revision = int(meta["revision"] if meta else 0)
            if current_revision != expected_revision:
                raise StateConflictError(current_revision)

            for collection, entities in prepared.items():
                cursor.execute("DELETE FROM app_entities WHERE collection = %s", (collection,))
                if entities:
                    encrypted_entities = []
                    for position, (entity_id, payload) in enumerate(entities):
                        nonce, ciphertext, key_version = encrypt_json(
                            payload,
                            f"app_entities:{collection}:{entity_id}",
                        )
                        encrypted_entities.append(
                            (collection, entity_id, nonce, ciphertext, key_version, position)
                        )
                    cursor.executemany(
                        """
                        INSERT INTO app_entities (
                            collection, entity_id, payload_nonce, payload_ciphertext, key_version, position, updated_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, NOW())
                        """,
                        encrypted_entities,
                    )

            for state_key in SINGLETONS:
                nonce, ciphertext, key_version = encrypt_json(
                    state_dict[state_key],
                    f"app_singletons:{state_key}",
                )
                cursor.execute(
                    """
                    INSERT INTO app_singletons (
                        state_key, payload_nonce, payload_ciphertext, key_version, updated_at
                    )
                    VALUES (%s, %s, %s, %s, NOW())
                    ON CONFLICT (state_key) DO UPDATE
                    SET payload_nonce = EXCLUDED.payload_nonce,
                        payload_ciphertext = EXCLUDED.payload_ciphertext,
                        key_version = EXCLUDED.key_version,
                        updated_at = NOW()
                    """,
                    (state_key, nonce, ciphertext, key_version),
                )

            next_revision = current_revision + 1
            cursor.execute(
                """
                UPDATE application_state_meta
                SET revision = %s, updated_at = NOW(), updated_by_id = %s
                WHERE singleton = TRUE
                """,
                (next_revision, updated_by),
            )
    return next_revision


def store_file(file_name: str, mime_type: str, content: bytes) -> StoredFile:
    ensure_schema()
    digest = hashlib.sha256(content).hexdigest()
    file_id = str(uuid.uuid4())
    with transaction() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT id::text, size_bytes, sha256, metadata_nonce, metadata_ciphertext, key_version
                FROM document_files
                WHERE sha256 = %s
                """,
                (digest,),
            )
            existing = cursor.fetchone()
            if existing:
                metadata = decrypt_json(
                    bytes(existing["metadata_nonce"]),
                    bytes(existing["metadata_ciphertext"]),
                    f"document_files:metadata:{existing['id']}",
                    existing["key_version"],
                )
                return StoredFile(
                    id=existing["id"],
                    file_name=metadata["file_name"],
                    mime_type=metadata["mime_type"],
                    size_bytes=existing["size_bytes"],
                    sha256=existing["sha256"],
                )

            metadata_nonce, metadata_ciphertext, key_version = encrypt_json(
                {"file_name": file_name, "mime_type": mime_type},
                f"document_files:metadata:{file_id}",
            )
            content_nonce, content_ciphertext, _ = encrypt_bytes(
                content,
                f"document_files:content:{file_id}",
            )
            cursor.execute(
                """
                INSERT INTO document_files (
                    id, size_bytes, sha256, metadata_nonce, metadata_ciphertext,
                    content_nonce, content_ciphertext, key_version
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    file_id,
                    len(content),
                    digest,
                    metadata_nonce,
                    metadata_ciphertext,
                    content_nonce,
                    content_ciphertext,
                    key_version,
                ),
            )
    return StoredFile(file_id, file_name, mime_type, len(content), digest)


def fetch_file(file_id: str) -> tuple[StoredFile, bytes] | None:
    try:
        uuid.UUID(file_id)
    except ValueError:
        return None

    ensure_schema()
    with transaction() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT id::text, size_bytes, sha256, metadata_nonce, metadata_ciphertext,
                       content_nonce, content_ciphertext, key_version
                FROM document_files
                WHERE id = %s
                """,
                (file_id,),
            )
            row = cursor.fetchone()
    if not row:
        return None
    metadata = decrypt_json(
        bytes(row["metadata_nonce"]),
        bytes(row["metadata_ciphertext"]),
        f"document_files:metadata:{row['id']}",
        row["key_version"],
    )
    content = decrypt_bytes(
        bytes(row["content_nonce"]),
        bytes(row["content_ciphertext"]),
        f"document_files:content:{row['id']}",
        row["key_version"],
    )
    stored = StoredFile(
        id=row["id"],
        file_name=metadata["file_name"],
        mime_type=metadata["mime_type"],
        size_bytes=row["size_bytes"],
        sha256=row["sha256"],
    )
    return stored, content
