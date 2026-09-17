/** Dispara la descarga de un Blob con el nombre de archivo dado. */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Minúsculas, sin acentos, sin espacios de más — para matchear encabezados con criterio laxo. */
function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Clasifica un encabezado de columna de la plantilla de entrada.
 * Laxo a propósito: acepta "Código"/"codigo", "Desc."/"Descripción", etc.
 */
export function classifyHeader(raw) {
  const h = normalize(raw)
  if (!h) return null
  if (h.includes('codigo')) return 'code'
  if (h.startsWith('desc')) return 'description'
  if (h.includes('fabricante')) return 'mfgNumber'
  return null
}

export const FIELD_LABELS = {
  code: 'Código',
  description: 'Desc.',
  mfgNumber: 'N° de Fabricante',
}

/**
 * Código de input → nombre de hoja: saca una única "Z" inicial (may. o min.)
 * si existe, y sanitiza caracteres inválidos para nombres de hoja de Excel
 * (\ / ? * [ ] :), truncando al límite de 31 caracteres.
 */
export function codeToSheetName(code) {
  const stripped = String(code).replace(/^Z/i, '')
  const safe = stripped.replace(/[\\/?*[\]:]/g, '-').trim()
  return (safe || String(code)).slice(0, 31)
}
