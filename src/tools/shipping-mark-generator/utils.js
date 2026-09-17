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
 * Código de input → nombre de hoja: el código tal cual lo tipeó el ingeniero
 * (mismo criterio que el título de la etiqueta, sin sacar ninguna "Z"),
 * sanitizando caracteres inválidos para nombres de hoja de Excel
 * (\ / ? * [ ] :) y truncando al límite de 31 caracteres.
 */
export function codeToSheetName(code) {
  const safe = String(code).replace(/[\\/?*[\]:]/g, '-').trim()
  return (safe || String(code)).slice(0, 31)
}

/**
 * Clave de comparación para detectar duplicados: saca todas las "Z"/"z"
 * iniciales (una o más) y pasa a mayúsculas. Así "ZHE1001" y "ZZHE1001" se
 * siguen marcando como el mismo insumo (probable error de tipeo de cuántas
 * Z lleva), aunque el nombre de hoja de cada uno respete lo tipeado tal cual.
 */
export function codeDedupeKey(code) {
  return String(code).replace(/^Z+/i, '').toUpperCase()
}

/**
 * Nombre del archivo de salida: "Shipping-Mark_YYYY-MM-DD.xlsx" (fecha de
 * hoy). Aislado en su propia función porque el formato todavía puede
 * cambiar (a definir con el ingeniero real).
 */
export function buildOutputFilename() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `Shipping-Mark_${stamp}.xlsx`
}
