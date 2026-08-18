from __future__ import annotations

import base64
import binascii
import csv
import hashlib
import io
import os
import re
import subprocess
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

import pymupdf
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError


ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/xml",
    "text/xml",
    "text/plain",
    "image/jpeg",
    "image/jpg",
    "image/png",
}
ALLOWED_SUFFIXES = {".pdf", ".xml", ".txt", ".jpg", ".jpeg", ".png"}
Image.MAX_IMAGE_PIXELS = 25_000_000


class OCRProcessingError(ValueError):
    pass


@dataclass
class DocumentText:
    text: str
    source: str
    ocr_confidence: float | None = None
    pages_processed: int = 1
    segments: list[str] | None = None


def decode_file_data(file_data: str | None) -> bytes:
    if not file_data:
        return b""
    payload = file_data.split(",", 1)[1] if file_data.startswith("data:") and "," in file_data else file_data
    try:
        return base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise OCRProcessingError("O arquivo enviado não possui Base64 válido.") from exc


def validate_document(content: bytes, mime_type: str | None, file_name: str, max_file_mb: int) -> None:
    suffix = Path(file_name).suffix.lower()
    normalized_mime = (mime_type or "").split(";", 1)[0].strip().lower()
    if normalized_mime and normalized_mime not in ALLOWED_MIME_TYPES and suffix not in ALLOWED_SUFFIXES:
        raise OCRProcessingError("Formato não suportado. Envie PDF, XML, TXT, JPG, JPEG ou PNG.")
    if suffix and suffix not in ALLOWED_SUFFIXES and normalized_mime not in ALLOWED_MIME_TYPES:
        raise OCRProcessingError("Extensão de arquivo não suportada.")
    if len(content) > max_file_mb * 1024 * 1024:
        raise OCRProcessingError(f"O documento deve ter no máximo {max_file_mb} MB.")


def analyze_document(
    content: bytes,
    mime_type: str | None,
    file_name: str,
    text_content: str | None = None,
    max_pages: int = 5,
) -> dict[str, Any]:
    extracted = extract_document_text(content, mime_type, file_name, text_content, max_pages)
    fields = parse_financial_fields(extracted.text, file_name)
    entities = _extract_financial_entities(extracted, file_name)
    completeness = _field_completeness(fields)
    base_confidence = extracted.ocr_confidence if extracted.ocr_confidence is not None else 93.0
    confidence = round(min(99.0, max(20.0, (base_confidence * 0.65) + (completeness * 0.35))))

    return {
        **fields,
        "confiancaOCR": confidence,
        "motor": "python-local",
        "fonteExtracao": extracted.source,
        "paginasProcessadas": extracted.pages_processed,
        "hashArquivo": hashlib.sha256(content or extracted.text.encode("utf-8")).hexdigest(),
        "entidadesFinanceiras": entities,
    }


def extract_document_text(
    content: bytes,
    mime_type: str | None,
    file_name: str,
    text_content: str | None,
    max_pages: int,
) -> DocumentText:
    suffix = Path(file_name).suffix.lower()
    normalized_mime = (mime_type or "").split(";", 1)[0].strip().lower()

    if text_content and text_content.strip():
        source = "xml" if suffix == ".xml" or "xml" in normalized_mime else "texto"
        return DocumentText(text=text_content, source=source, segments=[text_content])

    if suffix == ".pdf" or normalized_mime == "application/pdf":
        return _extract_pdf(content, max_pages)

    if suffix in {".xml", ".txt"} or normalized_mime in {"application/xml", "text/xml", "text/plain"}:
        decoded = _decode_text(content)
        return DocumentText(text=decoded, source="xml" if suffix == ".xml" else "texto", segments=[decoded])

    if suffix in {".jpg", ".jpeg", ".png"} or normalized_mime.startswith("image/"):
        return _extract_image(content)

    raise OCRProcessingError("Não foi possível identificar o tipo do documento.")


