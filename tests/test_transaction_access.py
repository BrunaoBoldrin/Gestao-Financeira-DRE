import unittest
from unittest.mock import patch
from fastapi import Response, HTTPException
from backend.state_models import ApplicationState, SaveStateRequest
from backend.transaction_access import visible_state, merge_user_state
from backend.main import get_application_state, put_application_state


class TransactionAccessTests(unittest.TestCase):
    def setUp(self):
        self.user = {"id": "finance-a", "role": "FINANCE", "unit": "Rio Claro"}
        self.state = ApplicationState(lancamentos=[
            {"id": "own", "criadoPorId": "finance-a", "unidade": "Rio Claro", "valor": 10},
            {"id": "other", "criadoPorId": "finance-b", "unidade": "Rio Claro", "valor": 20},
            {"id": "legacy", "unidade": "Rio Claro", "valor": 30},
            {"id": "branch", "criadoPorId": "finance-a", "unidade": "Piracicaba", "valor": 40},
        ])

    def test_get_only_own_even_in_same_branch(self):
        with patch('backend.main.load_application_state', return_value=(4, self.state)):
            response = get_application_state(Response(), self.user)
        self.assertEqual([x['id'] for x in response['data']['lancamentos']], ['own'])
        self.assertEqual(len(self.state.lancamentos), 4)

    def test_admin_keeps_general_history_and_legacy(self):
        self.assertEqual(len(visible_state(self.state, {"role": "ADMIN"}).lancamentos), 4)

    def test_scoped_save_preserves_hidden_records_and_stamps_new_ocr_or_manual(self):
        incoming = visible_state(self.state, self.user)
        incoming.lancamentos[0]['valor'] = 99
        incoming.lancamentos += [{"id": "new", "unidade": "Rio Claro", "criadoPorId": "forged"}]
        with patch('backend.main.load_application_state', return_value=(4, self.state)), patch('backend.main.save_application_state', return_value=5) as save:
            put_application_state(SaveStateRequest(expectedRevision=4, data=incoming), self.user)
        saved = save.call_args.args[0]
        self.assertEqual(len(saved.lancamentos), 5)
        self.assertEqual(next(x for x in saved.lancamentos if x['id']=='other')['valor'], 20)
        self.assertEqual(next(x for x in saved.lancamentos if x['id']=='new')['criadoPorId'], 'finance-a')
        self.assertEqual(len(visible_state(saved, self.user).lancamentos), 2)

    def test_delete_own_does_not_delete_others(self):
        saved = merge_user_state(ApplicationState(), self.state, self.user)
        self.assertEqual({x['id'] for x in saved.lancamentos}, {'other','legacy','branch'})

    def test_cannot_forge_owner_or_edit_other_or_legacy(self):
        for target in ['other','legacy','branch']:
            with self.subTest(target=target), self.assertRaises(PermissionError):
                merge_user_state(ApplicationState(lancamentos=[{'id':target,'unidade':'Rio Claro','criadoPorId':'finance-a'}]),self.state,self.user)

    def test_edit_never_changes_owner_including_admin_and_legacy(self):
        incoming = self.state.model_copy(deep=True)
        for item in incoming.lancamentos:
            item['criadoPorId'] = 'admin'
        saved = merge_user_state(incoming, self.state, {'id':'admin','role':'ADMIN'})
        self.assertEqual(saved.lancamentos[0]['criadoPorId'], 'finance-a')
        self.assertNotIn('criadoPorId', saved.lancamentos[2])

    def test_revision_conflict_does_not_save(self):
        with patch('backend.main.load_application_state', return_value=(5,self.state)), patch('backend.main.save_application_state') as save:
            with self.assertRaises(HTTPException) as exc:
                put_application_state(SaveStateRequest(expectedRevision=4,data=ApplicationState()), self.user)
            self.assertEqual(exc.exception.status_code,409)
            save.assert_not_called()

    def test_parcels_and_audit_logs_do_not_expose_other_history(self):
        self.state.parcelamentos = [dict(x) for x in self.state.lancamentos]
        self.state.auditLogs = [{'id':'a','usuarioId':'finance-a'}, {'id':'b','usuarioId':'finance-b'}, {'id':'c'}]
        scoped = visible_state(self.state, self.user)
        self.assertEqual([x['id'] for x in scoped.parcelamentos], ['own'])
        self.assertEqual([x['id'] for x in scoped.auditLogs], ['a'])
        saved = merge_user_state(scoped,self.state,self.user)
        self.assertEqual(len(saved.parcelamentos),4)
        self.assertEqual(len(saved.auditLogs),3)


