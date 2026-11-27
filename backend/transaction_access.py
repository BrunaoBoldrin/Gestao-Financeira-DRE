"""Scope financial history without deleting records omitted from a user's snapshot."""
import re
from unicodedata import normalize

from .state_models import ApplicationState


def owns(item: dict, user: dict) -> bool:
    return bool(user.get("id")) and item.get("criadoPorId") == user["id"] and item.get("unidade") == user.get("unit")


def _name_key(value: str) -> str:
    return re.sub(r"[\u0300-\u036f]", "", normalize("NFD", value.strip())).lower()


def _finance_unit_id(state: ApplicationState, user: dict) -> str | None:
    reference = user.get("unit")
    if not reference:
        return None
    units = [unit for unit in state.units if unit.get("id") and unit["id"] != "all"]
    exact = next((unit for unit in units if reference in (unit["id"], unit.get("nome"))), None)
    if exact is None:
        matches = [unit for unit in units if _name_key(unit.get("nome") or "") == _name_key(reference)]
        exact = matches[0] if len(matches) == 1 else None
    return exact["id"] if exact and exact.get("ativa") is True else None


def _client_in_unit(entry: dict, unit_id: str | None) -> bool:
    return bool(unit_id and entry.get("tipo") == "CLIENTE" and (
        "unidadeIds" not in entry or unit_id in (entry["unidadeIds"] or [])
    ))


def _merge_finance_parties(incoming: ApplicationState, previous: ApplicationState, user: dict) -> list[dict]:
    parties = {entry["id"]: entry for entry in previous.fornecedores}
    unit_id = _finance_unit_id(previous, user)
    for entry in incoming.fornecedores:
        entry_id = entry.get("id")
        if not isinstance(entry_id, str) or not entry_id.strip():
            raise ValueError("Cadastro de favorecido sem identificador.")
        if entry_id in parties:
            if parties[entry_id] != entry:
                raise PermissionError("A edição de favorecidos é restrita a administradores.")
            continue
        if not unit_id or entry.get("tipo") != "CLIENTE" or entry.get("unidadeIds") != [unit_id]:
            raise PermissionError("O perfil Financeiro só pode cadastrar clientes para a sua clínica.")

        name, document, city = (entry.get(field) for field in ("nome", "cnpj", "cidade"))
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Informe o nome ou a razão social do cliente.")
        if not isinstance(document, str) or not isinstance(city, str):
            raise ValueError("Informe CPF/CNPJ e cidade em formato de texto.")
        document_key = re.sub(r"[^a-zA-Z0-9]", "", document).upper()
        for existing in parties.values():
            if not _client_in_unit(existing, unit_id):
                continue
            existing_document = re.sub(r"[^a-zA-Z0-9]", "", str(existing.get("cnpj") or "")).upper()
            if (document_key and document_key == existing_document) or (
                not document_key and _name_key(name) == _name_key(existing.get("nome") or "")
            ):
                raise ValueError("Já existe um cadastro para este cliente na clínica.")

        parties[entry_id] = {
            "id": entry_id, "nome": name.strip(), "cnpj": document.strip(), "cidade": city.strip(),
            "tipo": "CLIENTE", "ativo": True, "unidadeIds": [unit_id],
        }
    return list(parties.values())


def visible_state(state: ApplicationState | None, user: dict) -> ApplicationState | None:
    if state is None or user.get("role") != "FINANCE":
        return state
    result = state.model_copy(deep=True)
    result.lancamentos = [x for x in state.lancamentos if owns(x, user)]
    result.parcelamentos = [x for x in state.parcelamentos if owns(x, user)]
    result.auditLogs = [x for x in state.auditLogs if x.get("usuarioId") == user["id"]]
    result.pontosEquilibrio = []
    unit_id = _finance_unit_id(state, user)
    result.fornecedores = [
        entry for entry in state.fornecedores if entry.get("tipo") != "CLIENTE" or _client_in_unit(entry, unit_id)
    ]
    return result


def merge_user_state(incoming: ApplicationState, previous: ApplicationState | None, user: dict) -> ApplicationState:
    previous = previous or ApplicationState()
    result = incoming.model_copy(deep=True)
    finance = user.get("role") == "FINANCE"
    if finance:
        result.units = previous.units
        result.fornecedores = _merge_finance_parties(incoming, previous, user)
    if "pontosEquilibrio" not in incoming.model_fields_set or finance:
        if finance and incoming.pontosEquilibrio:
            raise PermissionError("Apenas administradores podem alterar o ponto de equilíbrio.")
        result.pontosEquilibrio = previous.pontosEquilibrio
    else:
        units = {unit.get("id") for unit in incoming.units}
        previous_points = {point.id: point for point in previous.pontosEquilibrio}
        if any(point.unidadeId not in units and previous_points.get(point.id) != point for point in result.pontosEquilibrio):
            raise ValueError("Selecione uma filial cadastrada para o ponto de equilíbrio.")
    for collection in ("lancamentos", "parcelamentos"):
        old = {x["id"]: x for x in getattr(previous, collection)}
        submitted = getattr(result, collection)
        for item in submitted:
            existing = old.get(item.get("id"))
            if finance and ((existing is not None and not owns(existing, user)) or item.get("unidade") != user.get("unit")):
                raise PermissionError("Acesso permitido somente às suas movimentações na sua unidade.")
            # The authenticated session is authoritative; editing never transfers ownership.
            if existing is not None:
                item.pop("criadoPorId", None)
                if existing.get("criadoPorId"):
                    item["criadoPorId"] = existing["criadoPorId"]
            else:
                item["criadoPorId"] = user["id"]
        if finance:
            setattr(result, collection, submitted + [x for x in old.values() if not owns(x, user)])
    old_logs = {x["id"]: x for x in previous.auditLogs}
    for log in result.auditLogs:
        old = old_logs.get(log.get("id"))
        if finance and old and old.get("usuarioId") != user["id"]:
            raise PermissionError("Registro de auditoria de outro usuário.")
        if old:
            log.pop("usuarioId", None)
            if old.get("usuarioId"):
                log["usuarioId"] = old["usuarioId"]
        else:
            log["usuarioId"] = user["id"]
    if finance:
        result.auditLogs += [x for x in previous.auditLogs if x.get("usuarioId") != user["id"]]
    return result
