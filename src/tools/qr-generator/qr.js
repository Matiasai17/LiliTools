import QRCode from 'qrcode'

// Contenedores oficiales (gráficas de caja) embebidos como texto SVG.
// La herramienta queda autocontenida: no depende de assets externos en runtime.
import contSvg from './containers/cont.svg?raw'
import recetarioSvg from './containers/recetario.svg?raw'

/*
 * Helpers de generación de QR (client-side, sin backend).
 *
 * Salida en 3 formatos (ver FORMATS):
 *   - 'plain'      → QR solo (sin contenedor).
 *   - 'container'  → QR dentro del contenedor "sin recetario" (QR-MI-cont).
 *   - 'recipe'     → QR dentro del contenedor "con recetario" (QR-MI+Recetario).
 *
 * El QR se inserta centrado en el recuadro blanco de cada contenedor. SVG queda
 * vectorial (ideal para impresión); el PNG se rasteriza a una resolución fija alta.
 */

export const ERROR_LEVELS = [
  { value: 'L', label: 'L · Baja (~7%)' },
  { value: 'M', label: 'M · Media (~15%)' },
  { value: 'Q', label: 'Q · Alta (~25%)' },
  { value: 'H', label: 'H · Máxima (~30%)' },
]

const COLORS = { dark: '#000000', light: '#ffffff' }
const MARGIN = 4 // zona de silencio del QR (módulos), estándar

// Aire entre el QR y el marco redondeado del recuadro (unidades del viewBox del contenedor).
const QR_INSET = 3.5

// Resoluciones de export PNG (fijas, aptas para impresión).
const PLAIN_PNG_SIZE = 1024 // px (cuadrado)
const CONTAINER_PNG_WIDTH = 2400 // px de ancho; el alto sale del aspecto del contenedor

// viewBox de los contenedores (ambos comparten el mismo lienzo).
const CONTAINER_ASPECT = 212.5 / 113.45

/*
 * Metadata de cada formato.
 * `box` = recuadro blanco donde va el QR, leído del placeholder de cada SVG.
 * `fileSuffix` = sufijo del nombre de archivo descargado.
 */
export const FORMATS = [
  {
    id: 'container',
    label: 'Con contenedor',
    hint: 'Caja, sin recetario',
    fileSuffix: '_QR-MI-cont',
    container: contSvg,
    box: { x: 16.28, y: 12.69, w: 86.93, h: 87.27 },
    aspect: CONTAINER_ASPECT,
  },
  {
    id: 'recipe',
    label: 'Con recetario',
    hint: 'Caja + recetario',
    fileSuffix: '_QR-MI+Recetario',
    container: recetarioSvg,
    box: { x: 16.28, y: 13.14, w: 86.93, h: 87.27 },
    aspect: CONTAINER_ASPECT,
  },
  {
    id: 'plain',
    label: 'QR solo',
    hint: 'Sin contenedor',
    fileSuffix: '_QR-MI',
    container: null,
    box: null,
    aspect: 1,
  },
]

export const DEFAULT_FORMAT_ID = 'container'

export function getFormat(id) {
  return FORMATS.find((f) => f.id === id) || FORMATS[0]
}

/** QR "pelado" como string SVG (con viewBox, sin width/height → fácil de anidar). */
export function buildQrSvg(text, { errorCorrectionLevel = 'H' } = {}) {
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel,
    margin: MARGIN,
    color: COLORS,
  })
}

/** QR solo como data URL PNG. */
export function buildQrPng(text, { errorCorrectionLevel = 'H' } = {}) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel,
    margin: MARGIN,
    width: PLAIN_PNG_SIZE,
    color: COLORS,
  })
}

/**
 * Inserta el QR (string SVG) centrado en el recuadro blanco del contenedor.
 * Devuelve el SVG compuesto (vectorial). Si el formato no tiene contenedor,
 * devuelve el QR tal cual.
 */
export function composeWithContainer(qrSvg, format) {
  if (!format?.container || !format?.box) return qrSvg

  const { x, y, w, h } = format.box
  const side = Math.min(w, h) - QR_INSET * 2
  const qx = x + (w - side) / 2
  const qy = y + (h - side) / 2

  // El QR trae solo viewBox: lo posicionamos y dimensionamos al anidarlo.
  const nested = qrSvg.replace(
    /^<svg /,
    `<svg x="${qx.toFixed(2)}" y="${qy.toFixed(2)}" width="${side.toFixed(2)}" height="${side.toFixed(
      2,
    )}" preserveAspectRatio="xMidYMid meet" `,
  )

  // Va como último elemento → queda por encima del recuadro blanco.
  return format.container.replace(/<\/svg>\s*$/, `${nested}</svg>`)
}

/** SVG (string) → data URI usable como src de <img> o blob. */
export function svgToDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Rasteriza un SVG (string) a PNG (data URL) en el tamaño en px indicado. */
export function svgToPng(svgString, width, height) {
  return new Promise((resolve, reject) => {
    // Forzamos width/height en el root para que la imagen tenga tamaño intrínseco.
    const sized = svgString.replace(/<svg /, `<svg width="${width}" height="${height}" `)
    const blob = new Blob([sized], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo rasterizar el SVG'))
    }
    img.src = url
  })
}

/** PNG (data URL) del formato elegido, partiendo del QR ya generado. */
export async function buildFormatPng(text, qrSvg, format, { errorCorrectionLevel = 'H' } = {}) {
  if (!format?.container) {
    return buildQrPng(text, { errorCorrectionLevel })
  }
  const composed = composeWithContainer(qrSvg, format)
  const width = CONTAINER_PNG_WIDTH
  const height = Math.round(width / format.aspect)
  return svgToPng(composed, width, height)
}
