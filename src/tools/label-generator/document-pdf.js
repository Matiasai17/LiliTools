/*
 * label-generator — PDF combinado del lote: rótulo + etiqueta, cada uno en su
 * tamaño real, ambos con el texto convertido a trazos. Dos páginas (una por
 * documento) en un mismo PDF, para que la imprenta tenga todo en un archivo.
 */
import { layoutSpec, buildSpecSvgOutlined } from './spec-svg.js'
import { buildLabelSvgOutlined } from './label-svg.js'

/** Rótulo (página 1) + etiqueta (página 2) como un único PDF. `fonts` = loadLabelFonts(). */
export async function buildLabelDocumentPdf(data, fonts) {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])

  const { W: specW, H: specH } = layoutSpec(data)
  const labelW = parseFloat(data.ancho) || 28
  const labelH = parseFloat(data.alto) || 19

  const doc = new jsPDF({ unit: 'mm', format: [specW, specH], orientation: specW >= specH ? 'landscape' : 'portrait' })
  const specEl = new DOMParser().parseFromString(buildSpecSvgOutlined(data, fonts), 'image/svg+xml').documentElement
  await svg2pdf(specEl, doc, { x: 0, y: 0, width: specW, height: specH })

  doc.addPage([labelW, labelH], labelW >= labelH ? 'landscape' : 'portrait')
  const labelEl = new DOMParser().parseFromString(buildLabelSvgOutlined(data, fonts), 'image/svg+xml').documentElement
  await svg2pdf(labelEl, doc, { x: 0, y: 0, width: labelW, height: labelH })

  return doc.output('blob')
}
