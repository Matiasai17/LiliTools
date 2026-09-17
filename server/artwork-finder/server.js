import "dotenv/config";
import express from "express";
import { descargarArchivo, SessionExpiredError } from "./lib/lilianaClient.js";
import { buscar } from "./lib/buscar.js";
import { SOURCES, getSource, DEFAULT_TIPO } from "./lib/sources.js";
import { listSuggestions, addSuggestion } from "./lib/suggestionsStore.js";

/*
 * Backend compartido de LiliTools (hub estático).
 *
 * Es un proceso aparte del hub: agrupa las funcionalidades que no pueden
 * correr 100% en el navegador.
 *
 * 1) "Buscador de artworks": proxy autenticado contra el sistema interno de
 *    Liliana (gestion.liliana.com.ar), que no tiene API pública ni CORS y
 *    exige cookie de sesión (PHPSESSID). La cookie nunca llega al navegador.
 * 2) "Sugerí una mejora": guarda las sugerencias en un archivo compartido
 *    (ver lib/suggestionsStore.js) para que sean visibles para todos los
 *    visitantes del hub, no solo en el navegador de quien la escribió.
 *
 * Config por entorno (ver .env.example):
 *   - PHPSESSID       cookie de sesión ya logueada (obligatoria para el buscador).
 *   - PORT            puerto de escucha (default 3000).
 *   - ALLOWED_ORIGIN  origen(es) del frontend permitidos por CORS, separados
 *                     por coma (ej. https://liliana.com.ar). Vacío = permitir
 *                     cualquiera (cómodo en dev, restringir en producción).
 */

const PORT = process.env.PORT || 3000;
const CODIGO_RE = /^[A-Za-z0-9]{2,15}$/;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();

// CORS: el frontend vive en otro origen (el hub estático). No usamos cookies
// cross-origin (la sesión del buscador es server-side), así que alcanza con
// habilitar GET/POST sin credentials.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.length === 0) {
    res.set("Access-Control-Allow-Origin", "*");
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "10kb" }));

function getPhpSessId() {
  const value = process.env.PHPSESSID;
  if (!value) {
    throw new Error("Falta PHPSESSID. Copiá .env.example a .env y completá la cookie de sesión.");
  }
  return value;
}

// Salud / raíz: útil para chequear que el server está vivo desde el navegador.
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "artwork-finder", tipos: Object.keys(SOURCES) });
});

// Catálogo de tipos de artwork para poblar el selector del frontend.
app.get("/api/tipos", (_req, res) => {
  const tipos = Object.entries(SOURCES).map(([id, s]) => ({ id, label: s.label }));
  res.json({ tipos, default: DEFAULT_TIPO });
});

app.get("/api/buscar", async (req, res) => {
  const codigo = String(req.query.codigo || "").trim().toUpperCase();
  const tipo = String(req.query.tipo || DEFAULT_TIPO).trim();

  if (!CODIGO_RE.test(codigo)) {
    return res.status(400).json({ error: "Código de artículo inválido." });
  }
  if (!getSource(tipo)) {
    return res.status(400).json({ error: "Tipo de artwork inválido." });
  }

  try {
    const phpSessId = getPhpSessId();
    const { grupos, ultima } = await buscar(tipo, codigo, phpSessId);

    if (!grupos || grupos.length === 0) {
      return res.json({ codigo, tipo, encontrado: false, grupos: [], ultima: null });
    }
    return res.json({ codigo, tipo, encontrado: true, grupos, ultima });
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return res.status(401).json({
        error:
          "La sesión expiró. Volvé a loguearte en https://gestion.liliana.com.ar en el navegador, copiá el PHPSESSID actualizado y actualizá la variable de entorno del servidor.",
      });
    }
    console.error(err);
    return res.status(500).json({ error: err.message || "Error inesperado." });
  }
});

app.get("/api/archivo", async (req, res) => {
  const fileUrl = String(req.query.url || "");
  try {
    const phpSessId = getPhpSessId();
    const { contentType, buffer } = await descargarArchivo(fileUrl, phpSessId);
    res.set("Content-Type", contentType);
    res.send(buffer);
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return res.status(401).json({ error: "La sesión expiró." });
    }
    console.error(err);
    res.status(400).json({ error: err.message || "No se pudo obtener el archivo." });
  }
});

// Sugerencias del hub ("Sugerí una mejora"): visibles para todos, no por navegador.
app.get("/api/sugerencias", async (_req, res) => {
  try {
    const sugerencias = await listSuggestions();
    res.json({ sugerencias });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron leer las sugerencias." });
  }
});

app.post("/api/sugerencias", async (req, res) => {
  try {
    const { name, message } = req.body || {};
    const sugerencia = await addSuggestion({ name, message });
    res.status(201).json({ ok: true, sugerencia });
  } catch (err) {
    res.status(400).json({ error: err.message || "No se pudo guardar la sugerencia." });
  }
});

// Body JSON malformado u otros errores no atrapados: responder siempre JSON.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: "Solicitud inválida." });
});

app.listen(PORT, () => {
  console.log(`Backend de LiliTools corriendo en http://localhost:${PORT}`);
});
