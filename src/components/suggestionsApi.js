/*
 * Cliente del backend de sugerencias del hub ("Sugerí una mejora").
 *
 * Le pega al mismo backend compartido que el Buscador de artworks (ver
 * server/artwork-finder). Guardar ahí en vez de en localStorage es lo que
 * hace que las sugerencias sean visibles para todos los visitantes, no solo
 * en el navegador de quien la escribió.
 */
import { HUB_API_BASE } from '../lib/hubApiBase.js'

export class SuggestionsApiError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code // 'network' | 'http'
  }
}

async function request(path, options) {
  let resp
  try {
    resp = await fetch(`${HUB_API_BASE}${path}`, options)
  } catch {
    throw new SuggestionsApiError('No se pudo conectar con el servidor.', 'network')
  }
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new SuggestionsApiError(data.error || 'Ocurrió un error.', 'http')
  return data
}

/** Todas las sugerencias guardadas, más nueva primero: `{ sugerencias: [...] }`. */
export function fetchSuggestions() {
  return request('/api/sugerencias')
}

/** Guarda una sugerencia nueva. Devuelve `{ ok, sugerencia }`. */
export function postSuggestion({ name, message }) {
  return request('/api/sugerencias', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, message }),
  })
}
