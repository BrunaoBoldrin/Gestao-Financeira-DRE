import base64
import unittest

import pymupdf
from fastapi.testclient import TestClient

from backend.main import app


class OCRApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["service"], "python-ocr")

    def test_serves_compiled_frontend(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("root", response.text)

    def test_ocr_xml_contract(self):
        xml = b"""<nfeProc><NFe><infNFe><ide><dhEmi>2026-08-05T10:00:00-03:00</dhEmi></ide>
        <emit><CNPJ>02345678000112</CNPJ><xNome>Galderma Brasil Ltda</xNome></emit>
        <total><ICMSTot><vNF>12850.75</vNF></ICMSTot></total>
        <cobr><dup><dVenc>2026-09-04</dVenc></dup></cobr></infNFe></NFe></nfeProc>"""
        response = self.client.post(
            "/api/ocr",
            json={
                "fileData": "data:application/xml;base64," + base64.b64encode(xml).decode(),
                "mimeType": "application/xml",
                "fileName": "NF_Galderma.xml",
                "textContent": "",
            },
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["success"])
        self.assertEqual(payload["motor"], "python-local")
        self.assertEqual(payload["dadosExtraidos"]["fornecedor"], "Galderma Brasil Ltda")
        self.assertEqual(payload["dadosExtraidos"]["valorTotal"], 12850.75)

    def test_rejects_missing_content(self):
        response = self.client.post(
            "/api/ocr",
            json={"fileName": "vazio.pdf", "mimeType": "application/pdf"},
        )
        self.assertEqual(response.status_code, 422)

    def test_ocr_returns_multiple_accounts_for_pdf(self):
        document = pymupdf.open()
        for due_date, amount in (("16/08/2026", "3.699,00"), ("25/08/2026", "1.250,50")):
            page = document.new_page()
            page.insert_text(
                (72, 72),
                "BOLETO Beneficiario: KATION RAIDEN DO BRASIL LTDA CNPJ: 03.313.366/0001-09",
            )
            page.insert_text((72, 100), f"Emissao: 17/07/2026 Vencimento: {due_date}")
            page.insert_text((72, 128), f"Valor do documento: R$ {amount}")
        pdf = document.tobytes()
        document.close()

        response = self.client.post(
            "/api/ocr",
            json={
                "fileData": "data:application/pdf;base64," + base64.b64encode(pdf).decode(),
                "mimeType": "application/pdf",
                "fileName": "boletos_multiplos.pdf",
            },
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(payload["contasExtraidas"]), 2)
        self.assertEqual(
            [account["dadosExtraidos"]["dataVencimento"] for account in payload["contasExtraidas"]],
            ["2026-08-16", "2026-08-25"],
        )


if __name__ == "__main__":
    unittest.main()
