/*
 * label-generator — export de la ETIQUETA a PDF vectorial.
 * Reusa el mismo SVG en trazos (buildLabelSvgOutlined) y lo convierte a un PDF
 * con gráficos vectoriales reales (svg2pdf.js sobre jsPDF, ver pdf-export.js):
 * abre limpio en Illustrator, sin depender de fuentes del sistema ni rasterizar.
 */
import { buildLabelSvgOutlined } from './label-svg.js'
import { svgToPdfBlob } from './pdf-export.js'

/** Etiqueta vectorial (trazos) como PDF, devuelta como Blob. `fonts` = loadLabelFonts(). */
export async function buildLabelPdf(data, fonts) {
  const W = parseFloat(data.ancho) || 28
  const H = parseFloat(data.alto) || 19
  return svgToPdfBlob(buildLabelSvgOutlined(data, fonts), W, H)
}
