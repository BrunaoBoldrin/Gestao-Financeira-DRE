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
