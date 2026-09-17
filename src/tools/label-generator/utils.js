/*
 * label-generator — utilidades puras (sin DOM ni estado).
 * Portado de Et.art/v7 (js/utils.js), la fuente de verdad del comportamiento.
 */

/** Normaliza un valor de color de impresión a un hex/rgb usable, o null. */
export function parseImpresionColor(value) {
  if (!value) return null
  const v = String(value).trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v
  if (/^rgb/.test(v)) return v
  const MAP = {
    negro: '#000000',
    black: '#000000',
    blanco: '#ffffff',
    white: '#ffffff',
    rojo: '#cc0000',
    red: '#cc0000',
    azul: '#003da5',
    blue: '#003da5',
    verde: '#008000',
    green: '#008000',
    cyan: '#29abe2',
    celeste: '#29abe2',
    gris: '#888888',
    gray: '#888888',
    grey: '#888888',
    naranja: '#ff6600',
    orange: '#ff6600',
    amarillo: '#ffcc00',
    yellow: '#ffcc00',
    'pantone 286': '#003da5',
    'pantone 485': '#da291c',
    'pantone 032': '#ef3340',
    'pantone 300': '#005eb8',
    'pantone 116': '#ffc82e',
    'pantone 361': '#43b02a',
  }
  return MAP[v.toLowerCase()] || null
}

export function formatVersion(v) {
  const n = parseInt(v, 10)
  return isNaN(n) ? '0' : String(n)
}

/** Nombre de archivo del export (sin extensión). */
export function buildFilename(data) {
  const imported = parseBool(data.modoImportado)
  return imported
    ? `${data.articulo}_Et-articulo_v${formatVersion(data.version)}`
    : `${data.articulo}_Et-articulo-${data.codigo}_v${formatVersion(data.version)}`
}

export function parseBool(v) {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim()
    return s === 'si' || s === 'sí' || s === 'yes' || s === '1' || s === 'importado'
  }
  return Boolean(v)
}

export function parseDimensions(str) {
  if (!str) return null
  const m = String(str).match(/(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)/)
  if (m) return { w: parseFloat(m[1]), h: parseFloat(m[2]) }
  return null
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/**
 * Formatea un rango "mín-máx" para las specs eléctricas.
 *
 * Hay productos de tensión o frecuencia única (ej. ventiladores de 220 V). En
 * esos casos el máximo va vacío y NO debe quedar un guion colgado ("220- V"):
 * la etiqueta tiene que decir "220 V". Lo mismo si máx == mín ("220-220 V").
 */
export function formatRange(min, max) {
  const a = String(min ?? '').trim()
  const b = String(max ?? '').trim()
  if (!a) return b
  if (!b || a === b) return a
  return `${a}-${b}`
}

/** Líneas de specs eléctricas (nacional / importado), igual que el original. */
export function buildElectricosNacional(d) {
  return `${formatRange(d.voltMin, d.voltMax)} V ~ ${formatRange(d.hzMin, d.hzMax)} Hz  ${d.potencia} W`
}
export function buildElectricosImportado(d) {
  return `${formatRange(d.voltMin, d.voltMax)}V ~ ${formatRange(d.hzMin, d.hzMax)} Hz - ${d.potencia}W`
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

/** XML-escape para inyectar texto en el SVG generado. */
export function escXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Valida los datos de una etiqueta. Devuelve un array de mensajes de error
 * (vacío = válida). Compartido por el modo individual y el lote (por fila).
 */
export function validateLabelData(d) {
  const errors = []
  const imported = parseBool(d.modoImportado)
  if (!String(d.articulo || '').trim()) errors.push('Falta el artículo')
  if (!String(d.descripcion || '').trim()) errors.push('Falta la descripción')
  if (!imported && !String(d.codigo || '').trim()) errors.push('Falta el código de insumo')
  const w = parseFloat(d.ancho)
  const h = parseFloat(d.alto)
  if (!(w > 0 && w <= 500)) errors.push('Ancho inválido (1–500 mm)')
  if (!(h > 0 && h <= 500)) errors.push('Alto inválido (1–500 mm)')
  return errors
}