def _extract_pdf(content: bytes, max_pages: int) -> DocumentText:
    if not content:
        raise OCRProcessingError("O PDF está vazio.")
    try:
        document = pymupdf.open(stream=content, filetype="pdf")
    except Exception as exc:
        raise OCRProcessingError("Não foi possível abrir o PDF. Verifique se o arquivo está íntegro.") from exc

    if document.needs_pass:
        document.close()
        raise OCRProcessingError("PDF protegido por senha não pode ser analisado.")

    texts: list[str] = []
    confidences: list[float] = []
    used_ocr = False
    page_limit = min(len(document), max(1, max_pages))

    try:
        for page_index in range(page_limit):
            page = document.load_page(page_index)
            native_text = page.get_text("text").strip()
            if len(re.sub(r"\s+", "", native_text)) >= 40:
                texts.append(native_text)
                continue

            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
            page_text, page_confidence = _run_tesseract(pixmap.tobytes("png"))
            texts.append(page_text)
            if page_confidence is not None:
                confidences.append(page_confidence)
            used_ocr = True
    finally:
        document.close()

    combined = "\n\n".join(part for part in texts if part.strip()).strip()
    if not combined:
        raise OCRProcessingError("Nenhum texto legível foi encontrado no PDF.")

    return DocumentText(
        text=combined,
        source="pdf_ocr" if used_ocr else "pdf_texto",
        ocr_confidence=sum(confidences) / len(confidences) if confidences else None,
        pages_processed=page_limit,
        segments=[part for part in texts if part.strip()],
    )


def _extract_image(content: bytes) -> DocumentText:
    if not content:
        raise OCRProcessingError("A imagem está vazia.")
    try:
        with Image.open(io.BytesIO(content)) as image:
            image.load()
            prepared = _prepare_image(image)
            buffer = io.BytesIO()
            prepared.save(buffer, format="PNG", optimize=True)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise OCRProcessingError("A imagem é inválida ou excede o limite de resolução.") from exc

    text, confidence = _run_tesseract(buffer.getvalue())
    if not text.strip():
        raise OCRProcessingError("Nenhum texto legível foi encontrado na imagem.")
    return DocumentText(text=text, source="imagem_ocr", ocr_confidence=confidence, segments=[text])


def _prepare_image(image: Image.Image) -> Image.Image:
    prepared = ImageOps.exif_transpose(image).convert("L")
    prepared = ImageOps.autocontrast(prepared, cutoff=1)
    prepared = ImageEnhance.Contrast(prepared).enhance(1.35)
    prepared = prepared.filter(ImageFilter.SHARPEN)
    max_dimension = 3200
    if max(prepared.size) > max_dimension:
        scale = max_dimension / max(prepared.size)
        prepared = prepared.resize(
            (max(1, int(prepared.width * scale)), max(1, int(prepared.height * scale))),
            Image.Resampling.LANCZOS,
        )
    return prepared


