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
FISCAL_TYPES = {"NFE", "NFSE", "FATURA"}
PAYMENT_DATE = r"(\d{2}[/-]\d{2}[/-](?:\d{4}|\d{2})|\d{4}-\d{2}-\d{2})(?!\d)"
PAYMENT_AMOUNT = r"(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})(?!\d)"


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
    invoice = _invoice_with_boletos(extracted)
    if invoice:
        fields, entities = invoice, []
    else:
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
    document_type = xml_fields.get("tipoDocumento") or _detect_document_type(normalized, file_name)
    emission_date, due_date = _extract_dates(normalized)
    emission_date = xml_fields.get("dataEmissao") or emission_date
    due_date = xml_fields.get("dataVencimento") or due_date
    amount = xml_fields.get("valorTotal") or _extract_amount(normalized, fiscal=document_type in FISCAL_TYPES)
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
    payment_method = _suggest_payment_method(normalized, document_type)
    payer_document, receiver_document = _extract_party_documents(normalized)
    cnpj = xml_fields.get("cnpj") or _extract_cnpj(normalized) or _extract_cpf(normalized)
    if not xml_fields:
        if direction == "ENTRADA":
            cnpj = payer_document or (cnpj if cnpj != receiver_document else "")
        elif direction == "SAIDA":
            cnpj = receiver_document or (cnpj if cnpj != payer_document else "")
        elif payer_document and receiver_document:
            cnpj = ""
    installments = xml_fields.get("parcelas", []) if xml_fields else (
        _extract_printed_installments(normalized) if document_type in FISCAL_TYPES else []
    )
    if document_type in FISCAL_TYPES:
        emission_date = xml_fields.get("dataEmissao") or _explicit_emission_date(normalized)
        due_date = xml_fields.get("dataVencimento") or _explicit_due_date(normalized)
    if installments:
        due_date = installments[0]["dataVencimento"]

    return {
        "fornecedor": supplier,
        "cnpj": cnpj,
        "dataEmissao": emission_date,
        "dataVencimento": due_date,
        "parcelas": installments,
        "prazosPagamento": _extract_payment_terms(normalized) if document_type in FISCAL_TYPES and not xml_fields else [],
        "valorTotal": amount,
        "categoria": category,
        "centroCusto": _suggest_cost_center(normalized, category),
        "linhaDigitavel": digit_line,
        "chaveDocumento": document_key,
        "identificadorTransacao": transaction_id,
        "formaPagamento": payment_method,
        "documentoNumero": document_number,
        "pagador": payer,
        "recebedor": receiver,
        "cpfCnpjPagador": payer_document,
        "cpfCnpjRecebedor": receiver_document,
        "sentidoSugerido": direction,
        "impactoDRESugerido": dre_impact,
        "finalidadeSugerida": purpose,
        "observacoes": _extract_observations(normalized),
        "itens": [],
        "tipo": document_type,
    }


def _extract_financial_entities(extracted: DocumentText, file_name: str) -> list[dict[str, Any]]:
    if extracted.source == "xml":
        return []

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
                typed_name = "" if _detect_document_type(section, "") != "OUTRO" else file_name
                section_fields = parse_financial_fields(section, typed_name)
                section_fields["paginaOrigem"] = page_number
                if (
                    float(section_fields.get("valorTotal") or 0) > 0
                    and (_has_independent_financial_identity(section, section_fields)
                         or _detect_document_type(section, "") in FISCAL_TYPES)
                ):
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


def _has_independent_financial_identity(text: str, fields: dict[str, Any]) -> bool:
    """Avoid treating fees or instructions as a second payable document."""
    if any(
        fields.get(key)
        for key in ("linhaDigitavel", "identificadorTransacao", "chaveDocumento")
    ):
        return True

    amount_label = re.search(
        r"(?:valor\s*(?:total|do\s*documento|cobrado|a\s*pagar|l[ií]quido)|"
        r"total\s*(?:da\s*nota|a\s*pagar)?)\D{0,25}"
        r"(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})",
        text,
        flags=re.IGNORECASE,
    )
    date_label = re.search(
        r"(?:vencimento|vence\s*em|data\s*(?:de|do)?\s*vencimento)\D{0,35}"
        r"(?:\d{2}[/-]\d{2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})",
        text,
        flags=re.IGNORECASE,
    )
    return bool(
        amount_label
        and date_label
        and (fields.get("cnpj") or fields.get("documentoNumero"))
    )


