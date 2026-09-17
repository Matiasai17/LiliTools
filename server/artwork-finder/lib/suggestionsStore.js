import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Almacenamiento de sugerencias del hub ("Sugerí una mejora"), compartido
 * entre todos los visitantes. Persistido como un archivo JSON en disco: no
 * hace falta una base de datos para el volumen esperado de un formulario
 * interno.
 *
 * OJO — persistencia: en hostings con filesystem efímero (algunos planes
 * gratuitos de Render/Railway/etc.) este archivo puede perderse en cada
 * redeploy. Si eso pasa en la práctica, hay que migrar a un disco persistente
 * o una base de datos real; para el volumen de este formulario no hacía falta
 * de entrada.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "suggestions.json");

const MAX_NAME_LEN = 60;
const MAX_MESSAGE_LEN = 2000;

async function ensureFile() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(FILE)) await writeFile(FILE, "[]", "utf8");
}

/** Todas las sugerencias, más nueva primero. */
export async function listSuggestions() {
  await ensureFile();
  const raw = await readFile(FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Agrega una sugerencia y la devuelve ya guardada. Lanza si el mensaje viene vacío. */
export async function addSuggestion({ name, message }) {
  const trimmedMessage = String(message || "").trim().slice(0, MAX_MESSAGE_LEN);
  if (!trimmedMessage) {
    throw new Error("La sugerencia no puede estar vacía.");
  }
  const trimmedName = String(name || "").trim().slice(0, MAX_NAME_LEN) || "Anónimo";

  const list = await listSuggestions();
  const entry = {
    id: Date.now(),
    name: trimmedName,
    message: trimmedMessage,
    fecha: new Date().toISOString(),
  };
  list.unshift(entry);
  await writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
  return entry;
}
