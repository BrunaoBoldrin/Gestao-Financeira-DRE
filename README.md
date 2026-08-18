# Gestão Financeira DRE

Frontend React com backend Python/FastAPI para leitura local de documentos financeiros.

## Motor OCR

- PDF com texto: extração direta com PyMuPDF.
- PDF digitalizado, JPG e PNG: OCR local com Tesseract em português e inglês.
- XML de NF-e: leitura estruturada dos campos fiscais.
- Nenhum documento é enviado para serviços externos.
- Limite padrão: 15 MB e até 5 páginas processadas por documento.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Em outro terminal:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
npm run dev:api
```

O Tesseract e o pacote de idioma português precisam estar instalados no sistema.

## Testes

```bash
python -m unittest discover -s tests -v
npm run lint
npm run build
```

## Render

O deploy deve utilizar o runtime **Docker**, com o `Dockerfile` da raiz. O endpoint de saúde é `/api/health`. As variáveis opcionais são:

- `OCR_MAX_FILE_MB`: tamanho máximo do documento, padrão 15.
- `OCR_MAX_PAGES`: máximo de páginas analisadas, padrão 5.
- `ENABLE_API_DOCS`: use `true` apenas quando quiser habilitar `/api/docs`.
