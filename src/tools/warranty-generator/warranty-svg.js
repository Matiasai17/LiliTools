/*
 * warranty-generator — combina la plantilla vectorizada (templates/) con los
 * 3 campos dinámicos (Artículo, Descripción, pie de página) y el QR del
 * manual, insertando todo como trazos reales (<path>), nunca <text>.
 *
 * Las plantillas ya vienen 100% vectorizadas por un script offline (ver el
 * plan de esta herramienta) salvo 3 nodos <text> chicos que sirven de marca
 * de posición ({{ARTICULO}}, {{DESCRIPCION}}, {{FOOTER}}) y la caja blanca
 * del QR (sin contenido: el texto placeholder "QR-XXXX" ya fue removido).
 */
import QRCode from 'qrcode'
import backTemplate from './templates/warranty-back.svg?raw'
import frontTemplate from './templates/warranty-front.svg?raw'
import { formatTodayDDMMYYYY, formatVersion } from './utils.js'

// Tamaño físico de ambas páginas (viewBox de las plantillas), en pt (1 unidad = 1pt = 1/72").
export const PAGE_W = 255.12
export const PAGE_H = 538.58

// Borde derecho de las cajas que contienen cada campo (misma referencia que
// usan los bordes redondeados de la plantilla), para condensar si el texto
// real (con Arimo, más ancho que la fuente original a igual tamaño) no entra.
const BOX_RIGHT = 238 // caja del pie de página
const FIT_X_MIN = 0.55 // piso de condensado horizontal (igual criterio que label-generator)
const PRODUCT_GROUP_X = 83.57
const PRODUCT_CENTER_LOCAL = PAGE_W / 2 - PRODUCT_GROUP_X
const PRODUCT_TEXT_AVAIL = PAGE_W - 22.47 * 2 // ancho de la caja con margen simetrico

// Caja "ARTICULO / MODELO:" (path de fondo: x 22.47 a 237.97 aprox., ver
// templates/warranty-front.svg). Artículo y Descripción van centrados en su
// ancho, en coordenadas locales del grupo translate(83.57 89.69).
const ARTICULO_BOX_CENTER_LOCAL = (22.47 + 237.97) / 2 - 83.57 // ≈ 46.65
const ARTICULO_BOX_AVAIL = 237.97 - 22.47 - 8 // ancho de la caja con un margen chico

// Posición/estilo de los 3 campos dinámicos, tal como quedaron en la
// plantilla (mismo transform que en el SVG original de Illustrator).
const ARTICULO = {
  groupTransform: 'translate(83.57 89.69)',
  y: 0,
  fontSize: 25,
  bold: true,
  fill: '#e1261d',
  center: true,
  centerX: PRODUCT_CENTER_LOCAL,
  avail: PRODUCT_TEXT_AVAIL,
}
const DESCRIPCION = {
  groupTransform: 'translate(83.57 89.69)',
  y: 14,
  fontSize: 12,
  bold: false,
  fill: '#1d1d1b',
  center: true,
  centerX: PRODUCT_CENTER_LOCAL,
  avail: PRODUCT_TEXT_AVAIL,
  lineHeight: 11,
  maxLines: 2,
}
const FOOTER = {
  groupTransform: 'translate(149.33 448.12)',
  x: 0,
  y: 0,
  fontSize: 7,
  bold: false,
  fill: '#e1261d',
  avail: BOX_RIGHT - 149.33,
}

// Caja blanca del QR "MANUAL DE INSTRUCCIONES" (rect x=171 y=141.23 w=67.07 h=65.94 en la plantilla).
const QR_BOX = { x: 171, y: 141.23, w: 67.07, h: 65.94 }
const QR_INSET = 4
const QR_MARGIN = 1 // zona de silencio del QR (módulos)

const QR_MANUAL_BASE_URL = 'https://gestion.liliana.com.ar/r/MiWeb/'

/** Ancho natural de `text` a `fontSize`, sin generar paths (para decidir si condensar). */
function measureWidth(font, text, fontSize) {
  let w = 0
  for (const ch of String(text)) w += (font.charToGlyph(ch).advanceWidth / font.unitsPerEm) * fontSize
  return w
}

/** Path 'd' de un texto corto (una línea, sin letter-spacing extra), con Arimo. */
function buildTextPath(font, text, x, y, fontSize) {
  let curX = x
  const parts = []
  for (const ch of String(text)) {
    if (ch !== ' ') parts.push(font.getPath(ch, curX, y, fontSize).toPathData(2))
    curX += (font.charToGlyph(ch).advanceWidth / font.unitsPerEm) * fontSize
  }
  return parts.filter(Boolean).join(' ')
}

function wrapLines(font, text, fontSize, maxWidth, maxLines = 1) {
  const words = String(text).trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ['']

  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && measureWidth(font, candidate, fontSize) > maxWidth && lines.length < maxLines - 1) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, maxLines)
}

/**
 * Trazos de `text` según `spec`, condensado horizontalmente si no entra en
 * `spec.avail` (mismo criterio que label-svg.js: condensa hasta el piso
 * FIT_X_MIN, y si no alcanza, reduce el font-size además). Si `spec.center`,
 * se centra en `spec.centerX` en vez de anclarse a la izquierda en `spec.x`.
 */
