# Gestão Financeira DRE

Frontend React com backend Python/FastAPI, persistência PostgreSQL/Neon e leitura local de documentos financeiros.

## Motor OCR

- PDF com texto: extração direta com PyMuPDF.
- PDF digitalizado, JPG e PNG: OCR local com Tesseract em português e inglês.
- XML de NF-e: leitura estruturada dos campos fiscais.
- O OCR é executado no próprio backend; documentos persistidos no Neon são criptografados antes da gravação.
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
Durante o `npm run dev`, a interface pode iniciar no modo demonstrativo se o banco não estiver configurado. O build de produção bloqueia o acesso nessa situação para evitar lançamentos sem persistência.

## Testes

```bash
python -m unittest discover -s tests -v
npm run lint
npm run build
```

## Banco, login e criptografia

O sistema usa PostgreSQL no Neon. Use um projeto/base separado do sistema KSB. A aplicação aceita `DATABASE_URL` ou as mesmas variáveis usadas no projeto KSB:

- `DB_HOST`
- `DB_PORT` (padrão `5432`)
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSLMODE` (padrão `require`)

Também são obrigatórias:

- `APP_ENCRYPTION_KEY`: chave Base64 de 32 bytes usada pelo AES-256-GCM. Gere com `openssl rand -base64 32`.
- `APP_SETUP_TOKEN`: segredo de uso único para criar o primeiro administrador. Gere outro valor com `openssl rand -base64 32`.
- `COOKIE_SECURE`: mantenha `true` no Render; use `false` somente no desenvolvimento local sem HTTPS.

No primeiro acesso, a tela solicitará `APP_SETUP_TOKEN`, nome, e-mail e uma senha de no mínimo 12 caracteres. Depois da criação, o formulário muda automaticamente para o login normal de administrador.

Nunca salve as chaves em arquivos versionados. Mantenha uma cópia segura de `APP_ENCRYPTION_KEY`: sem ela, os lançamentos e documentos criptografados não podem ser recuperados.

## Render

O deploy deve utilizar o runtime **Docker**, com o `Dockerfile` da raiz. O endpoint de saúde é `/api/health`. As variáveis opcionais são:

- `OCR_MAX_FILE_MB`: tamanho máximo do documento, padrão 15.
- `OCR_MAX_PAGES`: máximo de páginas analisadas, padrão 5.
- `ENABLE_API_DOCS`: use `true` apenas quando quiser habilitar `/api/docs`.
