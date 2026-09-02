import unittest
from unittest.mock import MagicMock, patch

from backend.persistence import (
    EMPTY_OPERATIONAL_SINGLETONS,
    OPERATIONAL_COLLECTIONS_TO_DELETE,
    StateConflictError,
    _apply_requested_operational_cleanup,
    _validated_entities,
    save_application_state,
)
from backend.state_models import ApplicationState


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

    def test_duplicate_legacy_audit_ids_are_repaired_without_dropping_logs(self):
        rows = [
            {"id": "log-1788372760106", "descricao": "Primeiro lançamento"},
            {"id": "log-1788372760106", "descricao": "Segundo lançamento"},
            {"id": "log-1788372760106", "descricao": "Terceiro lançamento"},
        ]

        validated = _validated_entities("auditLogs", rows)

        self.assertEqual(len(validated), 3)
        self.assertEqual(validated[0][0], "log-1788372760106")
        self.assertEqual(validated[1][0], "log-1788372760106-reparado-2")
        self.assertEqual(validated[2][0], "log-1788372760106-reparado-3")
        self.assertEqual([entity["descricao"] for _, entity in validated], [
            "Primeiro lançamento",
            "Segundo lançamento",
            "Terceiro lançamento",
        ])
        self.assertEqual([entity["id"] for _, entity in validated], [identifier for identifier, _ in validated])

    @patch("backend.persistence.ensure_schema")
    @patch("backend.persistence.transaction")
    @patch("backend.persistence.encrypt_json")
    def test_manual_and_ocr_launches_are_written_in_the_same_revision(
        self,
        encrypt_mock,
        transaction_mock,
        _ensure_schema_mock,
    ):
        cursor = MagicMock()
        cursor.fetchone.return_value = {"revision": 12}
        connection = MagicMock()
        connection.cursor.return_value.__enter__.return_value = cursor
        transaction_mock.return_value.__enter__.return_value = connection
        encrypt_mock.return_value = (b"nonce", b"ciphertext", 1)
        state = ApplicationState(
            lancamentos=[
                {"id": "manual-1", "descricao": "Lançamento manual"},
                {
                    "id": "ocr-1",
                    "descricao": "Lançamento aprovado pelo OCR",
                    "documentoConciliadoId": "documento-1",
                },
            ],
            documentosOCR=[
                {
                    "id": "documento-1",
                    "status": "APROVADO",
                    "lancamentoGeradoId": "ocr-1",
                }
            ],
            dreVersions=[{"id": "dre-v1", "mesAno": "2026-08", "versao": 1}],
            fechamentosMensais=[{"id": "fech-2026-08", "mesAno": "2026-08", "status": "EM_REVISAO"}],
        )

        revision = save_application_state(state, expected_revision=12, updated_by="user-1")

        self.assertEqual(revision, 13)
        inserted = {}
        for call in cursor.executemany.call_args_list:
            rows = call.args[1]
            if rows:
                inserted[rows[0][0]] = rows
        self.assertEqual([row[1] for row in inserted["lancamentos"]], ["manual-1", "ocr-1"])
        self.assertEqual([row[1] for row in inserted["documentosOCR"]], ["documento-1"])
        self.assertEqual([row[1] for row in inserted["dreVersions"]], ["dre-v1"])
        self.assertEqual([row[1] for row in inserted["fechamentosMensais"]], ["fech-2026-08"])
        cursor.execute.assert_any_call(
            unittest.mock.ANY,
            (13, "user-1"),
        )

    @patch("backend.persistence.ensure_schema")
    @patch("backend.persistence.transaction")
    def test_stale_revision_is_rejected_before_any_collection_is_deleted(
        self,
        transaction_mock,
        _ensure_schema_mock,
    ):
        cursor = MagicMock()
        cursor.fetchone.return_value = {"revision": 9}
        connection = MagicMock()
        connection.cursor.return_value.__enter__.return_value = cursor
        transaction_mock.return_value.__enter__.return_value = connection

        with self.assertRaisesRegex(StateConflictError, "outra sessão"):
            save_application_state(ApplicationState(), expected_revision=8, updated_by="user-1")

        executed_sql = [" ".join(call.args[0].split()) for call in cursor.execute.call_args_list]
        self.assertFalse(any(sql.startswith("DELETE FROM app_entities") for sql in executed_sql))


class RequestedCleanupTests(unittest.TestCase):
    def test_cleanup_scope_preserves_master_data_and_login(self):
        self.assertEqual(
            set(OPERATIONAL_COLLECTIONS_TO_DELETE),
            {
                "units",
                "bancos",
                "lancamentos",
                "parcelamentos",
                "documentosOCR",
                "auditLogs",
                "dreVersions",
                "fechamentosMensais",
            },
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
