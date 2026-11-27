import unittest

from backend.cash_ledger import cash_ledger
from backend.state_models import ApplicationState


class CashLedgerTests(unittest.TestCase):
    def setUp(self):
        self.state = ApplicationState(
            units=[{"id": "rc", "nome": "Rio Claro"}, {"id": "pira", "nome": "Piracicaba"}],
            bancos=[
                {"id": "cash", "banco": "Caixa Físico", "unidade": "rc", "saldo": 35},
                {"id": "bank", "banco": "Caixa Econômica", "unidade": "rc", "saldo": 1140},
                {"id": "cash-pira", "banco": "Caixa Físico", "unidade": "pira", "saldo": 60},
            ],
            lancamentos=[
                self.entry("sale", "RECEITA", 100, "2026-11-24", "cash"),
                self.entry("expense", "DESPESA", 25, "2026-11-25", "cash", owner="other"),
                self.entry("pending", "DESPESA", 10, "2026-11-25", "cash", status="PENDENTE"),
                self.entry("pix", "RECEITA", 100, "2026-11-26", "bank"),
                self.entry("branch", "RECEITA", 60, "2026-11-25", "cash-pira", unit="Piracicaba"),
            ],
            sessaoCaixa={"movimentacoes": [{
                "id": "deposit", "tipo": "SANGRIA", "sentido": "SAIDA", "descricao": "Depósito",
                "valor": 40, "dataHora": "2026-11-27 09:15:00", "unidade": "Rio Claro",
                "bancoOrigemId": "cash", "bancoDestinoId": "bank", "finalidade": "DEPOSITO_BANCARIO",
            }]},
        )

    @staticmethod
    def entry(identifier, kind, amount, date, bank, owner="op", unit="Rio Claro", status="PAGO"):
        return {
            "id": identifier, "descricao": identifier, "tipo": kind, "valor": amount, "status": status,
            "dataPagamento": date, "bancoId": bank, "unidade": unit, "criadoPorId": owner,
        }

    def test_rebuilds_cash_entries_without_reapplying_balance_or_counting_bank_or_unpaid_items(self):
        rows = cash_ledger(self.state, {"role": "ADMIN"})
        local = [row for row in rows if row["unidade"] == "Rio Claro"]
        self.assertEqual([row["id"] for row in local], ["deposit", "caixa-lanc-expense", "caixa-lanc-sale"])
        self.assertEqual([row["saldoApos"] for row in local], [35, 75, 100])
        self.assertEqual(self.state.bancos[0]["saldo"], 35)
        self.assertEqual(len(self.state.sessaoCaixa["movimentacoes"]), 1)

    def test_keeps_private_transactions_scoped_for_finance_with_real_balance_after(self):
        rows = cash_ledger(self.state, {"role": "FINANCE", "unit": "Rio Claro", "id": "op"})
        self.assertEqual([row["id"] for row in rows], ["deposit", "caixa-lanc-sale"])
        self.assertEqual(rows[1]["saldoApos"], 100)

    def test_does_not_double_count_legacy_cash_sale_or_linked_liquidation(self):
        self.state.lancamentos[0]["descricao"] = "[Caixa Físico] Venda balcão"
        self.state.sessaoCaixa["movimentacoes"] += [{
            "id": "legacy", "descricao": "Venda balcão", "tipo": "VENDA", "sentido": "ENTRADA",
            "unidade": "Rio Claro", "dataHora": "2026-11-24 10:35:00", "valor": 100,
        }, {
            "id": "legacy-payment", "tipo": "SANGRIA", "sentido": "SAIDA", "lancamentoRelacionadoId": "expense",
            "unidade": "Rio Claro", "dataHora": "2026-11-25 14:10:00", "valor": 25,
        }]
        rows = cash_ledger(self.state, {"role": "ADMIN"})
        local = [row for row in rows if row["unidade"] == "Rio Claro"]
        self.assertEqual([row["id"] for row in local], ["deposit", "legacy-payment", "legacy"])
        self.assertEqual([row["saldoApos"] for row in local], [35, 75, 100])