def _extract_xml_installments(root: ET.Element) -> list[dict[str, Any]]:
    installments: list[dict[str, Any]] = []
    for element in root.findall(".//{*}cobr/{*}dup"):
        values = {
            child.tag.rsplit("}", 1)[-1]: (child.text or "").strip()
            for child in element
        }
        amount = _parse_number(values.get("vDup", ""))
        due = _normalize_date(values.get("dVenc", ""))
        if amount <= 0 or not due:
            continue
        installments.append({
            "numero": values.get("nDup") or str(len(installments) + 1),
            "dataVencimento": due,
            "valor": amount,
        })
    return installments


def _extract_payment_terms(text: str) -> list[int]:
    label = r"(?:condi[cç][aã]o\s+(?:de\s+)?pagamento|prazo(?:s)?\s+(?:de\s+)?pagamento|ddl)"
    match = re.search(rf"\b{label}[ \t]*[:\-]?[ \t]*(?:\n[ \t]*)?([^\n]{{1,100}})", text, re.IGNORECASE)
    standalone = re.search(r"^\s*(\d{1,3}(?:[ \t]*/[ \t]*\d{1,3}){1,23}\s+DDL)\s*$", text, re.IGNORECASE | re.MULTILINE)
    if not match and not standalone:
        return []
    value = (match or standalone).group(1).strip()
    if re.fullmatch(r"[àa]\s+vista", value, re.IGNORECASE):
        return [0]
    terms = re.fullmatch(
        r"(\d{1,3}(?:[ \t]*[/;,][ \t]*\d{1,3}){0,23})(?:\s*(dias?(?:\s+ddl)?|ddl))?",
        value, re.IGNORECASE,
    )
    if not terms or (not terms[2] and not re.search(r"[/;,]", terms[1]) and not value.isdigit()):
        return []
    return sorted(int(number) for number in re.findall(r"\d+", terms[1]))


def _extract_printed_installments(text: str) -> list[dict[str, Any]]:
    header = r"(?:fatura\s*/\s*duplicatas?|duplicatas?|parcelas|dados\s+da\s+cobran[cç]a)"
    row = rf"(?:parcela[ \t]+)?(\d{{1,6}})[ \t]+(?:vencimento[ \t]*[:\-]?[ \t]*)?{PAYMENT_DATE}[ \t]+(?:valor[ \t]*[:\-]?[ \t]*)?(?:R\$\s*)?{PAYMENT_AMOUNT}"
    installments = {}
    rows_left = 0
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for index, line in enumerate(lines):
        if not re.search(PAYMENT_DATE, line) and (
            re.fullmatch(rf"\s*{header}\s*:?(?:\s+n[uú]mero.*)?\s*", line, re.IGNORECASE)
            or re.search(r"\b(?:n[uú]mero|parcela|duplicata)\b.*\bvencimento\b.*\bvalor\b", line, re.IGNORECASE)
        ):
            rows_left = 26
            continue
        match = re.fullmatch(rf"\s*{row}\s*", line, re.IGNORECASE) if rows_left or re.match(
            r"\s*parcela\s+\d", line, re.IGNORECASE
        ) else None
        if rows_left and not match and re.fullmatch(r"\d{1,6}", line):
            match = re.fullmatch(row, " ".join(lines[index:index + 3]), re.IGNORECASE)
        if rows_left:
            rows_left -= 1
        if not match:
            continue
        number, due, amount = match.groups()
        due, amount = _normalize_date(due), _parse_number(amount)
        if due and amount > 0:
            installments.setdefault(number, {"numero": number, "dataVencimento": due, "valor": amount})
    return list(installments.values())


