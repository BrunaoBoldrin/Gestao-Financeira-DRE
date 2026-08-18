from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .models import OCRRequest
from .ocr_service import (
    OCRProcessingError,
    analyze_document,
    decode_file_data,
    tesseract_status,
    validate_document,
)


app = FastAPI(
    title="Gestão Financeira DRE - OCR",
    version="1.0.0",
    docs_url="/api/docs" if os.getenv("ENABLE_API_DOCS", "false").lower() == "true" else None,
    redoc_url=None,
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "python-ocr",
        "tesseract": tesseract_status(),
    }


@app.post("/api/ocr")
def run_ocr(request: OCRRequest) -> dict:
    max_file_mb = int(os.getenv("OCR_MAX_FILE_MB", "15"))
    max_pages = int(os.getenv("OCR_MAX_PAGES", "5"))

    try:
        content = decode_file_data(request.file_data)
        if not content and not (request.text_content or "").strip():
            raise OCRProcessingError("Nenhum arquivo ou conteúdo foi enviado.")

        validate_document(content, request.mime_type, request.file_name, max_file_mb)
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
        "dadosExtraidos": {
            "fornecedor": result["fornecedor"],
            "cnpj": result["cnpj"],
            "dataEmissao": result["dataEmissao"],
            "dataVencimento": result["dataVencimento"],
            "valorTotal": result["valorTotal"],
            "categoria": result["categoria"],
            "centroCusto": result["centroCusto"],
            "linhaDigitavel": result["linhaDigitavel"],
            "observacoes": result["observacoes"],
            "itens": result["itens"],
        },
        "tipo": result["tipo"],
        "confiancaOCR": result["confiancaOCR"],
        "motor": result["motor"],
        "metadados": {
            "fonteExtracao": result["fonteExtracao"],
            "paginasProcessadas": result["paginasProcessadas"],
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
