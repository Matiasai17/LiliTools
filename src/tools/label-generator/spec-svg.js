/*
 * label-generator — construcción VECTORIAL del "rótulo" (panel de specs para
 * imprenta) como SVG. Réplica en mm de SpecPanel.jsx/SpecPanel.module.css,
 * pensada para exportar a PDF en trazos (ver spec-pdf.js) — no para pantalla
 * (eso lo sigue resolviendo el componente React + CSS).
 */
import { COLOR_LABELS, COLOR_LABELS_EN } from './config.js'
import { parseBool, formatVersion } from './utils.js'
import { getPrintRows } from './SpecPanel.jsx'
import { textOp, rawOp, renderOps, svgWrap, measureText, wrapText } from './label-svg.js'

const PT = 25.4 / 72 // mm por punto tipográfico (CSS usa pt para las fuentes del rótulo)
const LINE_H = 1.3

const PANEL_W = 170
const LEFT_W = 62
const RIGHT_W = PANEL_W - LEFT_W
const BORDER_W = 0.4 * PT
const ROW_LABEL_W = 28
const CELL_PAD_X = 2.5
const PAD_LEFT_COL = 4

const CYAN = '#29abe2'
const MAGENTA = '#d4006a'
const DARK_BLUE = '#0d3572'
const HEADER_BG = '#eaf5fc'
const SUBHEADER_BG = '#e8f4fb'
const VERSION_GRAY = '#999999'
const ROWLABEL_GRAY = '#666666'
const PLACEHOLDER_GRAY = '#cccccc'

const F_HEADER = 6.5 * PT
const F_SUBHEADER = 5.5 * PT
const F_ROWLABEL = 6 * PT
const F_VALUE = 6.5 * PT
const F_VERSION = 6 * PT
const F_TITLE = 14 * PT
const F_NAME = 7 * PT

const PAD_HEADER = 1.8
const PAD_SUBHEADER = 1
const PAD_ROW = 1

function rowHeight(fontSizeMm, padMm) {
  return padMm * 2 + fontSizeMm * LINE_H
}

