var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var ai = new import_genai.GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
function decodeGmailBody(data) {
  if (!data) return "";
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(base64, "base64").toString("utf8");
  } catch (err) {
    console.error("Error decoding base64 body:", err);
    return "";
  }
}
function getBodyFromParts(parts) {
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return decodeGmailBody(part.body.data);
    }
    if (part.mimeType === "text/html" && part.body?.data) {
      const decodedHtml = decodeGmailBody(part.body.data);
      return decodedHtml.replace(/<[^>]*>/g, " ");
    }
    if (part.parts) {
      const subBody = getBodyFromParts(part.parts);
      if (subBody) return subBody;
    }
  }
  return "";
}
function extractEmailBody(payload) {
  if (!payload) return "";
  if (payload.body?.data) {
    return decodeGmailBody(payload.body.data);
  }
  if (payload.parts) {
    return getBodyFromParts(payload.parts);
  }
  return "";
}
function getHeader(headers, name) {
  const header = headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : "";
}
async function startServer() {
  const app = (0, import_express.default)();
  app.use(import_express.default.json({ limit: "10mb" }));
  const PORT = 3e3;
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app.post("/api/analyze-emails", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }
    const accessToken = authHeader.substring(7);
    try {
      const listResponse = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15",
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error("Gmail List API error:", errorText);
        res.status(listResponse.status).json({
          error: "Failed to fetch list of emails from Gmail API",
          details: errorText
        });
        return;
      }
      const listData = await listResponse.json();
      const messages = listData.messages || [];
      if (messages.length === 0) {
        res.json({
          success: true,
          sectorName: "N\xE3o identificado (Sem e-mails)",
          identifiedServices: [],
          cartaDeServicosHtml: "<h3>Nenhum e-mail encontrado para an\xE1lise.</h3><p>Envie e-mails para sua caixa postal institucional para que possamos catalogar seus servi\xE7os.</p>"
        });
        return;
      }
      const emailDetailPromises = messages.map(async (msg) => {
        try {
          const detailRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            {
              headers: { Authorization: `Bearer ${accessToken}` }
            }
          );
          if (!detailRes.ok) return null;
          const detail = await detailRes.json();
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
            body: body.substring(0, 2e3)
            // Trim individual body to prevent massive prompt sizes
          };
        } catch (err) {
          console.error(`Error fetching detail for message ${msg.id}:`, err);
          return null;
        }
      });
      const emails = (await Promise.all(emailDetailPromises)).filter(
        (e) => e !== null
      );
      const prompt = `Voc\xEA \xE9 um consultor organizacional especializado na administra\xE7\xE3o p\xFAblica e corporativa brasileira.
Seu objetivo \xE9 analisar as comunica\xE7\xF5es por e-mail enviadas/recebidas por um setor institucional para mapear e entender quais servi\xE7os s\xE3o realmente realizados por este setor.
Com base nessa an\xE1lise, voc\xEA elaborar\xE1 uma proposta oficial de "Carta de Servi\xE7os do Setor" em formato estruturado (JSON), em Portugu\xEAs do Brasil.

Aqui est\xE1 o conjunto de e-mails institucionais recentes coletados:
${JSON.stringify(emails, null, 2)}

Sua resposta DEVE preencher rigorosamente o seguinte formato JSON:
- "sectorName": O nome prov\xE1vel ou inferido do setor/departamento (ex: Coordena\xE7\xE3o de Ensino, Secretaria Acad\xEAmica, TI, Recursos Humanos).
- "identifiedServices": Uma lista de servi\xE7os mapeados a partir dos e-mails. Cada servi\xE7o DEVE conter:
  - "name": Nome claro e direto do servi\xE7o.
  - "description": Descri\xE7\xE3o simples de qual tarefa/servi\xE7o \xE9 prestado.
  - "audience": Quem solicita ou quem se beneficia (ex: Estudantes, Professores, Comunidade Externa).
  - "requirements": O que \xE9 necess\xE1rio para solicitar (ex: preenchimento de formul\xE1rio, apresenta\xE7\xE3o de RG, envio de comprovante).
  - "howToRequest": O canal de solicita\xE7\xE3o padr\xE3o (ex: Portal do Aluno, e-mail institucional, formul\xE1rio eletr\xF4nico).
  - "deadline": Prazo m\xE9dio estimado (ex: "At\xE9 3 dias \xFAteis", "Imediato", "Sob demanda").
- "cartaDeServicosHtml": Uma Carta de Servi\xE7os completa, oficial e muito bem formatada utilizando tags de HTML modernas (headings, paragraphs, lists, tables). N\xE3o use tags "html" ou "body" inteiras, apenas a estrutura interna de conte\xFAdo (come\xE7ando direto com headings, divs ou containers elegantes). A Carta deve incluir:
  1. Apresenta\xE7\xE3o e Miss\xE3o do Setor (com base na an\xE1lise do tom e assuntos dos e-mails).
  2. Principais canais de comunica\xE7\xE3o/atendimento.
  3. Cat\xE1logo detalhado de todos os servi\xE7os mapeados (organizados de forma elegante, ex: tabelas ou se\xE7\xF5es bem delineadas).
  4. Compromissos de qualidade e canais de feedback (ouvidoria/sugest\xF5es).

Siga estritamente as regras de retorno de JSON estruturado.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai.Type.OBJECT,
            properties: {
              sectorName: {
                type: import_genai.Type.STRING,
                description: "O nome deduzido do setor analisado."
              },
              identifiedServices: {
                type: import_genai.Type.ARRAY,
                description: "Servi\xE7os identificados com base nas discuss\xF5es por e-mail.",
                items: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    name: { type: import_genai.Type.STRING },
                    description: { type: import_genai.Type.STRING },
                    audience: { type: import_genai.Type.STRING },
                    requirements: { type: import_genai.Type.STRING },
                    howToRequest: { type: import_genai.Type.STRING },
                    deadline: { type: import_genai.Type.STRING }
                  },
                  required: ["name", "description", "audience", "requirements", "howToRequest", "deadline"]
                }
              },
              cartaDeServicosHtml: {
                type: import_genai.Type.STRING,
                description: "Proposta completa da Carta de Servi\xE7os formatada em HTML elegante."
              }
            },
            required: ["sectorName", "identifiedServices", "cartaDeServicosHtml"]
          }
        }
      });
      const responseText = response.text || "{}";
      const resultObj = JSON.parse(responseText);
      res.json({
        success: true,
        ...resultObj
      });
    } catch (err) {
      console.error("Error in analyze-emails route:", err);
      res.status(500).json({
        error: "Ocorreu um erro ao processar e analisar seus e-mails.",
        details: err?.message || err
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express] Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
