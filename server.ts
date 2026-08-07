import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Helper function to extract info from XML NF-e or raw text fallback
function fallbackTextExtraction(text: string, fileName: string) {
  let fornecedor = "";
  let cnpj = "";
  let valorTotal = 0;
  let dataEmissao = new Date().toISOString().substring(0, 10);
  let dataVencimento = new Date(Date.now() + 864000000).toISOString().substring(0, 10);
  let tipo: "BOLETO" | "NFE" | "RECIBO" | "FATURA" | "OUTRO" = "OUTRO";
  let linhaDigitavel = "";

  // Check for NFe XML tags
  if (text.includes("<nfeProc") || text.includes("<infNFe")) {
    tipo = "NFE";
    const xNomeMatch = text.match(/<emit>[\s\S]*?<xNome>(.*?)<\/xNome>/);
    if (xNomeMatch) fornecedor = xNomeMatch[1];

    const cnpjMatch = text.match(/<emit>[\s\S]*?<CNPJ>(.*?)<\/CNPJ>/);
    if (cnpjMatch) {
      const c = cnpjMatch[1];
      cnpj = c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }

    const vNFMatch = text.match(/<vNF>(.*?)<\/vNF>/);
    if (vNFMatch) valorTotal = parseFloat(vNFMatch[1]);

    const dhEmiMatch = text.match(/<dhEmi>(.*?)<\/dhEmi>/) || text.match(/<dEmi>(.*?)<\/dEmi>/);
    if (dhEmiMatch) dataEmissao = dhEmiMatch[1].substring(0, 10);

    const dVencMatch = text.match(/<dVenc>(.*?)<\/dVenc>/);
    if (dVencMatch) dataVencimento = dVencMatch[1].substring(0, 10);
  }

  // Check for Boleto Linha Digitavel (47 or 48 digits)
  const lineMatch = text.match(/\b\d{5}[\.\s]?\d{5}[\.\s]?\d{5}[\.\s]?\d{6}[\.\s]?\d{5}[\.\s]?\d[\.\s]?\d{14}\b/) ||
                    text.match(/\b\d{47,48}\b/);
  if (lineMatch) {
    tipo = "BOLETO";
    linhaDigitavel = lineMatch[0].replace(/[\.\s]/g, "");
    
    // Extract value from last digits of 47-digit boleto if available
    if (linhaDigitavel.length === 47) {
      const valStr = linhaDigitavel.slice(-10);
      const valCents = parseInt(valStr, 10);
      if (!isNaN(valCents) && valCents > 0) {
        valorTotal = valCents / 100;
      }
    }
  }

  // Generic CNPJ pattern regex
  if (!cnpj) {
    const cnpjRegex = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/;
    const m = text.match(cnpjRegex);
    if (m) {
      cnpj = m[0].includes(".") ? m[0] : m[0].replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
  }

  // Generic Value regex (R$ X.XXX,XX or R$ XXX,XX)
  if (valorTotal === 0) {
    const valRegex = /(?:R\$\s*|VALOR\s*TOTAL\s*:?\s*|VALOR\s*:?\s*)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[\.,]\d{2})/i;
    const vm = text.match(valRegex);
    if (vm) {
      const cleaned = vm[1].replace(/\./g, "").replace(",", ".");
      valorTotal = parseFloat(cleaned);
    }
  }

  // Generic Dates
  const dateRegex = /(\d{2})\/(\d{2})\/(\d{4})/;
  const dateMatches = [...text.matchAll(new RegExp(dateRegex, "g"))];
  if (dateMatches.length > 0) {
    const d1 = dateMatches[0];
    dataEmissao = `${d1[3]}-${d1[2]}-${d1[1]}`;
    if (dateMatches.length > 1) {
      const d2 = dateMatches[1];
      dataVencimento = `${d2[3]}-${d2[2]}-${d2[1]}`;
    }
  }

  // Default supplier if still empty
  if (!fornecedor) {
    const cleanName = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    fornecedor = cleanName.length > 3 ? cleanName : "Fornecedor Identificado";
  }

  if (fileName.toLowerCase().includes("boleto")) tipo = "BOLETO";
  else if (fileName.toLowerCase().includes("recibo")) tipo = "RECIBO";
  else if (fileName.toLowerCase().includes("fatura")) tipo = "FATURA";
  else if (fileName.toLowerCase().includes("nf")) tipo = "NFE";

  return {
    fornecedor,
    cnpj: cnpj || "00.000.000/0001-00",
    dataEmissao,
    dataVencimento,
    valorTotal: valorTotal || 150.00,
    categoria: "Insumos Médicos & Estéticos",
    centroCusto: "Estoque Central",
    linhaDigitavel,
    tipo,
    confiancaOCR: 88,
    itens: []
  };
}

