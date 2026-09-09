"""Scope financial history without deleting records omitted from a user's snapshot."""
from .state_models import ApplicationState


def owns(item: dict, user: dict) -> bool:
    return bool(user.get("id")) and item.get("criadoPorId") == user["id"] and item.get("unidade") == user.get("unit")


def visible_state(state: ApplicationState | None, user: dict) -> ApplicationState | None:
    if state is None or user.get("role") != "FINANCE":
        return state
    result = state.model_copy(deep=True)
    result.lancamentos = [x for x in state.lancamentos if owns(x, user)]
    result.parcelamentos = [x for x in state.parcelamentos if owns(x, user)]
    result.auditLogs = [x for x in state.auditLogs if x.get("usuarioId") == user["id"]]
    return result


def merge_user_state(incoming: ApplicationState, previous: ApplicationState | None, user: dict) -> ApplicationState:
    previous = previous or ApplicationState()
    result = incoming.model_copy(deep=True)
    finance = user.get("role") == "FINANCE"
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