@lru_cache(maxsize=1)
def _tesseract_language() -> str | None:
    try:
        completed = subprocess.run(
            ["tesseract", "--list-langs"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        return None
    languages = {line.strip() for line in completed.stdout.splitlines()[1:] if line.strip()}
    if {"por", "eng"}.issubset(languages):
        return "por+eng"
    if "por" in languages:
        return "por"
    if "eng" in languages:
        return "eng"
    return None


def _run_tesseract(image_bytes: bytes) -> tuple[str, float | None]:
    command = ["tesseract", "stdin", "stdout"]
    language = _tesseract_language()
    if language:
        command.extend(["-l", language])
    command.extend(["--psm", "6", "tsv"])

    try:
        completed = subprocess.run(
            command,
            input=image_bytes,
            capture_output=True,
            timeout=45,
            check=False,
        )
    except FileNotFoundError as exc:
        raise OCRProcessingError("O mecanismo Tesseract não está instalado no servidor.") from exc
    except subprocess.TimeoutExpired as exc:
        raise OCRProcessingError("O OCR excedeu o tempo máximo de processamento.") from exc

    if completed.returncode != 0:
        details = completed.stderr.decode("utf-8", errors="ignore").strip()
        raise OCRProcessingError(f"Falha no Tesseract: {details or 'erro desconhecido'}")

    output = completed.stdout.decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(output), delimiter="\t")
    lines: dict[tuple[str, str, str, str], list[str]] = {}
    confidences: list[float] = []

    for row in reader:
        word = (row.get("text") or "").strip()
        if not word:
            continue
        key = (
            row.get("page_num") or "0",
            row.get("block_num") or "0",
            row.get("par_num") or "0",
            row.get("line_num") or "0",
        )
        lines.setdefault(key, []).append(word)
        try:
            confidence = float(row.get("conf") or -1)
            if confidence >= 0:
                confidences.append(confidence)
        except ValueError:
            pass

    text = "\n".join(" ".join(words) for words in lines.values())
    average = sum(confidences) / len(confidences) if confidences else None
    return text, average


def parse_financial_fields(text: str, file_name: str) -> dict[str, Any]:
    normalized = text.replace("\x00", " ")
    xml_fields = _extract_xml_fields(normalized) if "<" in normalized and ">" in normalized else {}
    document_type = _detect_document_type(normalized, file_name)
    cnpj = xml_fields.get("cnpj") or _extract_cnpj(normalized)
    emission_date, due_date = _extract_dates(normalized)
    emission_date = xml_fields.get("dataEmissao") or emission_date
    due_date = xml_fields.get("dataVencimento") or due_date
    amount = xml_fields.get("valorTotal") or _extract_amount(normalized)
    supplier = xml_fields.get("fornecedor") or _extract_supplier(normalized, file_name)
    digit_line = _extract_digit_line(normalized)
    category = _suggest_category(normalized)
    payer = _extract_party_after_label(normalized, ("pagador", "cliente", "remetente"))
    receiver = _extract_party_after_label(
        normalized,
        ("recebedor", "beneficiário", "beneficiario", "beneficiador", "favorecido"),
    )
    transaction_id = _extract_transaction_identifier(normalized)
    document_number = _extract_document_number(normalized)
    document_key = xml_fields.get("chaveDocumento") or _extract_document_key(normalized)
    direction, dre_impact, purpose = _suggest_financial_classification(normalized, document_type)

    return {
        "fornecedor": supplier,
        "cnpj": cnpj,
        "dataEmissao": emission_date,
        "dataVencimento": due_date,
        "valorTotal": amount,
        "categoria": category,
        "centroCusto": _suggest_cost_center(normalized, category),
        "linhaDigitavel": digit_line,
        "chaveDocumento": document_key,
        "identificadorTransacao": transaction_id,
        "documentoNumero": document_number,
        "pagador": payer,
        "recebedor": receiver,
        "sentidoSugerido": direction,
        "impactoDRESugerido": dre_impact,
        "finalidadeSugerida": purpose,
        "observacoes": _extract_observations(normalized),
        "itens": [],
        "tipo": document_type,
    }


def _extract_financial_entities(extracted: DocumentText, file_name: str) -> list[dict[str, Any]]:
    if extracted.source == "xml":
        installments = _extract_xml_installments(extracted.text, file_name)
        return installments if len(installments) > 1 else []

    entities: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, float, str, str]] = set()

    for page_number, page_text in enumerate(extracted.segments or [extracted.text], start=1):
        page_type = _detect_document_type(page_text, file_name)
        if page_type == "EXTRATO":
            page_entities = _extract_statement_movements(page_text, file_name, page_number)
        else:
            sections = _split_financial_sections(page_text)
            page_entities = []
            for section in sections:
                section_fields = parse_financial_fields(section, file_name)
                section_fields["paginaOrigem"] = page_number
                if float(section_fields.get("valorTotal") or 0) > 0:
                    page_entities.append(section_fields)

        for entity in page_entities:
            key = (
                str(entity.get("tipo") or ""),
                str(entity.get("cnpj") or ""),
                str(entity.get("dataVencimento") or entity.get("dataEmissao") or ""),
                float(entity.get("valorTotal") or 0),
                str(entity.get("linhaDigitavel") or ""),
                str(entity.get("identificadorTransacao") or ""),
            )
            if key in seen:
                continue
            seen.add(key)
            entities.append(entity)

    return entities if len(entities) > 1 else []


def _split_financial_sections(text: str) -> list[str]:
    labels = re.compile(
        r"(?<![A-Za-zÀ-ÿ])(?:benefici[aá]ri[oa]|beneficiador|cedente|favorecido|"
        r"comprovante\s+(?:de\s+)?(?:pix|pagamento|transfer[eê]ncia))",
        flags=re.IGNORECASE,
    )
    starts = [match.start() for match in labels.finditer(text)]
    if len(starts) < 2:
        return [text]

    sections: list[str] = []
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else len(text)
        section = text[start:end].strip()
        if section:
            sections.append(section)
    return sections or [text]


