import base64
import os
import secrets
import unittest
from pathlib import Path
from unittest.mock import patch

from cryptography.exceptions import InvalidTag
from fastapi.testclient import TestClient

from backend import auth, database
from backend.encryption import decrypt_bytes, decrypt_json, encrypt_bytes, encrypt_json, lookup_fingerprint
from backend.main import app


class EncryptionTests(unittest.TestCase):
    def setUp(self):
        self.key = base64.b64encode(secrets.token_bytes(32)).decode("ascii")
        self.environment = patch.dict(os.environ, {"APP_ENCRYPTION_KEY": self.key})
        self.environment.start()

    def tearDown(self):
        self.environment.stop()

    def test_encrypts_and_decrypts_json_with_authenticated_context(self):
        payload = {"valor": 1250.75, "fornecedor": "Empresa Confidencial"}
        nonce, ciphertext, version = encrypt_json(payload, "lancamento:123")

        self.assertNotIn(b"Empresa Confidencial", ciphertext)
        self.assertEqual(decrypt_json(nonce, ciphertext, "lancamento:123", version), payload)

        with self.assertRaises(InvalidTag):
            decrypt_json(nonce, ciphertext, "lancamento:outro", version)

    def test_encrypts_binary_documents(self):
        content = b"%PDF-1.7 dados financeiros sigilosos"
        nonce, ciphertext, version = encrypt_bytes(content, "arquivo:abc")

        self.assertNotEqual(ciphertext, content)
        self.assertEqual(decrypt_bytes(nonce, ciphertext, "arquivo:abc", version), content)

    def test_lookup_fingerprint_is_deterministic_without_exposing_email(self):
        first = lookup_fingerprint("Admin@Empresa.com", "auth-email")
        second = lookup_fingerprint(" admin@empresa.com ", "auth-email")

        self.assertEqual(first, second)
        self.assertNotIn("admin", first)
        self.assertNotEqual(first, lookup_fingerprint("outro@empresa.com", "auth-email"))

    def test_password_uses_salted_pbkdf2_hash(self):
        password = "Senha-Administrativa-Forte-2026"
        encoded = auth._password_hash(password)

        self.assertTrue(auth._verify_password(password, encoded))
        self.assertFalse(auth._verify_password("senha-incorreta", encoded))
        self.assertNotIn(password, encoded)

    def test_database_schema_stores_encrypted_payloads(self):
        migration = (Path(__file__).parents[1] / "backend" / "migrations" / "001_neon_persistence.sql").read_text()

        self.assertIn("payload_ciphertext BYTEA", migration)
        self.assertIn("content_ciphertext BYTEA", migration)
        self.assertNotIn("payload JSONB", migration)

    def test_database_url_enforces_tls(self):
        with patch.dict(os.environ, {"DATABASE_URL": "postgresql://user:pass@example.test/db"}):
            with patch.object(database.psycopg2, "connect") as connect_mock:
                database.connect()

        self.assertEqual(connect_mock.call_args.kwargs["sslmode"], "require")


class AuthenticationApiWithoutDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(
            os.environ,
            {},
            clear=False,
        )
        self.env.start()
        for name in ("DATABASE_URL", "DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"):
            os.environ.pop(name, None)
        self.client = TestClient(app)

    def tearDown(self):
        self.env.stop()

    def test_status_reports_database_not_configured(self):
        response = self.client.get("/api/auth/status")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertFalse(response.json()["databaseConfigured"])
        self.assertFalse(response.json()["authenticated"])

    def test_state_endpoint_is_not_public(self):
        response = self.client.get("/api/state")

        self.assertEqual(response.status_code, 503)

    def test_login_cannot_run_without_protected_database(self):
        response = self.client.post(
            "/api/auth/login",
            json={"email": "admin@empresa.com", "password": "qualquer-senha"},
        )

        self.assertEqual(response.status_code, 503)


if __name__ == "__main__":
    unittest.main()
