const BASE_URL = "https://gestion.liliana.com.ar";
const ADMIN = `${BASE_URL}/administracion`;
const FILES_HOST = "gestion.liliana.com.ar";

export class SessionExpiredError extends Error {
  constructor() {
    super("La sesión de gestion.liliana.com.ar expiró o no es válida.");
    this.name = "SessionExpiredError";
  }
}

function looksLoggedOut(finalUrl, body) {
  if (finalUrl.includes("Login.php")) return true;
  if (/name=["']?password["']?/i.test(body) && /Usuario/i.test(body)) return true;
  return false;
}

async function fetchAuthenticated(url, phpSessId) {
  const resp = await fetch(url, {
    headers: {
      Cookie: `PHPSESSID=${phpSessId}`,
      Referer: `${ADMIN}/Menu.php`,
    },
    redirect: "follow",
  });
  const body = await resp.text();
  if (looksLoggedOut(resp.url, body)) {
    throw new SessionExpiredError();
  }
  return body;
}

/** Busca en una página de listado (Etiquetas.php, Dm.php, Dg.php, Dg_Cajas.php...). */
export function buscarEnEndpoint(endpoint, codigo, phpSessId) {
  const url = `${ADMIN}/${endpoint}?find=${encodeURIComponent(codigo)}&linea=0&marca=0&estado=0`;
  return fetchAuthenticated(url, phpSessId);
}

/** Trae el detalle de un producto por su ID interno (Articulo.php?ID=...). */
export function traerArticulo(id, phpSessId) {
  return fetchAuthenticated(`${ADMIN}/Articulo.php?ID=${encodeURIComponent(id)}`, phpSessId);
}

/**
 * Descarga un archivo (imagen o PDF) del dominio autenticado, para servirlo
 * proxied al frontend sin exponer la cookie de sesión al navegador.
 */
export async function descargarArchivo(fileUrl, phpSessId) {
  const parsed = new URL(fileUrl);
  if (parsed.hostname !== FILES_HOST) {
    throw new Error("Host no permitido");
  }
  const resp = await fetch(parsed.toString(), {
    headers: {
      Cookie: `PHPSESSID=${phpSessId}`,
      Referer: `${ADMIN}/Menu.php`,
    },
  });
  if (!resp.ok) {
    throw new Error(`No se pudo descargar el archivo (status ${resp.status})`);
  }
  return {
    contentType: resp.headers.get("content-type") || "application/octet-stream",
    buffer: Buffer.from(await resp.arrayBuffer()),
  };
}