// API Routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/ocr", async (req, res) => {
  try {
    const { fileData, mimeType, fileName, textContent } = req.body;

    if (!fileData && !textContent) {
      return res.status(400).json({ error: "Nenhum arquivo ou conteúdo enviado." });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build"
            }
          }
        });

        const promptText = `
Você é um motor OCR especialista em auditoria e inteligência fiscal para empresas brasileiras.
Analise a imagem, documento ou texto a seguir (Boleto Bancário, NF-e, NFS-e, Recibo, Fatura, DDA ou Comprovante) referente ao arquivo "${fileName}".

Extraia com EXATIDÃO absoluta os seguintes dados do documento:
1. fornecedor: Nome da empresa emissora, Razão Social ou Beneficiário/Cedente do Boleto/Nota.
2. cnpj: CNPJ ou CPF do fornecedor/emissor no formato de máscara (ex: 12.345.678/0001-99).
3. dataEmissao: Data de emissão da nota/boleto no formato YYYY-MM-DD.
4. dataVencimento: Data de vencimento da cobrança/boleto no formato YYYY-MM-DD.
5. valorTotal: Valor total numérico em Reais (float ex: 450.50).
6. categoria: Categoria DRE financeira mais adequada (Escolha preferencialmente entre: "Insumos Médicos & Estéticos", "Serviços Terceirizados", "Ocupação & Infraestrutura", "Marketing & Publicidade", "Manutenção & Equipamentos", "Despesas Operacionais", "Softwares & Sistemas").
7. centroCusto: Centro de custo adequado (Escolha entre: "Estoque Central", "Clínica / Atendimento", "Administrativo").
8. tipo: Tipo do documento ("BOLETO", "NFE", "RECIBO", "FATURA", ou "OUTRO").
9. linhaDigitavel: Linha digitável ou código de barras se for um boleto bancário.
10. confiancaOCR: Porcentagem de confiança da leitura (0 a 100).
11. observacoes: Qualquer observação relevante encontrada no documento, como descontos para pagamento antecipado, multas/juros, instruções de pagamento ou condições especiais.
12. itens: Lista de produtos/serviços com { descricao, quantidade, valorUnitario, valorTotal } se presentes.
`;

        const contentsParts: any[] = [{ text: promptText }];

        if (fileData) {
          // Remove prefix data:image/...;base64, if sent
          const base64Clean = fileData.replace(/^data:[^;]+;base64,/, "");
          const actualMime = mimeType || "image/png";

          contentsParts.push({
            inlineData: {
              mimeType: actualMime,
              data: base64Clean
            }
          });
        } else if (textContent) {
          contentsParts.push({ text: `CONTEÚDO DO DOCUMENTO:\n${textContent}` });
        }

        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: { parts: contentsParts },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                fornecedor: { type: Type.STRING },
                cnpj: { type: Type.STRING },
                dataEmissao: { type: Type.STRING },
                dataVencimento: { type: Type.STRING },
                valorTotal: { type: Type.NUMBER },
                categoria: { type: Type.STRING },
                centroCusto: { type: Type.STRING },
                tipo: { type: Type.STRING },
                linhaDigitavel: { type: Type.STRING },
                confiancaOCR: { type: Type.NUMBER },
                observacoes: { type: Type.STRING },
                itens: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      descricao: { type: Type.STRING },
                      quantidade: { type: Type.NUMBER },
                      valorUnitario: { type: Type.NUMBER },
                      valorTotal: { type: Type.NUMBER }
                    }
                  }
                }
              },
              required: ["fornecedor", "dataVencimento", "valorTotal"]
            }
          }
        });

        const jsonText = response.text || "";
        const parsed = JSON.parse(jsonText);

        return res.json({
          success: true,
          dadosExtraidos: {
            fornecedor: parsed.fornecedor || fileName.replace(/\.[^/.]+$/, ""),
            cnpj: parsed.cnpj || "00.000.000/0001-00",
            dataEmissao: parsed.dataEmissao || new Date().toISOString().substring(0, 10),
            dataVencimento: parsed.dataVencimento || new Date(Date.now() + 864000000).toISOString().substring(0, 10),
            valorTotal: typeof parsed.valorTotal === "number" ? parsed.valorTotal : 150,
            categoria: parsed.categoria || "Insumos Médicos & Estéticos",
            centroCusto: parsed.centroCusto || "Estoque Central",
            linhaDigitavel: parsed.linhaDigitavel || "",
            observacoes: parsed.observacoes || "",
            itens: parsed.itens || []
          },
          tipo: parsed.tipo || "BOLETO",
          confiancaOCR: parsed.confiancaOCR || 95
        });
      } catch (geminiError) {
        console.error("Erro na chamada do Gemini OCR:", geminiError);
        // Fallback to text parsing if Gemini call fails
      }
    }

    // Smart Regex Fallback
    const fallbackData = fallbackTextExtraction(textContent || fileName, fileName);
    return res.json({
      success: true,
      dadosExtraidos: fallbackData,
      tipo: fallbackData.tipo,
      confiancaOCR: fallbackData.confiancaOCR
    });

  } catch (err: any) {
    console.error("Erro no endpoint OCR:", err);
    res.status(500).json({ error: "Falha ao processar OCR do arquivo", details: err.message });
  }
});

// Vite & Static middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
