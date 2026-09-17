/*
 * warranty-generator — utilidades puras (sin DOM ni estado).
 */

export function formatVersion(v) {
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? '0' : String(n)
}

/** Fecha de hoy en formato DD/MM/AAAA (no editable por el usuario). */
export function formatTodayDDMMYYYY() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

/** Nombre de archivo del PDF (sin extensión), igual convención que los ejemplos de referencia. */
export function buildFilename({ articulo, version }) {
  return `${articulo}_WarrantyCard_v${formatVersion(version)}-Print`
}

/** Descarga un Blob como archivo. */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 1000)
}

/** Valida los datos de la garantía. Devuelve un array de mensajes de error (vacío = válida). */
export function validateWarrantyData(d) {
  const errors = []
  if (!String(d.articulo || '').trim()) errors.push('Falta el artículo')
  if (!String(d.descripcion || '').trim()) errors.push('Falta la descripción')
  return errors
}
