import unittest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from backend import auth


class UsernameTests(unittest.TestCase):
    def test_username_normalization_and_email_rejection(self):
        self.assertEqual(auth._normalize_username("  Admin  "), "admin")
        for value in ("a", "a b", "nome@empresa.com"):
            with self.assertRaises(HTTPException):
                auth._normalize_username(value)

    @patch.object(auth, "lookup_fingerprint", side_effect=lambda name, context: name)
    @patch.object(auth, "encrypt_json", return_value=(b"n", b"c", 1))
    @patch.object(auth, "decrypt_json")
    @patch.object(auth, "transaction")
    @patch.object(auth, "ensure_schema")
    def test_migration_preserves_passwords_and_resolves_names(self, schema, transaction, decrypt, encrypt, fingerprint):
        cursor = MagicMock()
        transaction.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = cursor
        cursor.fetchone.return_value = {"applied": False}
        cursor.fetchall.return_value = [
            dict(id=str(i), role=role, profile_nonce=b"n", profile_ciphertext=b"c", key_version=1)
            for i, role in enumerate(["FINANCE", "ADMIN", "AUDITOR"])
        ]
        decrypt.side_effect = [{"email": "admin@a.com"}, {"email": "owner@a.com"}, {"email": "admin@b.com"}]
        auth.ensure_username_migration()
        names = [call.args[0]["username"] for call in encrypt.call_args_list]
        self.assertEqual(names, ["usuario", "admin", "usuario2"])
        updates = [call.args[0] for call in cursor.execute.call_args_list if call.args[0].startswith("UPDATE")]
        self.assertEqual(len(updates), 3)
        self.assertTrue(all("password_hash" not in sql for sql in updates))
        cursor.reset_mock()
        cursor.fetchone.return_value = {"applied": True}
        auth.ensure_username_migration()
        cursor.fetchall.assert_not_called()

    @patch.object(auth, "_profile_from_row", return_value={"username": "admin"})
    @patch.object(auth, "_create_session")
    @patch.object(auth, "_verify_password", return_value=True)
    @patch.object(auth, "ensure_username_migration")
    @patch.object(auth, "lookup_fingerprint", return_value="lookup")
    @patch.object(auth, "encryption_configured", return_value=True)
    @patch.object(auth, "database_configured", return_value=True)
    @patch.object(auth, "transaction")
    def test_login_uses_username_and_existing_password(self, transaction, db, enc, lookup, migration, verify, session, profile):
        cursor = MagicMock()
        transaction.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = cursor
        cursor.fetchone.side_effect = [
            {"total": 0},
            {"id": "user-id", "password_hash": "existing-hash", "active": True},
            {"last_login_at": None},
        ]
        result = auth.login_user(auth.LoginRequest(username="Admin", password="existing-password"), MagicMock())
        self.assertEqual(result["username"], "admin")
        verify.assert_called_once_with("existing-password", "existing-hash")
        lookup.assert_called_once_with("admin", "auth-email")
        session.assert_called_once()
