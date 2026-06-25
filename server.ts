import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini client on the server
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper functions to parse Gmail API payloads
function decodeGmailBody(data: string): string {
  if (!data) return "";
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(base64, "base64").toString("utf8");
  } catch (err) {
    console.error("Error decoding base64 body:", err);
    return "";
  }
}

interface GmailPart {
  mimeType: string;
  body?: {
    data?: string;
  };
  parts?: GmailPart[];
}

function getBodyFromParts(parts: GmailPart[]): string {
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return decodeGmailBody(part.body.data);
    }
    if (part.mimeType === "text/html" && part.body?.data) {
      const decodedHtml = decodeGmailBody(part.body.data);
      // Simple tag stripper to get clean text and save prompt tokens
      return decodedHtml.replace(/<[^>]*>/g, " ");
    }
    if (part.parts) {
      const subBody = getBodyFromParts(part.parts);
      if (subBody) return subBody;
    }
  }
  return "";
}

function extractEmailBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) {
    return decodeGmailBody(payload.body.data);
  }
  if (payload.parts) {
    return getBodyFromParts(payload.parts);
  }
  return "";
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  const header = headers?.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : "";
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  const PORT = 3000;

  // 1. Health check route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 2. Email parsing and service analysis endpoint
  app.post("/api/analyze-emails", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }

    const accessToken = authHeader.substring(7);

    try {
      // Step A: List latest messages from authenticated user
      const listResponse = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error("Gmail List API error:", errorText);
        res.status(listResponse.status).json({
          error: "Failed to fetch list of emails from Gmail API",
          details: errorText,
        });
        return;
      }

      const listData = (await listResponse.json()) as { messages?: { id: string }[] };
      const messages = listData.messages || [];

      if (messages.length === 0) {
        res.json({
          success: true,
          sectorName: "Não identificado (Sem e-mails)",
          identifiedServices: [],
          cartaDeServicosHtml: "<h3>Nenhum e-mail encontrado para análise.</h3><p>Envie e-mails para sua caixa postal institucional para que possamos catalogar seus serviços.</p>",
        });
        return;
      }

      // Step B: Fetch details for each message in parallel
      const emailDetailPromises = messages.map(async (msg) => {
        try {
          const detailRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          if (!detailRes.ok) return null;
          
          const detail = await detailRes.json() as any;
          const headers = detail.payload?.headers || [];
          const subject = getHeader(headers, "subject");
          const from = getHeader(headers, "from");
          const date = getHeader(headers, "date");
          const body = extractEmailBody(detail.payload);
          const snippet = detail.snippet || "";

          return {
            id: msg.id,
            from,
            subject,
            date,
            snippet,
            body: body.substring(0, 2000), // Trim individual body to prevent massive prompt sizes
          };
        } catch (err) {
          console.error(`Error fetching detail for message ${msg.id}:`, err);
          return null;
        }
      });

      const emails = (await Promise.all(emailDetailPromises)).filter(
        (e): e is NonNullable<typeof e> => e !== null
      );

      // Step C: Trigger Gemini to analyze emails and produce the structured Carta de Serviços
      const prompt = `Você é um consultor organizacional especializado na administração pública e corporativa brasileira.
Seu objetivo é analisar as comunicações por e-mail enviadas/recebidas por um setor institucional para mapear e entender quais serviços são realmente realizados por este setor.
Com base nessa análise, você elaborará uma proposta oficial de "Carta de Serviços do Setor" em formato estruturado (JSON), em Português do Brasil.

Aqui está o conjunto de e-mails institucionais recentes coletados:
${JSON.stringify(emails, null, 2)}

Sua resposta DEVE preencher rigorosamente o seguinte formato JSON:
- "sectorName": O nome provável ou inferido do setor/departamento (ex: Coordenação de Ensino, Secretaria Acadêmica, TI, Recursos Humanos).
- "identifiedServices": Uma lista de serviços mapeados a partir dos e-mails. Cada serviço DEVE conter:
  - "name": Nome claro e direto do serviço.
  - "description": Descrição simples de qual tarefa/serviço é prestado.
  - "audience": Quem solicita ou quem se beneficia (ex: Estudantes, Professores, Comunidade Externa).
  - "requirements": O que é necessário para solicitar (ex: preenchimento de formulário, apresentação de RG, envio de comprovante).
  - "howToRequest": O canal de solicitação padrão (ex: Portal do Aluno, e-mail institucional, formulário eletrônico).
  - "deadline": Prazo médio estimado (ex: "Até 3 dias úteis", "Imediato", "Sob demanda").
- "cartaDeServicosHtml": Uma Carta de Serviços completa, oficial e muito bem formatada utilizando tags de HTML modernas (headings, paragraphs, lists, tables). Não use tags "html" ou "body" inteiras, apenas a estrutura interna de conteúdo (começando direto com headings, divs ou containers elegantes). A Carta deve incluir:
  1. Apresentação e Missão do Setor (com base na análise do tom e assuntos dos e-mails).
  2. Principais canais de comunicação/atendimento.
  3. Catálogo detalhado de todos os serviços mapeados (organizados de forma elegante, ex: tabelas ou seções bem delineadas).
  4. Compromissos de qualidade e canais de feedback (ouvidoria/sugestões).

Siga estritamente as regras de retorno de JSON estruturado.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sectorName: {
                type: Type.STRING,
                description: "O nome deduzido do setor analisado.",
              },
              identifiedServices: {
                type: Type.ARRAY,
                description: "Serviços identificados com base nas discussões por e-mail.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    audience: { type: Type.STRING },
                    requirements: { type: Type.STRING },
                    howToRequest: { type: Type.STRING },
                    deadline: { type: Type.STRING },
                  },
                  required: ["name", "description", "audience", "requirements", "howToRequest", "deadline"],
                },
              },
              cartaDeServicosHtml: {
                type: Type.STRING,
                description: "Proposta completa da Carta de Serviços formatada em HTML elegante.",
              },
            },
            required: ["sectorName", "identifiedServices", "cartaDeServicosHtml"],
          },
        },
      });

      const responseText = response.text || "{}";
      const resultObj = JSON.parse(responseText);

      res.json({
        success: true,
        ...resultObj,
      });
    } catch (err: any) {
      console.error("Error in analyze-emails route:", err);
      res.status(500).json({
        error: "Ocorreu um erro ao processar e analisar seus e-mails.",
        details: err?.message || err,
      });
    }
  });

  // 3. Mount Vite middleware in development, serve static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
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
    console.log(`[Express] Server running on http://localhost:${PORT}`);
  });
}

startServer();