def _extract_xml_installments(text: str, file_name: str) -> list[dict[str, Any]]:
    try:
        root = ET.fromstring(text.strip())
    except ET.ParseError:
        return []

    base = parse_financial_fields(text, file_name)
    installments: list[dict[str, Any]] = []
    for element in root.iter():
        if element.tag.rsplit("}", 1)[-1] != "dup":
            continue
        values = {
            child.tag.rsplit("}", 1)[-1]: (child.text or "").strip()
            for child in element
        }
        amount = _parse_number(values.get("vDup", ""))
        due = _normalize_date(values.get("dVenc", ""))
        if amount <= 0 or not due:
            continue
        installments.append(
            {
                **base,
                "tipo": "NFE",
                "valorTotal": amount,
                "dataVencimento": due,
                "parcelaNumero": values.get("nDup") or str(len(installments) + 1),
                "sentidoSugerido": "SAIDA",
                "impactoDRESugerido": "DESPESA",
                "finalidadeSugerida": "PAGAMENTO_FORNECEDOR",
            }
        )
    return installments


def _extract_statement_movements(text: str, file_name: str, page_number: int) -> list[dict[str, Any]]:
    movements: list[dict[str, Any]] = []
    line_pattern = re.compile(
        r"^(?P<date>\d{2}/\d{2}(?:/\d{2,4})?)\s+"
        r"(?P<description>.+?)\s+"
        r"(?P<amount>-?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|-?\s*(?:R\$\s*)?\d+[.,]\d{2})"
        r"(?:\s*(?P<nature>[CD]))?$",
        flags=re.IGNORECASE,
    )
    current_year = date.today().year
    for line in text.splitlines():
        normalized_line = re.sub(r"\s+", " ", line).strip()
        match = line_pattern.match(normalized_line)
        if not match:
            continue
        raw_date = match.group("date")
        if raw_date.count("/") == 1:
            raw_date = f"{raw_date}/{current_year}"
        movement_date = _normalize_date(raw_date)
        raw_amount = match.group("amount")
        amount = _parse_number(raw_amount.replace("R$", "").replace("-", "").strip())
        nature = (match.group("nature") or "").upper()
        direction = "SAIDA" if raw_amount.strip().startswith("-") or nature == "D" else "ENTRADA"
        description = match.group("description").strip(" -")
        impact, purpose = _statement_classification(description, direction)
        movements.append(
            {
                **parse_financial_fields(normalized_line, file_name),
                "tipo": "EXTRATO",
                "fornecedor": description,
                "dataEmissao": movement_date,
                "dataVencimento": movement_date,
                "valorTotal": amount,
                "sentidoSugerido": direction,
                "impactoDRESugerido": impact,
                "finalidadeSugerida": purpose,
                "paginaOrigem": page_number,
            }
        )
    return movements


def _statement_classification(description: str, direction: str) -> tuple[str, str]:
    sample = description.casefold()
    if any(term in sample for term in ("transf", "aplicacao", "aplicação", "resgate")):
        return "NAO_AFETA", "TRANSFERENCIA_INTERNA"
    if any(term in sample for term in ("tarifa", "cesta", "juros", "encargo")):
        return "DESPESA", "TARIFA_BANCARIA"
    if any(term in sample for term in ("emprest", "emprést", "capital giro")):
        return "NAO_AFETA", "EMPRESTIMO"
    if any(term in sample for term in ("estorno", "devolu")):
        return "A_CONFIRMAR", "ESTORNO_DEVOLUCAO"
    return ("RECEITA", "RECEBIMENTO_CLIENTE") if direction == "ENTRADA" else ("DESPESA", "PAGAMENTO_FORNECEDOR")


