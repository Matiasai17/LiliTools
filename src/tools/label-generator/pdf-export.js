/*
 * label-generator — conversión SVG (string) → PDF vectorial (Blob).
 * Compartido por label-pdf.js (etiqueta) y spec-pdf.js (rótulo): ambos arman
 * un SVG con el texto ya en trazos y lo pasan por acá para el PDF final.
 *
 * `jspdf`/`svg2pdf.js` se importan de forma DINÁMICA (como `xlsx` en batch.js):
 * solo se descargan cuando el usuario realmente pide un PDF.
 */
export async function svgToPdfBlob(svgString, W, H) {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])
  const svgEl = new DOMParser().parseFromString(svgString, 'image/svg+xml').documentElement

  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: W >= H ? 'landscape' : 'portrait' })
  await svg2pdf(svgEl, doc, { x: 0, y: 0, width: W, height: H })
  return doc.output('blob')
}
