/*
 * label-generator — modo lote.
 * Lectura de Excel y normalización de filas → modelo de etiqueta.
 * Porta `normalizeRow` de Et.art/v7 (js/batch.js).
 *
 * `xlsx` (SheetJS) se importa de forma DINÁMICA: solo se descarga cuando el
 * usuario realmente usa el modo lote, no en el bundle del home ni del individual.
 */
import { DEFAULTS, COL_MAP } from './config.js'
import { parseBool, parseDimensions, validateLabelData, buildFilename, triggerDownload } from './utils.js'
import { buildLabelSvgOutlined } from './label-svg.js'
import { buildLabelDocumentPdf } from './document-pdf.js'
import { loadLabelFonts } from './fonts.js'

/** Normaliza una fila cruda (encabezados libres) al modelo de etiqueta. */
export function normalizeRow(raw) {
  // Los campos requeridos arrancan vacíos (no heredan el default de otro producto):
  // así una celda vacía o una columna ausente la detecta la validación por fila.
  const d = { ...DEFAULTS, articulo: '', descripcion: '', codigo: '' }
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k).trim().toLowerCase()
    const mapped = COL_MAP[key]
    if (!mapped) continue

    if (mapped === 'tamano') {
      const val = String(v).toLowerCase()
      if (val.includes('28') && val.includes('19')) { d.ancho = 28; d.alto = 19 }
      else if (val.includes('44') && val.includes('24')) { d.ancho = 44; d.alto = 24 }
      else if (val.includes('40') && val.includes('18')) { d.ancho = 40; d.alto = 18 }
      else if (val.includes('38') && val.includes('22')) { d.ancho = 38; d.alto = 22 }
      else if (val.includes('55') && val.includes('20')) { d.ancho = 55; d.alto = 20 }
    } else if (mapped === 'colorImpresion') {
      const val = String(v).toLowerCase()
      if (val.includes('negro')) { d.colorImpresion = 'negro-negro'; d.impresion = 'Blanco' }
      else if (val.includes('rojo')) { d.colorImpresion = 'rojo-blanco'; d.impresion = 'Blanco' }
      else if (val.includes('gris')) { d.colorImpresion = 'gris-negro'; d.impresion = 'Negro' }
      else { d.colorImpresion = 'negro-blanco'; d.impresion = 'Negro' }
    } else if (mapped === 'dimensiones') {
      const dim = parseDimensions(v)
      if (dim) { d.ancho = dim.w; d.alto = dim.h }
    } else if (mapped === 'electricos') {
      const s = String(v).trim()
      // El máximo es opcional: hay productos de tensión/frecuencia única
      // ("220 V", "50 Hz"), no solo rangos ("220-240 V").
      const mV = s.match(/(\d+)(?:\s*-\s*(\d+))?\s*V/)
      const mHz = s.match(/(\d+)(?:\s*-\s*(\d+))?\s*Hz/)
      const mW = s.match(/(\d[\d/]+)\s*W/)
      if (mV) { d.voltMin = parseInt(mV[1], 10); d.voltMax = mV[2] ? parseInt(mV[2], 10) : '' }
      if (mHz) { d.hzMin = parseInt(mHz[1], 10); d.hzMax = mHz[2] ? parseInt(mHz[2], 10) : '' }
      if (mW) { d.potencia = mW[1] }
    } else if (mapped === 'modoImportado') {
      d.modoImportado = parseBool(v)
    } else if (mapped === 'claseII') {
      d.claseII = parseBool(v)
    } else if (mapped === 'version' || mapped === 'ancho' || mapped === 'alto') {
      d[mapped] = parseFloat(v) || d[mapped]
    } else if (mapped === 'voltMax' || mapped === 'hzMax') {
      // Celda vacía = tensión/frecuencia única (ej. 220 V). No debe caer al
      // default (240/60): eso convertía "220 V" en "220-240 V" sin avisar.
      const s = String(v).trim()
      d[mapped] = s === '' ? '' : (parseFloat(s) || d[mapped])
    } else if (mapped === 'voltMin' || mapped === 'hzMin') {
      const s = String(v).trim()
      d[mapped] = s === '' ? d[mapped] : (parseFloat(s) || d[mapped])
    } else {
      d[mapped] = String(v).trim() || d[mapped]
    }
  }
  return d
}

/**
 * Lee un .xlsx/.xls/.csv (ArrayBuffer) y devuelve filas normalizadas + validadas.
 * No aborta ante filas con error: cada item trae sus `errors`.
 * @returns {Promise<Array<{ index:number, data:object, errors:string[] }>>}
 */
