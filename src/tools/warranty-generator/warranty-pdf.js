/*
 * warranty-generator — export a PDF vectorial de 2 páginas (reverso +
 * frente), tamaño real. Mismo mecanismo que label-generator/pdf-export.js
 * (jsPDF + svg2pdf.js, import dinámico), copia propia para mantener el tool
 * autocontenido.
 */
import { buildWarrantyBackSvg, buildWarrantyFrontSvg, PAGE_W, PAGE_H } from './warranty-svg.js'

/** Garantía completa (reverso + frente) como PDF, devuelta como Blob. `fonts` = loadWarrantyFonts(). */
export async function buildWarrantyPdf(data, fonts) {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])
  const parser = new DOMParser()

  const doc = new jsPDF({ unit: 'pt', format: [PAGE_W, PAGE_H], orientation: 'portrait' })

  const backEl = parser.parseFromString(buildWarrantyBackSvg(), 'image/svg+xml').documentElement
  await svg2pdf(backEl, doc, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })

  doc.addPage([PAGE_W, PAGE_H], 'portrait')
  const frontSvg = await buildWarrantyFrontSvg(data, fonts)
  const frontEl = parser.parseFromString(frontSvg, 'image/svg+xml').documentElement
  await svg2pdf(frontEl, doc, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })

  return doc.output('blob')
}