def _extract_xml_fields(text: str) -> dict[str, Any]:
    try:
        root = ET.fromstring(text.strip())
    except ET.ParseError:
        return {}

    values: dict[str, list[str]] = {}
    for element in root.iter():
        tag = element.tag.rsplit("}", 1)[-1]
        value = (element.text or "").strip()
        if value:
            values.setdefault(tag, []).append(value)

    result: dict[str, Any] = {}
    if values.get("xNome"):
        result["fornecedor"] = values["xNome"][0]
    if values.get("CNPJ"):
        result["cnpj"] = _format_cnpj(values["CNPJ"][0])
    if values.get("vNF"):
        result["valorTotal"] = _parse_number(values["vNF"][0])
    if values.get("chNFe"):
        result["chaveDocumento"] = re.sub(r"\D", "", values["chNFe"][0])
    elif root.tag.rsplit("}", 1)[-1] == "NFe":
        info = next((element for element in root.iter() if element.tag.rsplit("}", 1)[-1] == "infNFe"), None)
        if info is not None and info.attrib.get("Id"):
            result["chaveDocumento"] = re.sub(r"\D", "", info.attrib["Id"])
    emission = (values.get("dhEmi") or values.get("dEmi") or [""])[0]
    if emission:
        result["dataEmissao"] = emission[:10]
    due = (values.get("dVenc") or [""])[0]
    if due:
        result["dataVencimento"] = due[:10]
    return result


def _extract_cnpj(text: str) -> str:
    match = re.search(r"(?<!\d)(\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2})(?!\d)", text)
    return _format_cnpj(match.group(1)) if match else ""


def _format_cnpj(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) != 14:
        return value.strip()
    return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"


def _extract_dates(text: str) -> tuple[str, str]:
    date_pattern = r"(\d{2}[/-]\d{2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})"
    emission = _date_after_label(text, r"(?:data\s*(?:de|da)?\s*emiss[aã]o|emitid[oa]\s*em)", date_pattern)
    due = _date_after_label(text, r"(?:data\s*(?:de|do)?\s*vencimento|vencimento|vence\s*em)", date_pattern)
    all_dates = [_normalize_date(match) for match in re.findall(date_pattern, text, flags=re.IGNORECASE)]
    all_dates = [value for value in all_dates if value]
    if not emission and all_dates:
        emission = all_dates[0]
    if not due:
        due = all_dates[1] if len(all_dates) > 1 else emission
    return emission, due


def _date_after_label(text: str, label_pattern: str, date_pattern: str) -> str:
    match = re.search(rf"{label_pattern}[^\d]{{0,35}}{date_pattern}", text, flags=re.IGNORECASE)
    return _normalize_date(match.group(1)) if match else ""


def _normalize_date(value: str) -> str:
    candidate = value.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", candidate):
        try:
            return date.fromisoformat(candidate).isoformat()
        except ValueError:
            return ""
    for pattern in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"):
        try:
            return datetime.strptime(candidate, pattern).date().isoformat()
        except ValueError:
            continue
    return ""


def _extract_amount(text: str) -> float:
    number_pattern = r"(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})"
    labels = (
        r"valor\s*(?:total|do\s*documento|cobrado|a\s*pagar|l[ií]quido)",
        r"total\s*(?:da\s*nota|a\s*pagar)?",
    )
    for label in labels:
        match = re.search(rf"{label}[^\d]{{0,25}}{number_pattern}", text, flags=re.IGNORECASE)
        if match:
            return _parse_number(match.group(1))

    currency_values = [_parse_number(value) for value in re.findall(rf"R\$\s*{number_pattern}", text, flags=re.IGNORECASE)]
    return max(currency_values, default=0.0)


def _parse_number(value: str) -> float:
    cleaned = value.strip().replace(" ", "")
    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return 0.0


def _extract_digit_line(text: str) -> str:
    patterns = (
        r"\d{5}[.\s]?\d{5}\s+\d{5}[.\s]?\d{6}\s+\d{5}[.\s]?\d{6}\s+\d\s+\d{14}",
        r"(?<!\d)(?:\d[.\s]?){47,48}(?!\d)",
    )
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            digits = re.sub(r"\D", "", match.group(0))
            if len(digits) in {47, 48}:
                return digits
    return ""


