import { useEffect, useState } from 'react'

import { loadWarrantyFonts } from './fonts.js'
import { buildWarrantyFrontSvg } from './warranty-svg.js'
import { buildWarrantyPdf } from './warranty-pdf.js'
import { buildFilename, triggerDownload, validateWarrantyData } from './utils.js'
import styles from './WarrantyGenerator.module.css'

/*
 * Generador de garantías de producto Liliana.
 *
 * Arma un PDF de 2 páginas (reverso con términos legales + frente con
 * Artículo/Descripción/versión, fecha de hoy y el QR del manual), con todo
 * el texto convertido a trazos. La plantilla base (reverso completo + la
 * mayor parte del frente) ya viene vectorizada de fábrica en templates/;
 * acá solo se insertan los 3 campos dinámicos y el QR (ver warranty-svg.js).
 *
 * ToolView.jsx ya provee "Volver al inicio", título y descripción.
 */

const DEFAULTS = { articulo: '', descripcion: '', version: 0 }

export default function WarrantyGenerator() {
  const [form, setForm] = useState({ ...DEFAULTS })
  const [fonts, setFonts] = useState(null)
  const [previewSvg, setPreviewSvg] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const errors = validateWarrantyData(form)

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }))
  }

  useEffect(() => {
    loadWarrantyFonts().then(setFonts)
  }, [])

  useEffect(() => {
    if (!fonts || errors.length > 0) {
      setPreviewSvg('')
      return
    }
    let cancelled = false
    setPreviewError('')
    buildWarrantyFrontSvg(form, fonts)
      .then((svg) => {
        if (!cancelled) setPreviewSvg(svg)
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err?.message || 'No se pudo armar la vista previa.')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonts, form.articulo, form.descripcion, form.version])

  async function downloadPdf() {
    setDownloadError('')
    setDownloadBusy(true)
    try {
      const readyFonts = fonts || (await loadWarrantyFonts())
      const pdfBlob = await buildWarrantyPdf(form, readyFonts)
      triggerDownload(pdfBlob, `${buildFilename(form)}.pdf`)
    } catch (err) {
      setDownloadError(err?.message || 'No se pudo generar el PDF. Probá de nuevo.')
    } finally {
      setDownloadBusy(false)
    }
  }

  return (
    <div className={styles.tool}>
      <div className={styles.layout}>
        {/* ---- Formulario ---- */}
        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Producto</legend>
            <Field label="Artículo">
              <input
                className={styles.input}
                type="text"
                value={form.articulo}
                onChange={(e) => setField('articulo', e.target.value)}
                placeholder="Ej: RPS910"
              />
            </Field>
            <Field label="Descripción">
              <input
                className={styles.input}
                type="text"
                value={form.descripcion}
                onChange={(e) => setField('descripcion', e.target.value)}
                placeholder="Ej: Plancha Seca"
              />
            </Field>
            <Field label="Versión">
              <input
                className={styles.input}
                type="number"
                min="0"
                max="99"
                value={form.version}
                onChange={(e) => setField('version', e.target.value)}
              />
            </Field>
          </fieldset>

          <p className={styles.hint}>
            La fecha de hoy y el QR de acceso al manual (con el artículo) se completan
            automáticamente. El reverso (términos de garantía) y el resto del frente son fijos.
          </p>
        </form>

        {/* ---- Preview + acciones ---- */}
        <div className={styles.previewCol}>
          <div className={styles.stageToolbar}>
            <span className={styles.stageTitle}>Frente de la garantía</span>
          </div>

          <div className={styles.stage}>
            {errors.length > 0 ? (
              <p className={styles.placeholder}>Completá artículo y descripción para ver la vista previa.</p>
            ) : previewError ? (
              <p className={styles.warn}>{previewError}</p>
            ) : previewSvg ? (
              <div className={styles.previewBox} dangerouslySetInnerHTML={{ __html: previewSvg }} />
            ) : (
              <p className={styles.placeholder}>Generando vista previa…</p>
            )}
          </div>

          {errors.length > 0 && (
            <div className={styles.warn} role="status" aria-live="polite">
              Revisá: {errors.join(' · ')}
            </div>
          )}
          {downloadError && (
            <div className={styles.warn} role="status" aria-live="polite">
              {downloadError}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={downloadPdf}
              disabled={errors.length > 0 || downloadBusy}
            >
              {downloadBusy ? 'Generando…' : 'Descargar PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  )
}
