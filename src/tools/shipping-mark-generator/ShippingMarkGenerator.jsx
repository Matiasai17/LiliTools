import { useState } from 'react'

import templateUrl from './template.xlsx?url'
import {
  parseShippingMarkWorkbook,
  buildShippingMarkWorkbook,
  downloadShippingMarkWorkbook,
  downloadInputTemplate,
  MAX_ROWS,
} from './workbook.js'
import styles from './ShippingMarkGenerator.module.css'

/*
 * Generador de Shipping Mark: a partir de una plantilla .xlsx completada
 * (Código, Desc., N° de Fabricante — una fila por código), genera un único
 * .xlsx con una hoja por código, clonando el formato del shipping mark de
 * referencia de Liliana (bordes, logos, notas fijas). Todo client-side.
 */
export default function ShippingMarkGenerator() {
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const [templateBusy, setTemplateBusy] = useState(false)
  const [genBusy, setGenBusy] = useState(false)
  const [genProgress, setGenProgress] = useState(null) // {done,total} | null
  const [genError, setGenError] = useState('')

  const validRows = rows.filter((r) => r.errors.length === 0)
  const errorCount = rows.length - validRows.length

  async function handleFile(file) {
    if (!file) return
    setStatus('loading')
    setError('')
    setRows([])
    setGenError('')
    try {
      const buf = await file.arrayBuffer()
      const parsed = await parseShippingMarkWorkbook(buf)
      setRows(parsed)
      setStatus('ready')
    } catch (err) {
      setRows([])
      setError(err?.message || 'No se pudo leer el archivo. Verificá que sea un Excel válido.')
      setStatus('error')
    }
  }

  async function handleDownloadTemplate() {
    setTemplateBusy(true)
    try {
      await downloadInputTemplate()
    } finally {
      setTemplateBusy(false)
    }
  }

  async function handleGenerate() {
    setGenError('')
    setGenBusy(true)
    setGenProgress({ done: 0, total: validRows.length })
    try {
      const res = await fetch(templateUrl)
      if (!res.ok) throw new Error('No se pudo cargar el template de referencia.')
      const templateBuffer = await res.arrayBuffer()
      const workbook = await buildShippingMarkWorkbook(validRows, templateBuffer, (done, total) =>
        setGenProgress({ done, total }),
      )
      await downloadShippingMarkWorkbook(workbook)
    } catch (err) {
      setGenError(err?.message || 'No se pudo generar el archivo. Probá de nuevo.')
    } finally {
      setGenBusy(false)
      setGenProgress(null)
    }
  }

  return (
    <div className={styles.layout}>
      <button
        type="button"
        className={styles.btnLink}
        onClick={handleDownloadTemplate}
        disabled={templateBusy}
      >
        {templateBusy ? 'Generando plantilla…' : 'Descargar plantilla de entrada (.xlsx)'}
      </button>

      <label
        className={`${styles.dropzone} ${isDragging ? styles.dropzoneDrag : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setIsDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
      >
        <input
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <span className={styles.dropTitle}>
          Arrastrá la plantilla completa o <span className={styles.dropLink}>elegí un archivo</span>
        </span>
        <span className={styles.dropHint}>.xlsx · hasta {MAX_ROWS} filas</span>
      </label>

      <div className={styles.status} role="status" aria-live="polite">
        {status === 'loading' && <span>Leyendo el archivo…</span>}
        {status === 'error' && <span className={styles.error}>{error}</span>}
        {status === 'ready' && (
          <span>
            {validRows.length} código{validRows.length !== 1 ? 's' : ''} listo
            {validRows.length !== 1 ? 's' : ''}
            {errorCount > 0 ? ` · ${errorCount} con error` : ''}
          </span>
        )}
      </div>

      {status === 'ready' && rows.length > 0 && (
        <>
          <ul className={styles.rowList}>
            {rows.map((r) => (
              <li
                key={r.index}
                className={`${styles.rowItem} ${r.errors.length ? styles.rowItemError : ''}`}
              >
                <span className={styles.rowIndex}>#{r.index}</span>
                <span className={styles.rowCode}>{r.code || '—'}</span>
                <span className={styles.rowDesc}>{r.description || '—'}</span>
                {r.errors.length > 0 ? (
                  <span className={styles.rowErrors}>{r.errors.join(' · ')}</span>
                ) : (
                  <span className={styles.rowMfg}>N° Fab.: {r.mfgNumber}</span>
                )}
              </li>
            ))}
          </ul>

          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleGenerate}
            disabled={validRows.length === 0 || genBusy}
          >
            {genBusy
              ? `Generando… (${genProgress?.done ?? 0}/${genProgress?.total ?? validRows.length})`
              : `Generar y descargar (.xlsx) — ${validRows.length}`}
          </button>

          <div className={styles.statusLive} role="status" aria-live="polite">
            {genError && <span className={styles.error}>{genError}</span>}
          </div>
        </>
      )}
    </div>
  )
}
