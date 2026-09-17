/*
 * Lee un PDF subido y recupera el progreso guardado en sus metadatos (ver
 * pdfState.js). pdfjs-dist se importa dinámicamente: solo hace falta al usar
 * "Subir PDF", no al abrir la herramienta.
 */
import { decodeKeywords } from './pdfState.js'

export class InvalidPdfError extends Error {}
export class NoProgressInPdfError extends Error {}

/** @returns {Promise<{ mode: string, payload: object }>} */
export async function readProgressFromPdf(file) {
  const pdfjsLib = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

  let pdf
  try {
    const buffer = await file.arrayBuffer()
    pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  } catch {
    throw new InvalidPdfError('No se pudo leer ese PDF. Puede estar dañado o no ser un archivo válido.')
  }

  const meta = await pdf.getMetadata()
  const keywords = (meta && meta.info && meta.info.Keywords) || ''
  const decoded = decodeKeywords(keywords)
  if (!decoded) {
    throw new NoProgressInPdfError(
      'Este PDF no tiene progreso guardado para retomar (no fue generado con el botón "Guardar PDF" de esta herramienta).',
    )
  }
  return decoded
}
