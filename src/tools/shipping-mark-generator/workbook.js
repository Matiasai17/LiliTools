/*
 * Lógica de shipping-mark-generator (100% client-side, sin backend).
 *
 * `exceljs` se importa de forma DINÁMICA: solo se descarga cuando el usuario
 * realmente usa la herramienta, no en el bundle del home (mismo criterio que
 * `xlsx` en label-generator/batch.js). Se eligió ExcelJS -y no el `xlsx` ya
 * instalado- porque necesitamos preservar bordes, celdas combinadas e
 * imágenes del template de referencia al escribir, no solo leer filas.
 */
import { TITLE_CELL, TITLE_MIRROR_CELLS, DESCRIPTION_CELLS, MFG_NUMBER_ROW, MFG_NUMBER_COLS, MFG_NUMBER_LABEL, MAX_ROWS } from './config.js'
import { classifyHeader, FIELD_LABELS, codeToSheetName, buildOutputFilename, triggerDownload } from './utils.js'

export { MAX_ROWS }

/**
 * Lee la plantilla de entrada (.xlsx) y devuelve filas normalizadas + validadas.
 * Filas totalmente vacías se ignoran (no son un error). No aborta ante filas
 * con error: cada una trae sus `errors`; el llamador decide qué generar.
 * @returns {Promise<Array<{index:number, code:string, description:string, mfgNumber:string, errors:string[]}>>}
 */
export async function parseShippingMarkWorkbook(arrayBuffer) {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(arrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('El archivo no tiene ninguna hoja.')

  const colIndex = {}
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const field = classifyHeader(cell.value)
    if (field) colIndex[field] = colNumber
  })

  const missing = ['code', 'description', 'mfgNumber'].filter((f) => !colIndex[f])
  if (missing.length) {
    throw new Error(
      `Faltan columnas: ${missing.map((f) => FIELD_LABELS[f]).join(', ')}. Usá la plantilla descargable.`,
    )
  }

  const rows = []
  const seenCodes = new Set()

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const code = String(row.getCell(colIndex.code).value ?? '').trim()
    const description = String(row.getCell(colIndex.description).value ?? '').trim()
    const mfgNumber = String(row.getCell(colIndex.mfgNumber).value ?? '').trim()

    if (!code && !description && !mfgNumber) continue // fila vacía: se ignora

    const errors = []
    if (!code) errors.push('Falta el código')
    if (!description) errors.push('Falta la descripción')
    if (!mfgNumber) errors.push('Falta el N° de Fabricante')

    const dedupeKey = code.toUpperCase()
    if (dedupeKey) {
      if (seenCodes.has(dedupeKey)) errors.push('Código duplicado')
      else seenCodes.add(dedupeKey)
    }

    rows.push({ index: rows.length + 1, code, description, mfgNumber, errors })
  }

  if (!rows.length) throw new Error('La plantilla no tiene filas con datos.')
  if (rows.length > MAX_ROWS) {
    throw new Error(`El archivo tiene ${rows.length} filas; el máximo por vez es ${MAX_ROWS}.`)
  }

  return rows
}

/** Clona una hoja completa (valores, estilos, anchos, merges e imágenes) dentro del mismo workbook. */
function cloneWorksheet(protoWs, workbook, tempName) {
  const ws = workbook.addWorksheet(tempName, {
    // `addWorksheet()` sin esto arranca con sus propios defaults (alto/ancho
    // de fila y columna por defecto de ExcelJS, no los del template). Las
    // filas/columnas SIN ancho u alto explícito heredaban ese default
    // distinto y crecían un poco en cada hoja clonada, desalineando el logo
    // y el pictograma (ambos anclados por fila/columna) contra los bordes de
    // sus celdas — el "corte" que se ve en toda hoja menos la primera.
    properties: { ...protoWs.properties },
    pageSetup: { ...protoWs.pageSetup },
    views: protoWs.views,
  })

  protoWs.columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col?.width
  })

  for (let r = 1; r <= protoWs.rowCount; r++) {
    const protoRow = protoWs.getRow(r)
    const row = ws.getRow(r)
    if (protoRow.height) row.height = protoRow.height
    for (let c = 1; c <= protoWs.columnCount; c++) {
      const protoCell = protoRow.getCell(c)
      const cell = row.getCell(c)
      cell.value = protoCell.value
      cell.style = protoCell.style
    }
    row.commit()
  }

  // Merges e imágenes del template (las imágenes comparten el mismo binario
  // ya registrado en `workbook`, así que clonar N hojas no infla el archivo).
  for (const range of protoWs.model.merges) ws.mergeCells(range)
  for (const img of protoWs.getImages()) ws.addImage(img.imageId, img.range)

  return ws
}

