import { useEffect, useMemo, useRef, useState } from 'react'

import {
  buildQrSvg,
  buildFormatPng,
  composeWithContainer,
  svgToDataUri,
  getFormat,
  FORMATS,
  DEFAULT_FORMAT_ID,
  ERROR_LEVELS,
} from './qr.js'
import styles from './QrGenerator.module.css'

/*
 * Generador de QR para gráficas de caja (modo "código → URL fija").
 *
 * Flujo: ingresás un código de producto y se codifica como BASE_URL + código.
 * Elegís el formato de salida: QR solo, dentro del contenedor, o contenedor +
 * recetario. La previsualización muestra exactamente lo que se va a descargar.
 * Export: SVG (vectorial, para impresión) y PNG. Todo client-side.
 */

// --- Configuración del modo "código → URL fija" ---
// Prefijo fijo que se antepone al código. Editá esta constante si cambia el destino.
const BASE_URL = 'https://gestion.liliana.com.ar/r/MiWeb/'
const MAX_CODE_LENGTH = 200

/** Normaliza el código: sin espacios y en mayúsculas (para URL y nombre de archivo). */
function sanitizeCode(value) {
  return value.replace(/\s+/g, '').toUpperCase()
}

export default function QrGenerator() {
  const [rawCode, setRawCode] = useState('')
  const [errorLevel, setErrorLevel] = useState('H')
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT_ID)

  const [bareSvg, setBareSvg] = useState('') // QR pelado; el formato se compone aparte
  const [busy, setBusy] = useState(false)
  const [pngBusy, setPngBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const code = useMemo(() => sanitizeCode(rawCode), [rawCode])
  const fullUrl = code ? BASE_URL + code : ''
  const format = getFormat(formatId)
  const fileName = code ? code + format.fileSuffix : ''

  // Para descartar resultados de generaciones que quedaron obsoletas.
  const runRef = useRef(0)

  // Genera el QR pelado cada vez que cambia el código o el nivel de corrección.
  // El formato (contenedor/recetario) se aplica encima sin regenerar el QR.
  useEffect(() => {
    if (!code) {
      setBareSvg('')
      setErrorMsg('')
      setBusy(false)
      return
    }

    const runId = ++runRef.current
    setBusy(true)
    setErrorMsg('')

    const timer = setTimeout(async () => {
      try {
        const svg = await buildQrSvg(fullUrl, { errorCorrectionLevel: errorLevel })
        if (runId !== runRef.current) return
        setBareSvg(svg)
      } catch {
        if (runId !== runRef.current) return
        setBareSvg('')
        setErrorMsg(
          'El contenido es muy largo para un QR con este nivel de corrección. ' +
            'Probá un nivel más bajo (L o M) o acortá el código.',
        )
      } finally {
        if (runId === runRef.current) setBusy(false)
      }
    }, 220)

    return () => clearTimeout(timer)
  }, [code, fullUrl, errorLevel])

  // SVG final del formato elegido (composición barata: string ops).
  const displaySvg = useMemo(() => {
    if (!bareSvg) return ''
    return composeWithContainer(bareSvg, format)
  }, [bareSvg, format])

  const previewSrc = useMemo(
    () => (displaySvg ? svgToDataUri(displaySvg) : ''),
    [displaySvg],
  )

  function triggerDownload(href, filename, revoke = false) {
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    if (revoke) URL.revokeObjectURL(href)
  }

  function downloadSvg() {
    if (!displaySvg) return
    const blob = new Blob([displaySvg], { type: 'image/svg+xml;charset=utf-8' })
    triggerDownload(URL.createObjectURL(blob), `${fileName}.svg`, true)
  }

  async function downloadPng() {
    if (!bareSvg) return
    setPngBusy(true)
    try {
      const pngUrl = await buildFormatPng(fullUrl, bareSvg, format, {
        errorCorrectionLevel: errorLevel,
      })
      triggerDownload(pngUrl, `${fileName}.png`)
    } catch {
      setErrorMsg('No se pudo exportar el PNG. Probá de nuevo.')
    } finally {
      setPngBusy(false)
    }
  }

  const isEmpty = !code
  const isReady = Boolean(displaySvg) && !errorMsg
  const hasError = Boolean(errorMsg)

  return (
    <div className={styles.layout}>
      {/* ----- Panel de controles ----- */}
      <div className={styles.panel}>
        <div className={styles.field}>
          <label htmlFor="qr-code" className={styles.label}>
            Código de producto
          </label>
          <input
            id="qr-code"
            type="text"
            className={styles.input}
            value={rawCode}
            onChange={(e) => setRawCode(e.target.value)}
            placeholder="Ej: TF16"
            autoComplete="off"
            maxLength={MAX_CODE_LENGTH}
            spellCheck="false"
            autoFocus
          />
          <p className={styles.urlPreview}>
            Se codifica: <span className={styles.urlBase}>{BASE_URL}</span>
            <span className={styles.urlCode}>{code || 'XXX'}</span>
          </p>
        </div>

        {/* Selector de formato de salida */}
        <fieldset className={styles.segment}>
          <legend className={styles.label}>Formato de descarga</legend>
          <div className={styles.segmentTrack} role="radiogroup" aria-label="Formato de descarga">
            {FORMATS.map((f) => (
              <label
                key={f.id}
                className={`${styles.segmentOption} ${
                  formatId === f.id ? styles.segmentActive : ''
                }`}
              >
                <input
                  type="radio"
                  name="qr-format"
                  value={f.id}
                  checked={formatId === f.id}
                  onChange={() => setFormatId(f.id)}
                  className="sr-only"
                />
                <span className={styles.segmentLabel}>{f.label}</span>
                <span className={styles.segmentHint}>{f.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.field}>
          <label htmlFor="qr-ec" className={styles.label}>
            Corrección de error
          </label>
          <select
            id="qr-ec"
            className={styles.select}
            value={errorLevel}
            onChange={(e) => setErrorLevel(e.target.value)}
          >
            {ERROR_LEVELS.map((lvl) => (
              <option key={lvl.value} value={lvl.value}>
                {lvl.label}
              </option>
            ))}
          </select>
          <p className={styles.hint}>
            El SVG es vectorial (escala sin perder calidad para impresión). El PNG se
            exporta en alta resolución.
          </p>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={downloadSvg}
            disabled={!isReady}
          >
            Descargar SVG
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={downloadPng}
            disabled={!isReady || pngBusy}
          >
            {pngBusy ? 'Generando PNG…' : 'Descargar PNG'}
          </button>
        </div>

        {isReady && (
          <p className={styles.fileName}>
            Archivo: <b>{fileName}.svg</b> / <b>{fileName}.png</b>
          </p>
        )}

        {/* Región viva para anunciar errores a lectores de pantalla. */}
        <div className={styles.statusLive} role="status" aria-live="polite">
          {hasError && <span className={styles.error}>{errorMsg}</span>}
        </div>
      </div>

      {/* ----- Previsualización (WYSIWYG: muestra el formato elegido) ----- */}
      <div className={styles.previewCol}>
        <div
          className={`${styles.preview} ${
            isEmpty || hasError ? styles.previewPlaceholder : ''
          }`}
          style={{ aspectRatio: String(format.aspect) }}
        >
          {isReady ? (
            <img
              className={styles.qrImg}
              src={previewSrc}
              alt={`Vista previa del código QR para ${fullUrl} (${format.label})`}
            />
          ) : hasError ? (
            <span className={styles.previewText}>No se pudo generar el QR</span>
          ) : (
            <span className={styles.previewText}>
              {busy ? 'Generando…' : 'El QR va a aparecer acá'}
            </span>
          )}

          {busy && isReady && <span className={styles.busyTag}>Actualizando…</span>}
        </div>
      </div>
    </div>
  )
}
