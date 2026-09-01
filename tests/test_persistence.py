import unittest
from unittest.mock import MagicMock, patch

from backend.persistence import (
    EMPTY_OPERATIONAL_SINGLETONS,
    OPERATIONAL_COLLECTIONS_TO_DELETE,
    _apply_requested_operational_cleanup,
    _validated_entities,
)


class PersistenceValidationTests(unittest.TestCase):
    def test_dre_rows_use_financial_code_as_stable_identifier(self):
        rows = [
            {"codigo": "1", "descricao": "Receita bruta"},
            {"codigo": "2", "descricao": "Deduções"},
        ]

        self.assertEqual(
            _validated_entities("dreData", rows),
            [("1", rows[0]), ("2", rows[1])],
        )

    def test_dre_rows_still_reject_duplicate_codes(self):
        rows = [
            {"codigo": "1", "descricao": "Receita bruta"},
            {"codigo": "1", "descricao": "Outra linha"},
        ]

        with self.assertRaisesRegex(ValueError, 'ID duplicado em "dreData": 1'):
            _validated_entities("dreData", rows)


class RequestedCleanupTests(unittest.TestCase):
    def test_cleanup_scope_preserves_master_data_and_login(self):
        self.assertEqual(
            set(OPERATIONAL_COLLECTIONS_TO_DELETE),
            {"units", "bancos", "lancamentos", "parcelamentos", "documentosOCR", "auditLogs"},
        )
        self.assertTrue(
            {"categorias", "centrosCusto", "fornecedores", "condicoesPagamento", "users", "regrasAutomacao", "dreData"}.isdisjoint(
                OPERATIONAL_COLLECTIONS_TO_DELETE
            )
        )
        self.assertEqual(EMPTY_OPERATIONAL_SINGLETONS["sessaoCaixa"]["movimentacoes"], [])
        self.assertEqual(EMPTY_OPERATIONAL_SINGLETONS["fechamentoMensal"]["status"], "ABERTO")

    @patch("backend.persistence.encrypt_json")
    @patch("backend.persistence.transaction")
    def test_cleanup_deletes_operations_once_and_marks_migration(self, transaction_mock, encrypt_mock):
        cursor = MagicMock()
        cursor.fetchone.return_value = {"applied": False}
        connection = MagicMock()
        connection.cursor.return_value.__enter__.return_value = cursor
        transaction_mock.return_value.__enter__.return_value = connection
        encrypt_mock.return_value = (b"nonce", b"ciphertext", 1)

        self.assertTrue(_apply_requested_operational_cleanup())

        executed_sql = [" ".join(call.args[0].split()) for call in cursor.execute.call_args_list]
        self.assertIn("DELETE FROM app_entities WHERE collection = ANY(%s)", executed_sql)
        self.assertIn("DELETE FROM document_files", executed_sql)
        self.assertIn("DELETE FROM auth_login_attempts", executed_sql)
        self.assertTrue(any(sql.startswith("INSERT INTO schema_migrations") for sql in executed_sql))

    @patch("backend.persistence.transaction")
    def test_cleanup_is_not_repeated_after_migration_marker(self, transaction_mock):
        cursor = MagicMock()
        cursor.fetchone.return_value = {"applied": True}
        connection = MagicMock()
        connection.cursor.return_value.__enter__.return_value = cursor
        transaction_mock.return_value.__enter__.return_value = connection

        self.assertFalse(_apply_requested_operational_cleanup())
        executed_sql = [" ".join(call.args[0].split()) for call in cursor.execute.call_args_list]
        self.assertFalse(any(sql.startswith("DELETE FROM") for sql in executed_sql))


if __name__ == "__main__":
    unittest.main()
