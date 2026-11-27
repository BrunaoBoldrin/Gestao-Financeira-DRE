"""Show cash receipts and payments together with recorded cash transfers and adjustments."""
from collections import defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re
from unicodedata import normalize

from .state_models import ApplicationState


def _key(value: str | None) -> str:
    return re.sub(r"[\u0300-\u036f]", "", normalize("NFD", str(value or "").strip())).lower()


def _cents(value: object) -> int:
    try:
        return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    except (InvalidOperation, ValueError, OverflowError):
        return 0


def cash_ledger(state: ApplicationState | None, user: dict) -> list[dict]:
    if state is None:
        return []
    aliases = {_key(unit.get("id")): unit.get("nome") for unit in state.units if unit.get("nome")}

    def unit_key(value):
        return _key(aliases.get(_key(value)) or value)

    finance = user.get("role") == "FINANCE"
    unit_scope = unit_key(user.get("unit"))
    banks = {bank["id"]: bank for bank in state.bancos if bank.get("id")}
    cash_accounts = {
        identifier: bank for identifier, bank in banks.items()
        if re.search(r"\bcaixa fisico\b", _key(bank.get("banco")))
    }
    accounts_by_unit = defaultdict(list)
    for bank in cash_accounts.values():
        accounts_by_unit[unit_key(bank.get("unidade"))].append(bank)

    stored = [
        dict(row) for row in (state.sessaoCaixa.get("movimentacoes") or [])
        if not finance or (unit_scope and unit_key(row.get("unidade")) == unit_scope)
    ]
    linked = {row["lancamentoRelacionadoId"] for row in stored if row.get("lancamentoRelacionadoId")}
    legacy_sales = defaultdict(list)
    for row in stored:
        if row.get("tipo") == "VENDA" and not row.get("lancamentoRelacionadoId"):
            key = (unit_key(row.get("unidade")), row.get("descricao"), str(row.get("dataHora") or "")[:10], _cents(row.get("valor")))
            legacy_sales[key].append(row)

    operators = {operator.get("id"): operator.get("name") for operator in state.users}
    transactions = []
    other_authors = set()
    for entry in state.lancamentos:
        identifier = entry.get("id")
        unit = unit_key(entry.get("unidade"))
        cents = _cents(entry.get("valor"))
        if not identifier or identifier in linked or cents <= 0 or entry.get("status") != "PAGO":
            continue
        if finance and (not unit_scope or unit != unit_scope):
            continue
        if entry.get("tipo") not in {"RECEITA", "DESPESA"}:
            continue
        bank = banks.get(entry.get("bancoId"))
        if bank is None:
            matches = [
                account for account in accounts_by_unit[unit]
                if _key(account.get("banco")) == _key(entry.get("contaBancaria"))
            ]
            bank = matches[0] if len(matches) == 1 else None
        if not bank or bank["id"] not in cash_accounts or unit_key(bank.get("unidade")) != unit:
            continue

        created = str(entry.get("criadoEm") or "").replace("T", " ")
        date = str(entry.get("dataPagamento") or entry.get("dataVencimento") or created)[:10]
        time = created[11:19] if date == created[:10] and len(created) >= 19 else "00:00:00"
        revenue = entry["tipo"] == "RECEITA"
        description = str(entry.get("descricao") or "")
        if revenue and description.startswith("[Caixa Físico] "):
            matching = legacy_sales.get((unit, description.removeprefix("[Caixa Físico] "), date, cents))
            if matching:
                matching.pop()["lancamentoRelacionadoId"] = identifier
                continue
        row_id = f"caixa-lanc-{identifier}"
        if finance and entry.get("criadoPorId") != user.get("id"):
            other_authors.add(row_id)
        transactions.append({
            "id": row_id, "lancamentoRelacionadoId": identifier,
            "tipo": "VENDA" if revenue else "DESPESA", "sentido": "ENTRADA" if revenue else "SAIDA",
            "unidade": aliases.get(_key(entry.get("unidade"))) or entry.get("unidade"),
            "descricao": description, "valor": cents / 100, "dataHora": f"{date} {time}",
            "usuario": operators.get(entry.get("criadoPorId")) or "—",
            "finalidade": "VENDA_DINHEIRO" if revenue else "PAGAMENTO_DESPESA",
            "impactoDRE": entry.get("impactoDRE") or entry["tipo"],
            "statusConciliacao": "CONCILIADO", "comprovanteRef": entry.get("comprovanteUrl"),
            "bancoDestinoId" if revenue else "bancoOrigemId": bank["id"],
        })

    rows = sorted(stored + transactions, key=lambda row: str(row.get("dataHora") or ""), reverse=True)
    available = {identifier: _cents(bank.get("saldo")) for identifier, bank in cash_accounts.items()}
    for row in rows:
        unit = unit_key(row.get("unidade"))
        row["unidade"] = aliases.get(_key(row.get("unidade"))) or row.get("unidade")
        revenue = row.get("sentido") == "ENTRADA"
        bank_id = row.get("bancoDestinoId" if revenue else "bancoOrigemId")
        if bank_id not in cash_accounts:
            candidates = accounts_by_unit[unit]
            bank_id = candidates[0]["id"] if len(candidates) == 1 else None
        if bank_id in available:
            row["saldoApos"] = available[bank_id] / 100
            available[bank_id] -= _cents(row.get("valor")) * (1 if revenue else -1)
    return [row for row in rows if row.get("id") not in other_authors]