def _invoice_with_boletos(extracted: DocumentText) -> dict[str, Any] | None:
    pages = extracted.segments or []
    if extracted.source == "xml" or len(pages) < 2 or _detect_document_type(pages[0], "") not in FISCAL_TYPES:
        return None
    invoice = parse_financial_fields(pages[0], "")
    unique_slips = {}
    for page in pages[1:]:
        if _detect_document_type(page, "") not in {"BOLETO", "DDA"}:
            return None
        slip = parse_financial_fields(page, "")
        due = _explicit_due_date(page)
        if not due or not slip["linhaDigitavel"] or not slip["valorTotal"]:
            return None
        unique_slips.setdefault(slip["linhaDigitavel"], {**slip, "dataVencimento": due})
    slips = sorted(unique_slips.values(), key=lambda slip: slip["dataVencimento"])

    reference = invoice["parcelas"]
    invoice_amount = sum(round(row["valor"] * 100) for row in reference) if reference else round(invoice["valorTotal"] * 100)
    slip_amount = sum(round(slip["valorTotal"] * 100) for slip in slips)
    if not all(
        invoice["chaveDocumento"] and invoice["chaveDocumento"] == slip["chaveDocumento"]
        for slip in slips
    ) and not (
        invoice_amount == slip_amount
        and invoice["cnpj"]
        and all(invoice["cnpj"] == slip["cnpj"] for slip in slips)
    ):
        return None

    return {
        **invoice,
        "dataVencimento": slips[0]["dataVencimento"],
        "parcelas": [
            {"numero": str(index), "dataVencimento": slip["dataVencimento"], "valor": slip["valorTotal"],
             "linhaDigitavel": slip["linhaDigitavel"]}
            for index, slip in enumerate(slips, start=1)
        ],
    }


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
    tags = set()
    for element in root.iter():
        tag = element.tag.rsplit("}", 1)[-1]
        tags.add(tag.casefold())
        value = (element.text or "").strip()
        if value:
            values.setdefault(tag, []).append(value)

    result: dict[str, Any] = {}
    if "infnfe" in tags:
        result["tipoDocumento"] = "CUPOM" if values.get("mod") == ["65"] else "NFE"
    elif {"infnfse", "compnfse", "nfse"} & tags:
        result["tipoDocumento"] = "NFSE"
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
    result["parcelas"] = _extract_xml_installments(root)
    return result


def _extract_cnpj(text: str) -> str:
    labelled = re.search(r"\bCNPJ\b[^A-Za-z0-9*\n]{0,20}([A-Za-z0-9]{12}\d{2})(?![A-Za-z0-9])", text, re.IGNORECASE)
    if labelled:
        return _format_cnpj(labelled[1])
    masked = re.search(r"(?<![A-Za-z0-9])([A-Za-z0-9]{2}\.[A-Za-z0-9]{3}\.[A-Za-z0-9]{3}/[A-Za-z0-9]{4}-\d{2})(?![A-Za-z0-9])", text)
    if masked:
        return _format_cnpj(masked[1])
    match = re.search(r"(?<!\d)(\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2})(?!\d)", text)
    return _format_cnpj(match.group(1)) if match else ""


def _extract_cpf(text: str) -> str:
    match = re.search(r"(?<!\d)(\d{3}\.\d{3}\.\d{3}-\d{2})(?!\d)", text)
    if not match:
        match = re.search(r"\bCPF\b[^\d*\n]{0,34}(\d{11})(?!\d)", text, re.IGNORECASE)
    if not match:
        return ""
    digits = re.sub(r"\D", "", match[1])
    return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"


