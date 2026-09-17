/*
 * Cliente del backend del Buscador de artworks.
 *
 * La herramienta NO habla directo con gestion.liliana.com.ar (CORS + cookie de
 * sesión lo impiden): le pega a nuestro backend proxy (ver server/artwork-finder),
 * el mismo backend compartido que usan las sugerencias del hub.
 */
import { HUB_API_BASE, isHubApiConfigured } from '../../lib/hubApiBase.js'

const API_BASE = HUB_API_BASE

/** ¿Está configurada explícitamente la URL del backend? (para avisos en prod). */
export const isApiConfigured = isHubApiConfigured

/** Código de artículo: mismo criterio que valida el backend. */
export const CODIGO_RE = /^[A-Za-z0-9]{2,15}$/

/** URL proxied de un archivo (imagen/PDF) del sistema interno, vía backend. */
export function artworkFileUrl(url) {
  return url ? `${API_BASE}/api/archivo?url=${encodeURIComponent(url)}` : ''
}

class ApiError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code // 'session' | 'network' | 'http' | 'validation'
  }
}

async function getJson(path) {
  let resp
  try {
    resp = await fetch(`${API_BASE}${path}`)
  } catch {
    throw new ApiError('No se pudo conectar con el servidor del buscador.', 'network')
  }
  const data = await resp.json().catch(() => ({}))
  if (resp.status === 401) throw new ApiError(data.error || 'La sesión expiró.', 'session')
  if (!resp.ok) throw new ApiError(data.error || 'Ocurrió un error al buscar.', 'http')
  return data
}

/** Catálogo de tipos de artwork `{ tipos: [{id,label}], default }`. */
export function fetchTipos() {
  return getJson('/api/tipos')
}

/** Busca `codigo` para `tipo`. Devuelve `{ encontrado, grupos, ultima }`. */
export function buscarArtwork(codigo, tipo) {
  return getJson(`/api/buscar?codigo=${encodeURIComponent(codigo)}&tipo=${encodeURIComponent(tipo)}`)
}

export { ApiError }
