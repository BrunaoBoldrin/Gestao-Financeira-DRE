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

    def test_splits_two_boletos_for_individual_confirmation(self):
        text = """
        BOLETO BANCÁRIO
        Beneficiário: Fornecedor Alfa Ltda
        CNPJ: 11.111.111/0001-11
        Vencimento: 20/08/2026
        Valor do documento: R$ 1.250,00
        00190.00009 01234.567890 12345.678901 1 12340000125000

        BOLETO BANCÁRIO
        Beneficiário: Fornecedor Beta Ltda
        CNPJ: 22.222.222/0001-22
        Vencimento: 05/09/2026
        Valor do documento: R$ 980,50
        03399.00005 09876.543210 98765.432109 2 23450000098050
        """
        result = analyze_document(
            content=text.encode(),
            mime_type="text/plain",
            file_name="dois_boletos.txt",
            max_pages=5,
        )

        entities = result["entidadesFinanceiras"]
        self.assertEqual(len(entities), 2)
        self.assertEqual([item["valorTotal"] for item in entities], [1250.0, 980.5])
        self.assertEqual([item["dataVencimento"] for item in entities], ["2026-08-20", "2026-09-05"])

    def test_does_not_split_boleto_instructions_as_second_document(self):
        text = """
        BOLETO BANCÁRIO
        Beneficiário: Fornecedor Alfa Ltda
        CNPJ: 11.111.111/0001-11
        Vencimento: 20/08/2026
        Valor do documento: R$ 1.250,00
        00190.00009 01234.567890 12345.678901 1 12340000125000

        Instruções do boleto
        Beneficiário após o vencimento: Banco Emissor
        Cobrar juros de R$ 12,50 e multa de 2%.
        """
        result = analyze_document(
            content=text.encode(),
            mime_type="text/plain",
            file_name="boleto_com_instrucoes.txt",
            max_pages=5,
        )

        self.assertEqual(result["entidadesFinanceiras"], [])
        self.assertEqual(result["formaPagamento"], "BOLETO")
        self.assertEqual(result["valorTotal"], 1250.0)

    def test_reads_nfe_installments_in_one_review(self):
        xml = """<nfeProc><NFe><infNFe Id="NFe35123456789012345678901234567890123456789012">
        <ide><dhEmi>2026-08-05T10:00:00-03:00</dhEmi></ide>
        <emit><CNPJ>02345678000112</CNPJ><xNome>Galderma Brasil Ltda</xNome></emit>
        <total><ICMSTot><vNF>3000.00</vNF></ICMSTot></total><cobr>
        <dup><nDup>001</nDup><dVenc>2026-09-05</dVenc><vDup>1000.00</vDup></dup>
        <dup><nDup>002</nDup><dVenc>2026-10-05</dVenc><vDup>2000.00</vDup></dup>
        </cobr></infNFe></NFe></nfeProc>"""
        result = analyze_document(
            content=xml.encode(),
            mime_type="application/xml",
            file_name="nfe_parcelada.xml",
            max_pages=5,
        )

        self.assertEqual(result["entidadesFinanceiras"], [])
        self.assertEqual(result["valorTotal"], 3000.0)
        self.assertEqual(result["parcelas"], [
            {"numero": "001", "dataVencimento": "2026-09-05", "valor": 1000.0},
            {"numero": "002", "dataVencimento": "2026-10-05", "valor": 2000.0},
        ])

    def test_reads_printed_invoice_dates_and_terms_without_counting_tax_totals(self):
        text = """DANFE Nota Fiscal Eletronica
Emissão: 05/08/2026
Valor Total do Frete: 100,00
Valor Total da Nota: R$ 312,70
Condição de pagamento: 30/60 dias
FATURA / DUPLICATAS
NÚMERO VENCIMENTO VALOR
001 04/09/2026 110,00
002
07/10/2026
202,70
"""
        result = analyze_document(b"", "text/plain", "nota.txt", text_content=text)
        self.assertEqual(result["dataEmissao"], "2026-08-05")
        self.assertEqual(result["valorTotal"], 312.70)
        self.assertEqual(result["prazosPagamento"], [30, 60])
        self.assertEqual([(row["dataVencimento"], row["valor"]) for row in result["parcelas"]], [
            ("2026-09-04", 110.0), ("2026-10-07", 202.70)
        ])

    def test_does_not_invent_due_date_from_invoice_without_payment_information(self):
        text = "NOTA FISCAL\nEmissao: 05/08/2026\nSaida: 05/08/2026\nValor Total: 100,00"
        result = analyze_document(b"", "text/plain", "nota.txt", text_content=text)
        self.assertEqual(result["dataVencimento"], "")
        self.assertEqual(result["prazosPagamento"], [])

    def test_groups_matching_boleto_pages_under_invoice(self):
        pages = [
            "DANFE\nEmitente: Fornecedor Alfa Ltda\nCNPJ: 11.111.111/0001-11\n"
            "Emissao: 05/08/2026\nValor Total da Nota: 250,00",
            "BOLETO\nBeneficiario: Fornecedor Alfa Ltda\nCNPJ: 11.111.111/0001-11\n"
            "Vencimento: 04/09/2026\nValor do documento: 100,00\n"
            "00190.00009 01234.567890 12345.678901 1 12340000010000",
            "BOLETO\nBeneficiario: Fornecedor Alfa Ltda\nCNPJ: 11.111.111/0001-11\n"
            "Vencimento: 05/10/2026\nValor do documento: 150,00\n"
            "03399.00005 09876.543210 98765.432109 2 23450000015000",
        ]
        for mismatch in (False, True):
            with self.subTest(mismatch=mismatch):
                with pymupdf.open() as pdf:
                    for idx, text in enumerate(pages):
                        page = pdf.new_page()
                        if mismatch and idx == 2:
                            text = text.replace("11.111.111/0001-11", "22.222.222/0001-22")
                        page.insert_text((50, 50), text, fontsize=10)
                    result = analyze_document(pdf.tobytes(), "application/pdf", "nota.pdf")
                if mismatch:
                    self.assertEqual([item["tipo"] for item in result["entidadesFinanceiras"]], ["NFE", "BOLETO", "BOLETO"])
                    self.assertEqual(result["parcelas"], [])
                else:
                    self.assertEqual(result["entidadesFinanceiras"], [])
                    self.assertEqual([row["valor"] for row in result["parcelas"]], [100, 150])
                    self.assertTrue(all(len(row["linhaDigitavel"]) == 47 for row in result["parcelas"]))

    def test_coupon_and_notinha_with_counterparty_tax_id(self):
        coupon = "CUPOM FISCAL\nCNPJ: 11.111.111/0001-11\nCPF do consumidor: 123.456.789-00\nValor total: 50,00"
        note = "NOTINHA\nCPF: 12345678900\nValor total: 50,00"
        for data, kind, tax_id in [(coupon, "CUPOM", "11.111.111/0001-11"), (note, "NOTINHA", "123.456.789-00")]:
            with self.subTest(kind=kind):
                result = analyze_document(b"", "text/plain", "documento.txt", text_content=data)
                self.assertEqual(result["tipo"], kind)
                self.assertEqual(result["cnpj"], tax_id)

    def test_receipt_selects_payer_tax_id_for_money_received(self):
        text = """COMPROVANTE DE PIX
Pix recebido
Pagador: Maria
CPF: 123.456.789-00
Recebedor: Clínica Teste
CNPJ: 11.111.111/0001-11
Valor total: 50,00
"""
        result = analyze_document(b"", "text/plain", "pix.txt", text_content=text)
        self.assertEqual(result["cnpj"], "123.456.789-00")
        self.assertEqual(result["cpfCnpjRecebedor"], "11.111.111/0001-11")

    def test_splits_statement_income_expense_and_transfer(self):
        text = """
        EXTRATO BANCÁRIO Agência 0001 Conta 12345-6 Saldo 10.000,00
        01/08/2026 PIX RECEBIDO CLIENTE MARIA 1.500,00 C
        02/08/2026 TARIFA BANCARIA 25,00 D
        03/08/2026 TRANSFERENCIA ENTRE CONTAS 500,00 D
        """
        result = analyze_document(
            content=text.encode(),
            mime_type="text/plain",
            file_name="extrato_agosto.txt",
            max_pages=5,
        )

        entities = result["entidadesFinanceiras"]
        self.assertEqual(len(entities), 3)
        self.assertEqual(entities[0]["sentidoSugerido"], "ENTRADA")
        self.assertEqual(entities[0]["impactoDRESugerido"], "RECEITA")
        self.assertEqual(entities[1]["finalidadeSugerida"], "TARIFA_BANCARIA")
        self.assertEqual(entities[2]["impactoDRESugerido"], "NAO_AFETA")

    def test_classifies_client_pix_receipt_as_revenue_suggestion(self):
        text = """
        COMPROVANTE DE PIX
        Você recebeu um Pix
        Pagador: Cliente Maria da Silva
        Recebedor: Royal Face Matriz
        Valor total: R$ 350,00
        Data: 18/08/2026
        EndToEndId: E12345678202608181234ABCDEF
        """
        result = parse_financial_fields(text, "pix_recebido.pdf")

        self.assertEqual(result["tipo"], "COMPROVANTE")
        self.assertEqual(result["sentidoSugerido"], "ENTRADA")
        self.assertEqual(result["impactoDRESugerido"], "RECEITA")
        self.assertEqual(result["finalidadeSugerida"], "RECEBIMENTO_CLIENTE")
        self.assertEqual(result["identificadorTransacao"], "E12345678202608181234ABCDEF")

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
