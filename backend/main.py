from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .auth import (
    CreateUserRequest,
    LoginRequest,
    SetupAdminRequest,
    UpdateUserRequest,
    auth_status,
    create_auth_user,
    delete_auth_user,
    list_auth_users,
    login_user,
    logout,
    require_admin_access,
    require_data_access,
    require_write_access,
    require_write_access_when_configured,
    setup_admin,
    update_auth_user,
)
from .database import database_configured, database_health
from .encryption import encryption_configured
from .models import OCRRequest
from .ocr_service import (
    OCRProcessingError,
    analyze_document,
    decode_file_data,
    tesseract_status,
    validate_document,
)
from .persistence import (
    StateConflictError,
    fetch_file,
    load_application_state,
    save_application_state,
    store_file,
)
from .state_models import SaveStateRequest


app = FastAPI(
    title="Gestão Financeira DRE - OCR",
    version="1.0.0",
    docs_url="/api/docs" if os.getenv("ENABLE_API_DOCS", "false").lower() == "true" else None,
    redoc_url=None,
)


def serialize_financial_data(data: dict) -> dict:
    return {
        "fornecedor": data.get("fornecedor", ""),
        "cnpj": data.get("cnpj", ""),
        "dataEmissao": data.get("dataEmissao", ""),
        "dataVencimento": data.get("dataVencimento", ""),
        "valorTotal": data.get("valorTotal", 0),
        "categoria": data.get("categoria", "Despesas Operacionais"),
        "centroCusto": data.get("centroCusto", "Administrativo"),
        "linhaDigitavel": data.get("linhaDigitavel", ""),
        "chaveDocumento": data.get("chaveDocumento", ""),
        "identificadorTransacao": data.get("identificadorTransacao", ""),
        "formaPagamento": data.get("formaPagamento", "TRANSFERENCIA"),
        "documentoNumero": data.get("documentoNumero", ""),
        "pagador": data.get("pagador", ""),
        "recebedor": data.get("recebedor", ""),
        "sentidoSugerido": data.get("sentidoSugerido", "A_CONFIRMAR"),
        "impactoDRESugerido": data.get("impactoDRESugerido", "A_CONFIRMAR"),
        "finalidadeSugerida": data.get("finalidadeSugerida", "A_CONFIRMAR"),
        "parcelaNumero": data.get("parcelaNumero", ""),
        "paginaOrigem": data.get("paginaOrigem"),
        "observacoes": data.get("observacoes", ""),
        "itens": data.get("itens", []),
    }

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type"],
    )


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "python-ocr",
        "tesseract": tesseract_status(),
        "database": database_health(),
        "encryption": {"configured": encryption_configured()},
    }


@app.get("/api/auth/status")
def get_auth_status(request: Request, response: Response) -> dict:
    response.headers["Cache-Control"] = "no-store"
    return auth_status(request)


@app.post("/api/auth/login")
def login_with_credentials(payload: LoginRequest, response: Response) -> dict:
    response.headers["Cache-Control"] = "no-store"
    return {"success": True, "user": login_user(payload, response)}


@app.post("/api/auth/setup")
def setup_initial_admin(payload: SetupAdminRequest, response: Response) -> dict:
    response.headers["Cache-Control"] = "no-store"
    return {"success": True, "user": setup_admin(payload, response)}


@app.post("/api/auth/logout")
def logout_data_session(request: Request, response: Response) -> dict:
    logout(request, response)
    return {"success": True}


@app.post("/api/auth/users")
def create_user(
    payload: CreateUserRequest,
    _: dict = Depends(require_admin_access),
) -> dict:
    return {"success": True, "user": create_auth_user(payload)}


@app.get("/api/auth/users")
def list_users(_: dict = Depends(require_admin_access)) -> dict:
    return {"users": list_auth_users()}


@app.put("/api/auth/users/{user_id}")
def update_user(
    user_id: str,
    payload: UpdateUserRequest,
    auth_user: dict = Depends(require_admin_access),
) -> dict:
    return {"success": True, "user": update_auth_user(user_id, payload, auth_user)}


@app.delete("/api/auth/users/{user_id}")
def delete_user(
    user_id: str,
    auth_user: dict = Depends(require_admin_access),
) -> dict:
    delete_auth_user(user_id, auth_user)
    return {"success": True}