export async function parseLabelWorkbook(arrayBuffer) {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = sheetName ? wb.Sheets[sheetName] : null
  if (!ws) throw new Error('El archivo no tiene ninguna hoja.')

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  if (!rows.length) throw new Error('La hoja no tiene filas de datos.')

  return rows.map((raw, i) => {
    const data = normalizeRow(raw)
    return { index: i + 1, data, errors: validateLabelData(data) }
  })
}

/** Genera y descarga una plantilla .xlsx de ejemplo (mismo `xlsx`, sin estilos). */
export async function downloadTemplate() {
  const XLSX = await import('xlsx')
  const header = [
    'Modo', 'Artículo', 'Descripción', 'V mín', 'V máx', 'Hz mín', 'Hz máx',
    'Potencia (W)', 'Tamaño', 'Color Fondo', 'Doble aislamiento', 'Código de insumo', 'Versión',
  ]
  // La columna "Versión" define la versión del rótulo y del nombre de archivo
  // (p. ej. AH300 v2 → "AH300_Et-articulo-ZZAH1297_v2"). Vacío = v0.
  //
  // VPC22 y VP18P dejan "V máx" y "Hz máx" vacíos a propósito: son los ejemplos
  // de producto de tensión/frecuencia única (la etiqueta sale "220 V ~ 50 Hz",
  // sin guion colgado). La última fila muestra el modo Importado.
  const sample = [
    ['Nacional', 'VPC22', 'Ventilador de Pie 22', 220, '', 50, 60, '130', '28x19', 'Fondo Blanco', 'Si', 'ZZVP1659', 1],
    ['Nacional', 'AB175', 'Batidora Manual EasyMix Plus', 220, 240, 50, 60, '450', '28x19', 'Fondo Blanco', 'Si', 'ZZAB1325', 1],
    ['Nacional', 'VP18P', 'Ventilador 18"', 220, '', 50, 60, '75', '28x19', 'Fondo Gris', 'Si', 'ZZVP1930', 1],
    ['Nacional', 'ASM112', 'Rallador acero inox. con accesorios', 220, 240, 50, 60, '250', '28x19', 'Fondo Blanco', 'Si', 'ZZAM1669', 1],
    ['Nacional', 'AH300', 'Procesadora manual', 220, 240, 50, 60, '450', '28x19', 'Fondo Negro', 'Si', 'ZZAH1297', 2],
    ['Nacional', 'AH160', 'Mixer EasyBlend', 220, 240, 50, 60, '450', '28x19', 'Fondo Negro', 'Si', 'ZZAH1412', 1],
    ['Importado', 'AF921', 'Aire frío/calor split', 220, 240, 50, 60, '1900', '40x24', 'Fondo Gris', 'No', '', 1],
  ]
  const ws = XLSX.utils.aoa_to_sheet([header, ...sample])
  ws['!cols'] = header.map((h) => ({ wch: Math.max(10, h.length + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Etiquetas')
  XLSX.writeFile(wb, 'LiliTools_Etiquetas_plantilla.xlsx')
}

/**
 * Exporta todas las filas válidas del lote como un .zip con, por artículo:
 * - `.svg`: solo la etiqueta (trazos), para quien va a imprimirla directamente.
 * - `.pdf`: rótulo + etiqueta (una página cada uno), ambos en tamaño real y
 *   con el texto en trazos — así en la imprenta tienen todo en un archivo, o
 *   eligen usar el SVG si solo necesitan la etiqueta.
 * `onProgress(done, total)` es opcional.
 * @param {Array<object>} rows Modelos de etiqueta ya normalizados y válidos.
 */
export async function downloadLabelsZip(rows, onProgress) {
  const [{ default: JSZip }, fonts] = await Promise.all([import('jszip'), loadLabelFonts()])
  const zip = new JSZip()
  const usedNames = new Set()

  for (let i = 0; i < rows.length; i++) {
    const data = rows[i]
    const base = buildFilename(data)
    let name = base
    let n = 2
    while (usedNames.has(name)) name = `${base}_${n++}`
    usedNames.add(name)

    zip.file(`${name}.svg`, buildLabelSvgOutlined(data, fonts))
    zip.file(`${name}.pdf`, await buildLabelDocumentPdf(data, fonts))
    onProgress?.(i + 1, rows.length)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, 'LiliTools_Etiquetas.zip')
}