def _extract_supplier(text: str, file_name: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip(" :-") for line in text.splitlines() if line.strip()]
    label_pattern = re.compile(
        r"(?<![A-Za-zÀ-ÿ])(?:benefici[aá]ri[oa]|beneficiador|cedente|emitente|prestador|favorecido|raz[aã]o social)",
        flags=re.IGNORECASE,
    )

    for index, line in enumerate(lines):
        label_match = label_pattern.search(line)
        if not label_match:
            continue

        inline_candidate = line[label_match.end():].strip(" :-")
        candidates = [inline_candidate, *lines[index + 1:index + 4]]
        for candidate in candidates:
            candidate = re.split(r"\b(?:CNPJ|CPF)\b\s*: ?", candidate, maxsplit=1, flags=re.IGNORECASE)[0]
            candidate = re.sub(r"^(?:nome|raz[aã]o social)\s*[:\-]?\s*", "", candidate, flags=re.IGNORECASE)
            candidate = candidate.strip(" :-")
            if _is_supplier_candidate(candidate):
                return candidate[:160]

    return Path(file_name).stem.replace("_", " ").replace("-", " ").strip()[:160] or "Fornecedor não identificado"


def _extract_party_after_label(text: str, labels: tuple[str, ...]) -> str:
    label_pattern = "|".join(re.escape(label) for label in labels)
    match = re.search(
        rf"(?:{label_pattern})\s*[:\-]?\s*([^\n]{{3,160}})",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return ""
    candidate = re.split(
        r"\b(?:CPF|CNPJ|institui[cç][aã]o|banco|ag[eê]ncia|conta|valor|data)\b",
        match.group(1),
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0].strip(" :-")
    return candidate[:160] if _is_supplier_candidate(candidate) else ""


def _extract_transaction_identifier(text: str) -> str:
    patterns = (
        r"(?:end\s*to\s*end(?:\s*id)?|endtoendid|e2e)\s*[:\-]?\s*([A-Za-z0-9]{12,40})",
        r"(?:txid|id\s+da\s+transa[cç][aã]o|autentica[cç][aã]o)\s*[:\-]?\s*([A-Za-z0-9.\-/]{6,50})",
    )
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return ""


def _extract_document_number(text: str) -> str:
    match = re.search(
        r"(?:n[uú]mero\s+(?:do\s+)?documento|n[uú]mero\s+(?:da\s+)?nota|nota\s+fiscal\s+n[ºo.]*)"
        r"\s*[:\-]?\s*([A-Za-z0-9.\-/]{2,30})",
        text,
        flags=re.IGNORECASE,
    )
    return match.group(1).strip() if match else ""


def _extract_document_key(text: str) -> str:
    labelled = re.search(
        r"(?:chave\s+de\s+acesso)\D{0,20}((?:\d[ .]?){44})",
        text,
        flags=re.IGNORECASE,
    )
    if labelled:
        return re.sub(r"\D", "", labelled.group(1))
    return ""


def _suggest_financial_classification(text: str, document_type: str) -> tuple[str, str, str]:
    sample = text.casefold()
    if document_type in {"BOLETO", "DDA", "NFE", "NFSE", "FATURA"}:
        return "SAIDA", "DESPESA", "PAGAMENTO_FORNECEDOR"
    if document_type == "EXTRATO":
        return "A_CONFIRMAR", "A_CONFIRMAR", "A_CONFIRMAR"
    if any(term in sample for term in ("você recebeu", "voce recebeu", "pix recebido", "recebimento concluído", "recebimento concluido")):
        return "ENTRADA", "RECEITA", "RECEBIMENTO_CLIENTE"
    if any(term in sample for term in ("você pagou", "voce pagou", "pix enviado", "pagamento realizado", "transferência enviada", "transferencia enviada")):
        return "SAIDA", "DESPESA", "PAGAMENTO_FORNECEDOR"
    if document_type in {"COMPROVANTE", "RECIBO"}:
        return "A_CONFIRMAR", "A_CONFIRMAR", "A_CONFIRMAR"
    return "A_CONFIRMAR", "A_CONFIRMAR", "A_CONFIRMAR"


def _is_supplier_candidate(candidate: str) -> bool:
    if len(candidate) < 3 or len(re.findall(r"[A-Za-zÀ-ÿ]", candidate)) < 3:
        return False
    if re.fullmatch(r"[\d.\-/\s]+", candidate):
        return False
    rejected_labels = (
        "cnpj",
        "cpf",
        "pagador",
        "agência",
        "agencia",
        "banco",
        "vencimento",
        "valor do documento",
        "linha digitável",
        "linha digitavel",
        "juros",
        "multa",
        "desconto",
        "protestar",
        "após o vencimento",
        "apos o vencimento",
        "instruções",
        "instrucoes",
    )
    lowered = candidate.lower()
    return not any(lowered.startswith(label) for label in rejected_labels)


def _detect_document_type(text: str, file_name: str) -> str:
    sample = f"{file_name}\n{text[:5000]}".lower()
    if "extrato" in sample and any(term in sample for term in ("saldo", "lançamento", "lancamento", "agência", "agencia", "conta")):
        return "EXTRATO"
    if any(term in sample for term in ("comprovante de pix", "comprovante pix", "comprovante de pagamento", "comprovante de transferência", "comprovante de transferencia", "endtoendid", "end to end")):
        return "COMPROVANTE"
    if "<infnfe" in sample or "nota fiscal eletr" in sample or "nf-e" in sample or "nfs-e" in sample:
        return "NFSE" if "nfs-e" in sample else "NFE"
    if "dda" in sample:
        return "DDA"
    if "linha digit" in sample or "boleto" in sample or _extract_digit_line(text):
        return "BOLETO"
    if "recibo" in sample:
        return "RECIBO"
    if "fatura" in sample:
        return "FATURA"
    return "OUTRO"


def _suggest_category(text: str) -> str:
    sample = text.lower()
    rules = (
        (("botox", "toxina", "preenchedor", "medicamento", "insumo", "seringa", "agulha"), "Insumos Médicos & Estéticos"),
        (("aluguel", "condomínio", "condominio", "energia", "água", "agua", "imóvel", "imovel"), "Ocupação & Infraestrutura"),
        (("marketing", "anúncio", "anuncio", "publicidade", "tráfego", "trafego"), "Marketing & Publicidade"),
        (("manutenção", "manutencao", "equipamento", "peça", "peca", "reparo"), "Manutenção & Equipamentos"),
        (("software", "licença", "licenca", "assinatura", "sistema", "cloud"), "Softwares & Sistemas"),
        (("honorário", "honorario", "consultoria", "serviço", "servico"), "Serviços Terceirizados"),
    )
    for keywords, category in rules:
        if any(keyword in sample for keyword in keywords):
            return category
    return "Despesas Operacionais"


def _suggest_cost_center(text: str, category: str) -> str:
    sample = text.lower()
    if category == "Insumos Médicos & Estéticos" or any(word in sample for word in ("estoque", "produto")):
        return "Estoque Central"
    if any(word in sample for word in ("paciente", "procedimento", "clínica", "clinica")):
        return "Clínica / Atendimento"
    return "Administrativo"


def _extract_observations(text: str) -> str:
    keywords = ("desconto", "multa", "juros", "protesto", "instrução", "instrucao")
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    selected = [line for line in lines if line and any(keyword in line.lower() for keyword in keywords)]
    return " | ".join(selected[:4])[:500]


def _field_completeness(fields: dict[str, Any]) -> float:
    checks = (
        bool(fields.get("fornecedor")) and fields.get("fornecedor") != "Fornecedor não identificado",
        bool(fields.get("cnpj")),
        bool(fields.get("dataEmissao")),
        bool(fields.get("dataVencimento")),
        float(fields.get("valorTotal") or 0) > 0,
        fields.get("tipo") != "OUTRO",
    )
    return (sum(checks) / len(checks)) * 100


def _decode_text(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise OCRProcessingError("Não foi possível decodificar o arquivo de texto.")


def tesseract_status() -> dict[str, Any]:
    language = _tesseract_language()
    try:
        completed = subprocess.run(
            ["tesseract", "--version"], capture_output=True, text=True, timeout=5, check=False
        )
        version = completed.stdout.splitlines()[0] if completed.returncode == 0 and completed.stdout else "indisponível"
    except (FileNotFoundError, subprocess.SubprocessError):
        version = "não instalado"
    return {"version": version, "language": language or "padrão"}