class FinanceClientAccessTests(unittest.TestCase):
    def setUp(self):
        self.finance = {"id": "finance-rc", "role": "FINANCE", "unit": "Rio Claro"}
        self.client = {
            "id": "client-rc", "nome": "Cliente Rio Claro", "cnpj": "123.456.789-00",
            "cidade": "", "tipo": "CLIENTE", "ativo": True, "unidadeIds": ["rc"],
        }
        self.other = {**self.client, "id": "client-pira", "unidadeIds": ["pira"]}
        self.supplier = {"id": "forn-1", "tipo": "FORNECEDOR", "unidadeIds": ["rc"]}
        self.state = ApplicationState(
            units=[
                {"id": "rc", "nome": "Rio Claro", "ativa": True},
                {"id": "pira", "nome": "Piracicaba", "ativa": True},
            ],
            fornecedores=[self.other, self.supplier],
        )

    def test_finance_registers_client_only_in_own_clinic_and_keeps_other_records(self):
        submitted = visible_state(self.state, self.finance)
        self.assertEqual(submitted.fornecedores, [self.supplier])
        submitted.fornecedores = [{**self.client, "planoContaId": "ignored"}]
        saved = merge_user_state(submitted, self.state, self.finance)
        self.assertEqual(saved.fornecedores, [self.other, self.supplier, self.client])
        self.assertEqual(visible_state(saved, self.finance).fornecedores, [self.supplier, self.client])
        other_finance = {**self.finance, "unit": "Piracicaba"}
        self.assertEqual(visible_state(saved, other_finance).fornecedores, [self.other, self.supplier])

    def test_finance_cannot_create_outside_clinic_or_alter_existing_parties(self):
        for invalid in [
            {**self.client, "unidadeIds": ["pira"]},
            {**self.client, "unidadeIds": ["rc", "pira"]},
            {**self.client, "unidadeIds": []},
            {**self.client, "tipo": "FORNECEDOR"},
            {**self.other, "nome": "Alterado"},
            {**self.supplier, "nome": "Alterado"},
        ]:
            with self.subTest(invalid=invalid), self.assertRaises(PermissionError):
                merge_user_state(ApplicationState(fornecedores=[invalid]), self.state, self.finance)

    def test_finance_cannot_register_duplicate_client_in_same_clinic(self):
        self.state.fornecedores.append(self.client)
        duplicate = {**self.client, "id": "new", "cnpj": "12345678900"}
        with self.assertRaisesRegex(ValueError, "Já existe"):
            merge_user_state(ApplicationState(fornecedores=[duplicate]), self.state, self.finance)


class BreakEvenAccessTests(unittest.TestCase):
    def setUp(self):
        self.admin = {"id": "admin", "role": "ADMIN"}
        self.finance = {"id": "finance-a", "role": "FINANCE", "unit": "Rio Claro"}
        self.point = {
            "id": "rc:2026-11",
            "unidadeId": "rc",
            "competencia": "2026-11",
            "receitaReferenciaCentavos": 200000,
            "custos": [{"descricao": "Aluguel", "tipo": "FIXO", "valor": 100000}],
        }
        self.state = ApplicationState(units=[{"id": "rc"}], pontosEquilibrio=[self.point])

    def test_finance_cannot_read_break_even_or_remove_it_using_a_scoped_save(self):
        scoped = visible_state(self.state, self.finance)
        self.assertEqual(scoped.pontosEquilibrio, [])
        saved = merge_user_state(scoped, self.state, self.finance)
        self.assertEqual(saved.pontosEquilibrio, self.state.pontosEquilibrio)

    def test_finance_cannot_submit_break_even_data_to_state_endpoint(self):
        with patch("backend.main.load_application_state", return_value=(4, self.state)):
            with self.assertRaises(HTTPException) as error:
                put_application_state(SaveStateRequest(expectedRevision=4, data=self.state), self.finance)
        self.assertEqual(error.exception.status_code, 403)

    def test_legacy_admin_snapshot_preserves_break_even(self):
        legacy = ApplicationState(units=[{"id": "rc"}])
        saved = merge_user_state(legacy, self.state, self.admin)
        self.assertEqual(saved.pontosEquilibrio, self.state.pontosEquilibrio)

    def test_admin_can_store_separate_records_and_auditor_can_read(self):
        second_month = {**self.point, "id": "rc:2026-12", "competencia": "2026-12"}
        other_unit = {**self.point, "id": "pira:2026-11", "unidadeId": "pira"}
        incoming = ApplicationState(units=[{"id": "rc"}, {"id": "pira"}], pontosEquilibrio=[self.point, second_month, other_unit])
        saved = merge_user_state(incoming, self.state, self.admin)
        result = visible_state(saved, {"role": "AUDITOR"})
        self.assertEqual([point.id for point in result.pontosEquilibrio], ["rc:2026-11", "rc:2026-12", "pira:2026-11"])

    def test_cannot_write_entries_for_a_missing_unit(self):
        with self.assertRaises(ValueError):
            merge_user_state(ApplicationState(pontosEquilibrio=[self.point]), None, self.admin)

    def test_month_id_and_data_are_validated(self):
        from pydantic import ValidationError
        for invalid in [
            {**self.point, "id": "rc:2026-10"},
            {**self.point, "competencia": "2026-13", "id": "rc:2026-13"},
            {**self.point, "receitaReferenciaCentavos": -1},
            {**self.point, "custos": [{"descricao": "Taxas", "tipo": "VARIAVEL_PERCENTUAL", "valor": 10001}]},
        ]:
            with self.subTest(invalid=invalid), self.assertRaises(ValidationError):
                ApplicationState(pontosEquilibrio=[invalid])
