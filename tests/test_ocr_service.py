import base64
import io
import shutil
import unittest

import pymupdf
from PIL import Image, ImageDraw, ImageFont

from backend.ocr_service import (
    OCRProcessingError,
    analyze_document,
    decode_file_data,
    parse_financial_fields,
    validate_document,
)


class OCRServiceTests(unittest.TestCase):
    def test_extracts_boleto_fields(self):
        text = """
        BOLETO BANCÁRIO
        Beneficiário: Clínica Exemplo Produtos Ltda
        CNPJ: 12.345.678/0001-90
        Data de emissão: 01/08/2026
        Vencimento: 30/08/2026
        Valor do documento: R$ 5.480,90
        00190.00009 01234.567890 12345.678901 1 12340000548090
        Após o vencimento cobrar multa de 2% e juros.
        """
        result = parse_financial_fields(text, "boleto_teste.pdf")

        self.assertEqual(result["tipo"], "BOLETO")
        self.assertEqual(result["fornecedor"], "Clínica Exemplo Produtos Ltda")
        self.assertEqual(result["cnpj"], "12.345.678/0001-90")
        self.assertEqual(result["dataEmissao"], "2026-08-01")
        self.assertEqual(result["dataVencimento"], "2026-08-30")
        self.assertEqual(result["valorTotal"], 5480.90)
        self.assertEqual(len(result["linhaDigitavel"]), 47)
        self.assertIn("multa", result["observacoes"].lower())

    def test_supplier_skips_cnpj_line_after_beneficiary_label(self):
        text = """
        BOLETO BANCÁRIO
        Beneficiador
        CNPJ: 03.313.366/0001-09
        Galena Química e Farmacêutica Ltda
        Vencimento: 16/08/2026
        Valor do documento: R$ 3.699,00
        """
        result = parse_financial_fields(text, "boleto.pdf")

        self.assertEqual(result["fornecedor"], "Galena Química e Farmacêutica Ltda")
        self.assertEqual(result["cnpj"], "03.313.366/0001-09")

        same_line = parse_financial_fields(
            "Beneficiador: Galena Química e Farmacêutica Ltda CNPJ: 03.313.366/0001-09",
            "boleto.pdf",
        )
        self.assertEqual(same_line["fornecedor"], "Galena Química e Farmacêutica Ltda")

        glued_label = parse_financial_fields(
            """
            Local de Pagamento
            BeneficiárioKATION RAIDEN DO BRASIL LTDA - CNPJ: 03.313.366/0001-09
            R. TENENTE OSCAR NUNES, 285 VILA ELIDA, DIADEMA/SP
            JUROS DE MORA: 1% A.M. APÓS O VENCIMENTO MULTA: 2%
            """,
            "72224.pdf",
        )
        self.assertEqual(glued_label["fornecedor"], "KATION RAIDEN DO BRASIL LTDA")

    def test_extracts_nfe_xml(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
          <NFe><infNFe><ide><dhEmi>2026-08-05T10:00:00-03:00</dhEmi></ide>
          <emit><CNPJ>02345678000112</CNPJ><xNome>Galderma Brasil Ltda</xNome></emit>
          <total><ICMSTot><vNF>12850.75</vNF></ICMSTot></total>
          <cobr><dup><dVenc>2026-09-04</dVenc></dup></cobr>
          </infNFe></NFe>
        </nfeProc>"""
        encoded = base64.b64encode(xml.encode()).decode()
        result = analyze_document(
            content=decode_file_data(f"data:application/xml;base64,{encoded}"),
            mime_type="application/xml",
            file_name="NF_Galderma.xml",
            max_pages=5,
        )

        self.assertEqual(result["tipo"], "NFE")
        self.assertEqual(result["fornecedor"], "Galderma Brasil Ltda")
        self.assertEqual(result["cnpj"], "02.345.678/0001-12")
        self.assertEqual(result["dataEmissao"], "2026-08-05")
        self.assertEqual(result["dataVencimento"], "2026-09-04")
        self.assertEqual(result["valorTotal"], 12850.75)
        self.assertEqual(result["fonteExtracao"], "xml")

    def test_extracts_native_pdf_text(self):
        document = pymupdf.open()
        page = document.new_page()
        page.insert_text(
            (72, 72),
            "BOLETO Beneficiario: Fornecedor PDF Ltda CNPJ: 12.345.678/0001-90",
        )
        page.insert_text(
            (72, 100),
            "Data de emissao: 01/08/2026 Vencimento: 30/08/2026 Valor total: R$ 1.250,00",
        )
        content = document.tobytes()
        document.close()

        result = analyze_document(
            content=content,
            mime_type="application/pdf",
            file_name="boleto_nativo.pdf",
            max_pages=5,
        )

        self.assertEqual(result["fonteExtracao"], "pdf_texto")
        self.assertEqual(result["tipo"], "BOLETO")
        self.assertEqual(result["valorTotal"], 1250.00)

    def test_extracts_multiple_accounts_from_pdf_pages(self):
        document = pymupdf.open()
        accounts = (
            ("KATION RAIDEN DO BRASIL LTDA", "16/08/2026", "3.699,00"),
            ("KATION RAIDEN DO BRASIL LTDA", "25/08/2026", "1.250,50"),
        )
        for supplier, due_date, amount in accounts:
            page = document.new_page()
            page.insert_text((72, 72), f"BOLETO Beneficiario: {supplier} CNPJ: 03.313.366/0001-09")
            page.insert_text((72, 100), f"Data de emissao: 17/07/2026 Vencimento: {due_date}")
            page.insert_text((72, 128), f"Valor do documento: R$ {amount}")
        content = document.tobytes()
        document.close()

        result = analyze_document(
            content=content,
            mime_type="application/pdf",
            file_name="boletos_multiplos.pdf",
            max_pages=5,
        )

        extracted_accounts = result["contasExtraidas"]
        self.assertEqual(len(extracted_accounts), 2)
        self.assertEqual(
            [account["dataVencimento"] for account in extracted_accounts],
            ["2026-08-16", "2026-08-25"],
        )
        self.assertEqual(
            [account["valorTotal"] for account in extracted_accounts],
            [3699.00, 1250.50],
        )

    def test_extracts_multiple_accounts_from_same_page_text(self):
        text = """
        Beneficiario: Fornecedor Primeira Conta Ltda CNPJ: 11.111.111/0001-11
        Emissao: 17/07/2026 Vencimento: 16/08/2026
        Valor do documento: R$ 900,00
        Beneficiario: Fornecedor Segunda Conta Ltda CNPJ: 22.222.222/0001-22
        Emissao: 17/07/2026 Vencimento: 25/08/2026
        Valor do documento: R$ 1.100,00
        """

        result = analyze_document(
            content=b"",
            mime_type="text/plain",
            file_name="boletos_mesma_pagina.pdf",
            text_content=text,
            max_pages=5,
        )

        self.assertEqual(len(result["contasExtraidas"]), 2)
        self.assertEqual(
            [account["fornecedor"] for account in result["contasExtraidas"]],
            ["Fornecedor Primeira Conta Ltda", "Fornecedor Segunda Conta Ltda"],
        )

    @unittest.skipUnless(shutil.which("tesseract"), "Tesseract não instalado")
    def test_extracts_image_with_tesseract(self):
        image = Image.new("RGB", (1800, 650), "white")
        draw = ImageDraw.Draw(image)
        font = ImageFont.load_default(size=44)
        lines = (
            "BOLETO BANCARIO",
            "Beneficiario: Fornecedor Imagem Ltda",
            "CNPJ: 12.345.678/0001-90",
            "Emissao: 01/08/2026   Vencimento: 30/08/2026",
            "Valor total: R$ 1.250,00",
        )
        for index, line in enumerate(lines):
            draw.text((50, 45 + (index * 105)), line, font=font, fill="black")
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=95)

        result = analyze_document(
            content=buffer.getvalue(),
            mime_type="image/jpeg",
            file_name="boleto_imagem.jpg",
            max_pages=5,
        )

        self.assertEqual(result["fonteExtracao"], "imagem_ocr")
        self.assertEqual(result["fornecedor"], "Fornecedor Imagem Ltda")
        self.assertEqual(result["valorTotal"], 1250.00)

    def test_rejects_invalid_base64(self):
        with self.assertRaises(OCRProcessingError):
            decode_file_data("data:application/pdf;base64,%%%")

    def test_rejects_oversized_document(self):
        with self.assertRaises(OCRProcessingError):
            validate_document(b"x" * 1025, "application/pdf", "teste.pdf", max_file_mb=0)


if __name__ == "__main__":
    unittest.main()