@app.get("/api/state")
def get_application_state(response: Response, _: dict = Depends(require_data_access)) -> dict:
    response.headers["Cache-Control"] = "no-store"
    try:
        revision, state = load_application_state()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Não foi possível consultar o banco de dados.") from exc
    return {
        "revision": revision,
        "empty": state is None,
        "data": state.model_dump(mode="json") if state else None,
    }


@app.put("/api/state")
def put_application_state(
    payload: SaveStateRequest,
    auth_user: dict = Depends(require_write_access),
) -> dict:
    try:
        revision = save_application_state(
            payload.data,
            expected_revision=payload.expectedRevision,
            updated_by=auth_user["id"],
        )
    except StateConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Os dados foram alterados por outra sessão. Recarregue antes de salvar novamente.",
                "currentRevision": exc.current_revision,
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Não foi possível salvar os dados no PostgreSQL.") from exc
    return {"success": True, "revision": revision}


@app.post("/api/files", dependencies=[Depends(require_write_access)])
async def upload_financial_file(file: UploadFile = File(...)) -> dict:
    content = await file.read()
    max_file_mb = int(os.getenv("FILE_MAX_MB", "15"))
    if not content:
        raise HTTPException(status_code=422, detail="O arquivo está vazio.")
    if len(content) > max_file_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"O arquivo deve ter no máximo {max_file_mb} MB.")

    allowed_types = {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "application/xml",
        "text/xml",
        "text/plain",
    }
    mime_type = file.content_type or "application/octet-stream"
    if mime_type not in allowed_types:
        raise HTTPException(status_code=415, detail="Formato de arquivo não permitido.")

    try:
        stored = store_file(file.filename or "documento", mime_type, content)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Não foi possível armazenar o arquivo no banco.") from exc
    return {
        "id": stored.id,
        "fileName": stored.file_name,
        "mimeType": stored.mime_type,
        "sizeBytes": stored.size_bytes,
        "sha256": stored.sha256,
        "url": f"/api/files/{stored.id}",
    }


@app.get("/api/files/{file_id}", dependencies=[Depends(require_data_access)])
def get_financial_file(file_id: str) -> Response:
    try:
        stored_result = fetch_file(file_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Não foi possível consultar o arquivo.") from exc
    if not stored_result:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")

    stored, content = stored_result
    return Response(
        content=content,
        media_type=stored.mime_type,
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(stored.file_name)}",
            "Cache-Control": "private, no-store",
        },
    )


@app.post("/api/ocr", dependencies=[Depends(require_write_access_when_configured)])
def run_ocr(request: OCRRequest) -> dict:
    max_file_mb = int(os.getenv("OCR_MAX_FILE_MB", "15"))
    max_pages = int(os.getenv("OCR_MAX_PAGES", "5"))

    try:
        content = decode_file_data(request.file_data)
        if not content and not (request.text_content or "").strip():
            raise OCRProcessingError("Nenhum arquivo ou conteúdo foi enviado.")

        validate_document(content, request.mime_type, request.file_name, max_file_mb)
        stored = store_file(request.file_name, request.mime_type, content) if content and database_configured() else None
        result = analyze_document(
            content=content,
            mime_type=request.mime_type,
            file_name=request.file_name,
            text_content=request.text_content,
            max_pages=max_pages,
        )
    except OCRProcessingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Falha interna ao analisar o documento.") from exc

    return {
        "success": True,
        "schemaVersion": 2,
        "dadosExtraidos": serialize_financial_data(result),
        "entidadesFinanceiras": [
            {
                "tipo": entity.get("tipo", result["tipo"]),
                "dadosExtraidos": serialize_financial_data(entity),
            }
            for entity in result.get("entidadesFinanceiras", [])
        ],
        "tipo": result["tipo"],
        "confiancaOCR": result["confiancaOCR"],
        "motor": result["motor"],
        "metadados": {
            "fonteExtracao": result["fonteExtracao"],
            "paginasProcessadas": result["paginasProcessadas"],
            "hashArquivo": result["hashArquivo"],
            "arquivoId": stored.id if stored else None,
            "previewUrl": f"/api/files/{stored.id}" if stored else None,
        },
    }


dist_dir = Path(os.getenv("FRONTEND_DIST_DIR", Path(__file__).resolve().parents[1] / "dist"))
assets_dir = dist_dir / "assets"
if assets_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
def frontend(full_path: str):
    requested = (dist_dir / full_path).resolve()
    if dist_dir.is_dir() and requested.is_relative_to(dist_dir.resolve()) and requested.is_file():
        return FileResponse(requested)
    index_file = dist_dir / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend ainda não compilado.")
