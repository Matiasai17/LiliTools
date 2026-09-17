/*
 * Genera el PDF de resumen (texto liviano, sin vectores) del checklist.
 * jsPDF se importa dinámicamente: recién se descarga al tocar "Guardar PDF",
 * no al abrir la herramienta (mismo patrón que label-generator/warranty-generator).
 */
import { visibleItems, tabProgress, globalProgress, itemLabel, sanitizeFilename, formatTimestamp } from './state.js'
import { buildExportPayload, encodeKeywords } from './pdfState.js'

export async function buildAndDownloadPdf({ state, sub, artworks }) {
  const { jsPDF } = await import('jspdf')
  const isDev = state.mode === 'desarrollo'

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  doc.setProperties({
    title: 'Artwork Checklist',
    subject: isDev ? 'Checklist de nuevo desarrollo' : 'Checklist de actualización de artworks',
    creator: 'LiliTools — Checklist de artworks',
    keywords: encodeKeywords(buildExportPayload(state, sub)),
  })

  const marginX = 44
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = 56

  function ensureSpace(lineHeight) {
    if (y + lineHeight > pageHeight - 40) {
      doc.addPage()
      y = 56
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(20, 20, 22)
  doc.text(isDev ? 'ARTWORK CHECKLIST — NUEVO DESARROLLO' : 'ARTWORK CHECKLIST — ACTUALIZACIÓN', marginX, y)
  y += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(110, 110, 115)
  doc.text(`Generado: ${formatTimestamp(new Date())}`, marginX, y)
  y += 24

  doc.setDrawColor(220, 220, 224)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 22

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(20, 20, 22)
  doc.text(isDev ? 'DESARROLLO:' : 'ARTWORK:', marginX, y)
  doc.setFont('helvetica', 'normal')
  doc.text(sub.artworkName || 'SIN NOMBRE', marginX + 90, y)
  y += 18

  doc.setFont('helvetica', 'bold')
  doc.text('ORIGEN:', marginX, y)
  doc.setFont('helvetica', 'normal')
  doc.text(sub.origin === 'importada' ? 'Importada' : 'Nacional', marginX + 90, y)
  y += 20

  const { done: gDone, total: gTotal } = globalProgress(artworks, sub)
  doc.setFont('helvetica', 'bold')
  doc.text('PROGRESO TOTAL:', marginX, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${gDone}/${gTotal} ítems completados`, marginX + 110, y)
  y += 26

  artworks.forEach((art) => {
    const items = visibleItems(art, sub.origin)
    const { done, total } = tabProgress(art, sub)

    ensureSpace(30)
    doc.setFillColor(245, 245, 247)
    doc.roundedRect(marginX - 6, y - 14, pageWidth - (marginX - 6) * 2, 22, 4, 4, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(20, 20, 22)
    doc.text(art.label.toUpperCase(), marginX, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(110, 110, 115)
    doc.text(`${done}/${total}`, pageWidth - marginX - 24, y)
    y += 22

    if (items.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(10)
      doc.setTextColor(150, 150, 155)
      doc.text('Sin ítems para este origen.', marginX + 4, y)
      y += 18
    } else {
      items.forEach((item) => {
        const checked = !!sub.checks[art.id][item.id]
        const label = itemLabel(item, sub.origin) + (item.conditional ? `  (solo ${item.conditional})` : '')
        const lines = doc.splitTextToSize(label, pageWidth - marginX * 2 - 20)
        ensureSpace(14 * lines.length + 6)

        doc.setDrawColor(150, 150, 155)
        doc.setLineWidth(1)
        if (checked) {
          doc.setFillColor(48, 209, 88)
          doc.roundedRect(marginX + 2, y - 8, 9, 9, 2, 2, 'F')
          doc.setDrawColor(255, 255, 255)
          doc.setLineWidth(1.1)
          doc.line(marginX + 3.5, y - 3.8, marginX + 5.3, y - 1.8)
          doc.line(marginX + 5.3, y - 1.8, marginX + 9.2, y - 6.6)
        } else {
          doc.roundedRect(marginX + 2, y - 8, 9, 9, 2, 2, 'S')
        }

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10.5)
        doc.setTextColor(checked ? 150 : 40, checked ? 150 : 40, checked ? 155 : 44)
        doc.text(lines, marginX + 18, y)
        y += 14 * lines.length + 4
      })
    }
    y += 12
  })

  const prefix = isDev ? 'Desarrollo' : 'Checklist'
  const filename = `${prefix}-${sanitizeFilename(sub.artworkName)}-${formatTimestamp(new Date()).replace(/[: ]/g, '-')}.pdf`
  doc.save(filename)
}
