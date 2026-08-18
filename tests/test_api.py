import base64
import unittest

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


if __name__ == "__main__":
    unittest.main()