function outlinedGroup(font, spec, text) {
  const naturalAtBase = measureWidth(font, text, spec.fontSize)
  let fontSize = spec.fontSize
  let fx = 1
  if (spec.avail && naturalAtBase > spec.avail && naturalAtBase > 0) {
    fx = spec.avail / naturalAtBase
    if (fx < FIT_X_MIN) {
      fontSize = spec.fontSize * (spec.avail / (naturalAtBase * FIT_X_MIN))
      fx = FIT_X_MIN
    }
  }
  const naturalAtFinal = fontSize === spec.fontSize ? naturalAtBase : measureWidth(font, text, fontSize)
  const displayWidth = naturalAtFinal * fx
  const startX = spec.center ? spec.centerX - displayWidth / 2 : spec.x

  const d = buildTextPath(font, text, startX, spec.y, fontSize)
  const condense = fx !== 1 ? ` transform="matrix(${fx.toFixed(4)} 0 0 1 ${(startX * (1 - fx)).toFixed(4)} 0)"` : ''
  return `<g transform="${spec.groupTransform}"><path d="${d}" fill="${spec.fill}"${condense}/></g>`
}

/** QR "solo" (igual filosofía que qr-generator), como <svg> anidado dentro de la caja del manual. */
function outlinedParagraphGroup(font, spec, text) {
  const lines = wrapLines(font, text, spec.fontSize, spec.avail, spec.maxLines)
  return lines
    .map((line, index) =>
      outlinedGroup(
        font,
        {
          ...spec,
          y: spec.y + index * (spec.lineHeight || spec.fontSize * 1.15),
        },
        line,
      ),
    )
    .join('')
}

// Al imprimir en imprenta, un <path> con un rectángulo cerrado por módulo (miles
// de subtrazos separados) puede salir mal convertido a PDF: los módulos se ven
// como puntos sueltos en vez de cuadrados sólidos. Para evitarlo, generamos un
// único trazo por corrida horizontal de módulos negros contiguos (igual criterio
// que el renderer SVG oficial de la librería `qrcode`), con un pequeño solape
// (QR_OVERLAP) entre módulos para que no quede ninguna línea blanca de por medio.
const QR_OVERLAP = 0.02

function buildManualQrPath(modules, qx, qy, unit) {
  const size = modules.size
  const parts = []

  for (let row = 0; row < size; row += 1) {
    let runStart = -1
    for (let col = 0; col <= size; col += 1) {
      const on = col < size && modules.get(row, col)
      if (on && runStart === -1) runStart = col
      if (!on && runStart !== -1) {
        const x = qx + (runStart + QR_MARGIN) * unit - QR_OVERLAP
        const y = qy + (row + QR_MARGIN) * unit - QR_OVERLAP
        const w = (col - runStart) * unit + QR_OVERLAP * 2
        const h = unit + QR_OVERLAP * 2
        parts.push(`M${x.toFixed(3)} ${y.toFixed(3)}h${w.toFixed(3)}v${h.toFixed(3)}h-${w.toFixed(3)}z`)
        runStart = -1
      }
    }
  }

  return parts.join(' ')
}

async function buildManualQrTag(articulo) {
  const url = `${QR_MANUAL_BASE_URL}${encodeURIComponent(articulo)}`
  const qr = QRCode.create(url, {
    errorCorrectionLevel: 'H',
  })
  const side = Math.min(QR_BOX.w, QR_BOX.h) - QR_INSET * 2
  const qx = QR_BOX.x + (QR_BOX.w - side) / 2
  const qy = QR_BOX.y + (QR_BOX.h - side) / 2
  const modules = qr.modules
  const count = modules.size + QR_MARGIN * 2
  const unit = side / count
  const d = buildManualQrPath(modules, qx, qy, unit)

  return [
    '<g id="manual-qr">',
    `<rect x="${qx.toFixed(2)}" y="${qy.toFixed(2)}" width="${side.toFixed(2)}" height="${side.toFixed(2)}" fill="#ffffff"/>`,
    `<path d="${d}" fill="#000000" fill-rule="nonzero"/>`,
    '</g>',
  ].join('')
}

/**
 * Arma la página 2 (frente) como SVG string, con Artículo/Descripción/pie ya
 * en trazos y el QR del manual insertado. `fonts` = loadWarrantyFonts().
 */
export async function buildWarrantyFrontSvg(data, fonts) {
  const font = (bold) => (bold ? fonts.bold : fonts.regular)
  const version = formatVersion(data.version)
  const footerText = `Garantía ${data.articulo} . v${version} - ${formatTodayDDMMYYYY()}`

  let svg = frontTemplate
  svg = svg.replace(
    /<text[^>]*><tspan class="st14"><tspan x="0" y="0">\{\{ARTICULO\}\}<\/tspan><\/tspan><tspan class="st6"><tspan x="24\.56" y="14">\{\{DESCRIPCION\}\}<\/tspan><\/tspan><\/text>/,
    outlinedGroup(font(ARTICULO.bold), ARTICULO, data.articulo) +
      outlinedParagraphGroup(font(DESCRIPCION.bold), DESCRIPCION, data.descripcion),
  )
  svg = svg.replace(
    /<text[^>]*><tspan x="0" y="0">\{\{FOOTER\}\}<\/tspan><\/text>/,
    outlinedGroup(font(FOOTER.bold), FOOTER, footerText),
  )

  const qrTag = await buildManualQrTag(data.articulo)
  svg = svg.replace(/<\/svg>\s*$/, `${qrTag}</svg>`)

  return svg
}

/** Página 1 (reverso): 100% estática, se usa tal cual. */
export function buildWarrantyBackSvg() {
  return backTemplate
}