def _extract_party_documents(text: str) -> tuple[str, str]:
    payer = r"pagador|remetente|cliente|consumidor|destinat[aá]rio"
    receiver = r"recebedor|benefici[aá]ri[oa]|beneficiador|favorecido|emitente|prestador"
    labels = re.compile(rf"\b(?P<payer>{payer})\b|\b(?P<receiver>{receiver})\b", re.IGNORECASE)
    parties = list(labels.finditer(text))
    documents = {"payer": "", "receiver": ""}
    for index, match in enumerate(parties):
        end = parties[index + 1].start() if index + 1 < len(parties) else len(text)
        start = match.start()
        prefix = text[max(0, start - 20):start]
        if re.search(r"\b(?:CPF|CNPJ)\s+(?:do|da)\s*$", prefix, re.IGNORECASE):
            start -= len(prefix)
        section = "\n".join(text[start:min(end, match.end() + 160)].splitlines()[:3])
        # A later line labelled for another party belongs to that party.
        section = re.split(r"\n\s*(?:CPF|CNPJ)\s+(?:do|da)\s*$", section, maxsplit=1, flags=re.IGNORECASE)[0]
        side = match.lastgroup
        if not documents[side]:
            documents[side] = _extract_cnpj(section) or _extract_cpf(section)
    return documents["payer"], documents["receiver"]


def _format_cnpj(value: str) -> str:
    digits = re.sub(r"[^A-Za-z0-9]", "", value).upper()
    if len(digits) != 14:
        return value.strip()
    return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"


def _extract_dates(text: str) -> tuple[str, str]:
    date_pattern = r"(\d{2}[/-]\d{2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})"
    emission = _explicit_emission_date(text)
    due = _explicit_due_date(text)
    all_dates = [_normalize_date(match) for match in re.findall(date_pattern, text, flags=re.IGNORECASE)]
    all_dates = [value for value in all_dates if value]
    if not emission and all_dates:
        emission = all_dates[0]
    if not due:
        due = all_dates[1] if len(all_dates) > 1 else emission
    return emission, due


def _explicit_due_date(text: str) -> str:
    return _date_after_label(text, r"\b(?:vencimento|vence\s*em)\b", PAYMENT_DATE)


def _explicit_emission_date(text: str) -> str:
    return _date_after_label(text, r"\b(?:emiss[aã]o\b|emitid[oa]\s*em)", PAYMENT_DATE)


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


def _extract_amount(text: str, fiscal: bool = False) -> float:
    number_pattern = r"(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})"
    labels = (
        r"valor\s*(?:total|do\s*documento|cobrado|a\s*pagar|l[ií]quido)",
        r"total\s*(?:da\s*nota|a\s*pagar)?",
    )
    if fiscal:
        labels = (r"(?:valor\s*)?total\s+da\s+(?:nota|nfs?-?e)",) + labels
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
    if document_type in {"BOLETO", "DDA", "NFE", "NFSE", "FATURA", "CUPOM", "NOTINHA"}:
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


def _suggest_payment_method(text: str, document_type: str) -> str:
    sample = text.casefold()
    if document_type in {"BOLETO", "DDA"} or _extract_digit_line(text):
        return "BOLETO"
    if "pix" in sample or _extract_transaction_identifier(text):
        return "PIX"
    if any(term in sample for term in ("cartão de crédito", "cartao de credito")):
        return "CARTAO_CREDITO"
    if any(term in sample for term in ("cartão de débito", "cartao de debito")):
        return "CARTAO_DEBITO"
    if "carnê" in sample or "carne" in sample:
        return "CARNE"
    if any(term in sample for term in ("dinheiro", "espécie", "especie")):
        return "DINHEIRO"
    if document_type in {"NFE", "NFSE", "FATURA"}:
        return "BOLETO"
    return "TRANSFERENCIA"


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
    if "cupom" in sample or "cf-e-sat" in sample or "nfc-e" in sample or "nfce" in sample:
        return "CUPOM"
    if "<infnfe" in sample or "danfe" in sample or "nota fiscal eletr" in sample or "nfs-e" in sample:
        return "NFSE" if "nfs-e" in sample else "NFE"
    if "dda" in sample:
        return "DDA"
    if "linha digit" in sample or "boleto" in sample or _extract_digit_line(text):
        return "BOLETO"
    if "nota fiscal" in sample or "nf-e" in sample:
        return "NFE"
    if "recibo" in sample:
        return "RECIBO"
    if "comprovante" in sample:
        return "COMPROVANTE"
    if re.search(r"\b(?:notinha|nota\s+de\s+venda|nota\s+de\s+balc[aã]o|nota\s+promiss[óo]ria)\b", sample):
        return "NOTINHA"
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