/** Layout puro del rótulo: `{ W, H, ops }`, mismo patrón que layoutLabel (label-svg.js). */
export function layoutSpec(data) {
  const imported = parseBool(data.modoImportado)
  const vNum = formatVersion(data.version)
  const specTitle = imported ? 'Product label' : 'Etiqueta de producto'
  const specHeader = imported ? 'SPECIFICATIONS' : 'ESPECIFICACIONES'
  const subHeader = imported ? 'PRINTING DETAILS' : 'DETALLES DE IMPRENTA'
  const impresionVal = imported
    ? COLOR_LABELS_EN[data.colorImpresion] || data.impresion
    : COLOR_LABELS[data.colorImpresion] || data.impresion
  const rows = getPrintRows(data, imported, impresionVal)

  const headerH = rowHeight(F_HEADER, PAD_HEADER)
  const subheaderH = rowHeight(F_SUBHEADER, PAD_SUBHEADER)
  const dataRowH = rowHeight(F_VALUE, PAD_ROW)
  const H = headerH + subheaderH + rows.length * dataRowH

  const ops = []

  // Marco + separador de columnas.
  ops.push(rawOp(`<rect x="0" y="0" width="${PANEL_W}" height="${H.toFixed(3)}" fill="#ffffff" stroke="${MAGENTA}" stroke-width="${BORDER_W.toFixed(3)}"/>`))
  ops.push(rawOp(`<line x1="${LEFT_W}" y1="0" x2="${LEFT_W}" y2="${H.toFixed(3)}" stroke="${MAGENTA}" stroke-width="${BORDER_W.toFixed(3)}"/>`))

  // Columna izquierda: tipo de producto + Art./descripción.
  let ly = PAD_LEFT_COL
  ops.push(textOp(specTitle, PAD_LEFT_COL, ly, F_TITLE, { color: CYAN }))
  ly += F_TITLE * 1.2 + 3
  const nameLines = wrapText(`Art. ${data.articulo} — ${data.descripcion}`, LEFT_W - 2 * PAD_LEFT_COL, F_NAME, false)
  for (const ln of nameLines) {
    ops.push(textOp(ln, PAD_LEFT_COL, ly, F_NAME, { color: CYAN, avail: LEFT_W - 2 * PAD_LEFT_COL }))
    ly += F_NAME * 1.35
  }

  // Header (SPECIFICATIONS / ESPECIFICACIONES + versión, alineada a la derecha).
  let ty = 0
  ops.push(rawOp(`<rect x="${LEFT_W}" y="0" width="${RIGHT_W}" height="${headerH.toFixed(3)}" fill="${HEADER_BG}"/>`))
  ops.push(textOp(specHeader, LEFT_W + CELL_PAD_X, ty + PAD_HEADER, F_HEADER, { bold: true, color: DARK_BLUE }))
  const vText = `.v${vNum}`
  const vW = measureText(vText, F_VERSION, false)
  ops.push(textOp(vText, PANEL_W - 2 - vW, ty + PAD_HEADER, F_VERSION, { color: VERSION_GRAY }))
  ty += headerH
  ops.push(rawOp(`<line x1="${LEFT_W}" y1="${ty.toFixed(3)}" x2="${PANEL_W}" y2="${ty.toFixed(3)}" stroke="${MAGENTA}" stroke-width="${BORDER_W.toFixed(3)}"/>`))

  // Subheader (PRINTING DETAILS / DETALLES DE IMPRENTA).
  ops.push(rawOp(`<rect x="${LEFT_W}" y="${ty.toFixed(3)}" width="${RIGHT_W}" height="${subheaderH.toFixed(3)}" fill="${SUBHEADER_BG}"/>`))
  ops.push(textOp(subHeader, LEFT_W + CELL_PAD_X, ty + PAD_SUBHEADER, F_SUBHEADER, { bold: true, color: DARK_BLUE }))
  ty += subheaderH
  ops.push(rawOp(`<line x1="${LEFT_W}" y1="${ty.toFixed(3)}" x2="${PANEL_W}" y2="${ty.toFixed(3)}" stroke="${MAGENTA}" stroke-width="${BORDER_W.toFixed(3)}"/>`))

  // Filas de specs (label gris a la izquierda, valor a la derecha).
  rows.forEach((r, i) => {
    ops.push(textOp(r.lbl, LEFT_W + CELL_PAD_X, ty + PAD_ROW, F_ROWLABEL, { color: ROWLABEL_GRAY, avail: ROW_LABEL_W - CELL_PAD_X }))
    const valColor = r.placeholder ? PLACEHOLDER_GRAY : '#000000'
    const valAvail = RIGHT_W - ROW_LABEL_W - CELL_PAD_X * 2
    ops.push(textOp(String(r.val ?? ''), LEFT_W + ROW_LABEL_W + CELL_PAD_X, ty + PAD_ROW, F_VALUE, { color: valColor, avail: valAvail }))
    ty += dataRowH
    if (i < rows.length - 1) {
      ops.push(rawOp(`<line x1="${LEFT_W}" y1="${ty.toFixed(3)}" x2="${PANEL_W}" y2="${ty.toFixed(3)}" stroke="${MAGENTA}" stroke-width="${BORDER_W.toFixed(3)}"/>`))
    }
  })

  return { W: PANEL_W, H, ops }
}

/**
 * Rótulo como SVG con el texto convertido a trazos (paths), para export a PDF
 * en tamaño real. `fonts` = resultado de `loadLabelFonts()` (fonts.js).
 */
export function buildSpecSvgOutlined(data, fonts) {
  const { W, H, ops } = layoutSpec(data)
  return svgWrap(W, H, renderOps(ops, { outline: true, fonts }), { outline: true })
}