/** Escribe código/descripción/N° de fabricante en las celdas correspondientes de una hoja ya clonada. */
function fillShippingMarkSheet(ws, { code, description, mfgNumber }) {
  const title = `${code} -`
  ws.getCell(TITLE_CELL).value = title
  for (const addr of TITLE_MIRROR_CELLS) ws.getCell(addr).value = title
  for (const addr of DESCRIPTION_CELLS) ws.getCell(addr).value = description

  const mfgText = `${MFG_NUMBER_LABEL}${mfgNumber}`
  for (const col of MFG_NUMBER_COLS) ws.getCell(`${col}${MFG_NUMBER_ROW}`).value = mfgText
}

/**
 * Genera el workbook final: una hoja por fila válida, clonando el template de
 * referencia. `onProgress(done, total)` es opcional. Cede el hilo cada pocas
 * filas para no trabar la UI en archivos grandes.
 * @param {Array<{code, description, mfgNumber}>} rows Filas ya validadas (sin errors).
 * @param {ArrayBuffer} templateArrayBuffer Bytes de template.xlsx.
 */
export async function buildShippingMarkWorkbook(rows, templateArrayBuffer, onProgress) {
  const ExcelJS = await import('exceljs')
  const out = new ExcelJS.Workbook()
  await out.xlsx.load(templateArrayBuffer)
  const protoWs = out.worksheets[0]

  // Clonar ANTES de mutar la hoja original: si mutáramos protoWs primero, los
  // clones posteriores heredarían los datos de la fila 0 en vez del template.
  const sheets = [protoWs]
  for (let i = 1; i < rows.length; i++) {
    sheets.push(cloneWorksheet(protoWs, out, `__tmp_${i}`))
  }

  const usedNames = new Set()
  for (let i = 0; i < rows.length; i++) {
    const ws = sheets[i]
    const data = rows[i]

    const base = codeToSheetName(data.code)
    let name = base
    let n = 2
    while (usedNames.has(name)) name = `${base}_${n++}`
    usedNames.add(name)
    ws.name = name

    fillShippingMarkSheet(ws, data)

    onProgress?.(i + 1, rows.length)
    if (i % 5 === 4) await new Promise((resolve) => setTimeout(resolve, 0))
  }

  return out
}

/** Descarga el workbook final ya generado. */
export async function downloadShippingMarkWorkbook(workbook, filename = buildOutputFilename()) {
  const buffer = await workbook.xlsx.writeBuffer()
  triggerDownload(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  )
}

/** Genera y descarga la plantilla de entrada (3 columnas, encabezado con formato). */
export async function downloadInputTemplate() {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Shipping Mark')

  ws.columns = [
    { header: FIELD_LABELS.code, width: 16 },
    { header: FIELD_LABELS.description, width: 44 },
    { header: FIELD_LABELS.mfgNumber, width: 20 },
  ]

  const headerRow = ws.getRow(1)
  headerRow.height = 22
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE42320' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFC01D1A' } } }
  })
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await wb.xlsx.writeBuffer()
  triggerDownload(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'LiliTools_ShippingMark_plantilla.xlsx',
  )
}
