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

    def test_serves_installable_app_assets(self):
        page = self.client.get("/")
        self.assertIn('rel="manifest" href="/manifest.webmanifest"', page.text)
        manifest = self.client.get("/manifest.webmanifest")
        self.assertEqual(manifest.headers["Content-Type"], "application/manifest+json")
        self.assertEqual(manifest.json()["start_url"], "/")
        self.assertEqual(manifest.json()["display"], "standalone")
        for icon in manifest.json()["icons"]:
            with self.subTest(icon=icon["src"]):
                response = self.client.get(icon["src"])
                self.assertEqual(response.headers["Content-Type"], "image/png")
                size = int(icon["sizes"].split("x")[0])
                self.assertEqual(int.from_bytes(response.content[16:20], "big"), size)
                self.assertEqual(int.from_bytes(response.content[20:24], "big"), size)

        worker = self.client.get("/sw.js")
        self.assertEqual(worker.status_code, 200)
        self.assertIn("javascript", worker.headers["Content-Type"])
        self.assertEqual(worker.headers["Cache-Control"], "no-cache")
        self.assertIn("Sem conexão com a internet", self.client.get("/offline.html").text)

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
        self.assertEqual(payload["schemaVersion"], 2)
        self.assertEqual(payload["motor"], "python-local")
        self.assertEqual(payload["dadosExtraidos"]["fornecedor"], "Galderma Brasil Ltda")
        self.assertEqual(payload["dadosExtraidos"]["valorTotal"], 12850.75)
        self.assertEqual(payload["dadosExtraidos"]["formaPagamento"], "BOLETO")
        self.assertEqual(len(payload["metadados"]["hashArquivo"]), 64)
        self.assertIn("entidadesFinanceiras", payload)

    def test_rejects_missing_content(self):
        response = self.client.post(
            "/api/ocr",
            json={"fileName": "vazio.pdf", "mimeType": "application/pdf"},
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
