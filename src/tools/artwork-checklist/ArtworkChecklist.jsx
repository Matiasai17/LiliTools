import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { ARTWORKS_UPDATE, ARTWORKS_DEV } from './data/checklists.js'
import {
  defaultSub,
  mergeSub,
  currentArtworks,
  currentSub,
  itemLabel,
  visibleItems,
  tabProgress,
  globalProgress,
  loadStateFromStorage,
  saveStateToStorage,
} from './state.js'
import { buildAndDownloadPdf } from './pdfBuilder.js'
import { readProgressFromPdf, InvalidPdfError, NoProgressInPdfError } from './pdfImport.js'
import styles from './ArtworkChecklist.module.css'

/*
 * Checklist de seguimiento de artworks: actualización de piezas existentes o
 * armado de un desarrollo nuevo, con progreso por pestaña y global.
 *
 * No hay backend acá: el progreso se guarda en localStorage (por navegador) y,
 * sobre todo, en el propio PDF exportado — "Guardar PDF" esconde el estado
 * completo en los metadatos del archivo, y "Subir PDF" lo relee para retomar.
 * Es el mecanismo real para pasar el progreso a otra máquina o guardarlo a
 * largo plazo (ver pdfState.js).
 *
 * Portado de una herramienta standalone ya probada por el equipo: la lógica y
 * el contenido de los checklists se mantienen, la interfaz se rehace con los
 * tokens visuales de LiliTools.
 */

const LISTS = { ARTWORKS_UPDATE, ARTWORKS_DEV }

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// ----- Ícono de check (reusado en la fila y en el botón "Guardar PDF") -----
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
      <path d="M4 12.5l5 5L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Anillo de progreso circular (conic-gradient) con transición suave al cambiar de %. */
function ProgressRing({ pct }) {
  const [display, setDisplay] = useState(pct)
  const prevRef = useRef(pct)
  const frameRef = useRef(null)

  useEffect(() => {
    const from = prevRef.current
    const to = pct
    prevRef.current = pct
    if (from === to) return
    if (prefersReducedMotion()) {
      setDisplay(to)
      return
    }
    const duration = 420
    const start = performance.now()
    function frame(now) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) frameRef.current = requestAnimationFrame(frame)
    }
    frameRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameRef.current)
  }, [pct])

  return (
    <span className={styles.ring} style={{ '--pct': display }} aria-hidden="true">
      <span>{Math.round(pct)}%</span>
    </span>
  )
}

/** Modal chico de confirmación, reusado para "reset" y "retomar progreso". */
function ConfirmDialog({ open, title, message, confirmLabel, danger, onConfirm, onCancel }) {
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    function onKeyDown(e) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className={styles.scrim} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="checklist-confirm-title">
        <h3 id="checklist-confirm-title" className={styles.sheetTitle}>
          {title}
        </h3>
        <p className={styles.sheetMessage}>{message}</p>
        <div className={styles.sheetActions}>
          <button
            ref={confirmRef}
            type="button"
            className={danger ? styles.sheetPrimaryDanger : styles.sheetPrimaryAccent}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button type="button" className={styles.sheetSecondary} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ArtworkChecklist() {
  const [state, setState] = useState(() => loadStateFromStorage(LISTS))
  const [pdfBusy, setPdfBusy] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [confirm, setConfirm] = useState(null) // null | { title, message, confirmLabel, danger, onConfirm }
  const fileInputRef = useRef(null)
  const saveTimerRef = useRef(null)

  // Persistencia debounced: guarda 150ms después del último cambio.
  useEffect(() => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveStateToStorage(state), 150)
    return () => clearTimeout(saveTimerRef.current)
  }, [state])

  const isDev = state.mode === 'desarrollo'
  const artworks = useMemo(() => currentArtworks(state, LISTS), [state.mode])
  const sub = currentSub(state)
  const activeArt = artworks.find((a) => a.id === sub.activeTab) ?? artworks[0]

  /** Actualiza la sub-sección del modo actual (update o dev) de forma inmutable. */
  function patchSub(patch) {
    const key = isDev ? 'dev' : 'update'
    setState((s) => ({ ...s, [key]: { ...s[key], ...(typeof patch === 'function' ? patch(s[key]) : patch) } }))
  }

  function toggleItem(artId, itemId) {
    patchSub((s) => ({
      checks: { ...s.checks, [artId]: { ...s.checks[artId], [itemId]: !s.checks[artId][itemId] } },
    }))
  }

  function handleReset() {
    setConfirm({
      title: isDev ? '¿Empezar otro desarrollo?' : '¿Pasar al siguiente artwork?',
      message: isDev
        ? 'Esto limpia todos los checks y el nombre de este desarrollo, y vuelve el origen a Nacional. No se puede deshacer.'
        : 'Esto limpia todos los checks, el nombre y vuelve el origen a Nacional. No se puede deshacer.',
      confirmLabel: 'Limpiar y continuar',
      danger: true,
      onConfirm: () => {
        const key = isDev ? 'dev' : 'update'
        setState((s) => ({ ...s, [key]: defaultSub(isDev ? ARTWORKS_DEV : ARTWORKS_UPDATE) }))
        setConfirm(null)
      },
    })
  }

  async function handleSavePdf() {
    setPdfBusy(true)
    setStatusMsg('')
    try {
      await buildAndDownloadPdf({ state, sub, artworks })
    } catch {
      setStatusMsg('No se pudo generar el PDF. Probá de nuevo.')
    } finally {
      setPdfBusy(false)
    }
  }

  async function handleUploadPdf(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploadBusy(true)
    setStatusMsg('')
    try {
      const { mode: importedMode, payload } = await readProgressFromPdf(file)
      const list = importedMode === 'desarrollo' ? ARTWORKS_DEV : ARTWORKS_UPDATE
      const mergedSub = mergeSub(payload, list)
      const importedName = (mergedSub.artworkName || '').trim() || 'SIN NOMBRE'
      const modeLabel = importedMode === 'desarrollo' ? 'nuevo desarrollo' : 'actualización'

      setConfirm({
        title: 'Retomar progreso',
        message: `Se encontró un checklist de ${modeLabel} para "${importedName}" en ese PDF. Va a reemplazar lo que tenés ahora en esa sección. No se puede deshacer.`,
        confirmLabel: 'Retomar desde ahí',
        danger: false,
        onConfirm: () => {
          const key = importedMode === 'desarrollo' ? 'dev' : 'update'
          setState((s) => ({ ...s, mode: importedMode, [key]: mergedSub }))
          setConfirm(null)
        },
      })
    } catch (err) {
      if (err instanceof InvalidPdfError || err instanceof NoProgressInPdfError) {
        setStatusMsg(err.message)
      } else {
        setStatusMsg('No se pudo leer ese PDF.')
      }
    } finally {
      setUploadBusy(false)
    }
  }

  const { done: gDone, total: gTotal } = globalProgress(artworks, sub)
  const { done: aDone, total: aTotal } = activeArt ? tabProgress(activeArt, sub) : { done: 0, total: 0 }
  const items = activeArt ? visibleItems(activeArt, sub.origin) : []

  return (
    <div className={styles.layout}>
      <div className={styles.controlsRow}>
        <fieldset className={styles.segment}>
          <legend className={styles.srOnlyLegend}>Modo</legend>
          <div className={styles.segmentTrack} role="radiogroup" aria-label="Modo">
            {[
              ['actualizacion', 'Actualización'],
              ['desarrollo', 'Nuevo desarrollo'],
            ].map(([v, label]) => (
              <label
                key={v}
                className={`${styles.segmentOption} ${state.mode === v ? styles.segmentActive : ''}`}
              >
                <input
                  type="radio"
                  name="checklist-mode"
                  value={v}
                  className="sr-only"
                  checked={state.mode === v}
                  onChange={() => setState((s) => ({ ...s, mode: v }))}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.segment}>
          <legend className={styles.srOnlyLegend}>Origen</legend>
          <div className={styles.segmentTrack} role="radiogroup" aria-label="Origen">
            {[
              ['nacional', 'Nacional'],
              ['importada', 'Importada'],
            ].map(([v, label]) => (
              <label
                key={v}
                className={`${styles.segmentOption} ${sub.origin === v ? styles.segmentActive : ''}`}
              >
                <input
                  type="radio"
                  name="checklist-origin"
                  value={v}
                  className="sr-only"
                  checked={sub.origin === v}
                  onChange={() => patchSub({ origin: v })}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className={styles.field}>
        <label htmlFor="checklist-name" className={styles.label}>
          {isDev ? 'Desarrollo en curso' : 'Artwork en curso'}
        </label>
        <input
          id="checklist-name"
          type="text"
          className={styles.input}
          value={sub.artworkName}
          onChange={(e) => patchSub({ artworkName: e.target.value.toUpperCase() })}
          placeholder={isDev ? 'Nombre del desarrollo' : 'Nombre del artwork'}
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Piezas del checklist">
        {artworks.map((art) => {
          const p = tabProgress(art, sub)
          const pct = p.total ? Math.round((p.done / p.total) * 100) : 0
          return (
            <button
              key={art.id}
              type="button"
              role="tab"
              id={`checklist-tab-${art.id}`}
              aria-selected={art.id === sub.activeTab}
              aria-controls="checklist-panel"
              className={`${styles.tabCard} ${art.id === sub.activeTab ? styles.tabCardActive : ''}`}
              onClick={() => patchSub({ activeTab: art.id })}
            >
              <ProgressRing pct={pct} />
              <span className={styles.tabMeta}>
                <span className={styles.tabName}>{art.label}</span>
                <span className={styles.tabCount}>
                  {p.done}/{p.total}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div
        className={styles.checklistCard}
        id="checklist-panel"
        role="tabpanel"
        aria-labelledby={activeArt ? `checklist-tab-${activeArt.id}` : undefined}
      >
        <div className={styles.checklistHeader}>
          <h2 className={styles.checklistTitle}>{activeArt?.label ?? '—'}</h2>
          <span className={styles.frac}>
            {aDone}/{aTotal}
          </span>
        </div>

        {(activeArt?.id === 'rating' || activeArt?.id === 'garantia') && (
          <p className={styles.contextLink}>
            <Link
              to={activeArt.id === 'rating' ? '/tools/label-generator' : '/tools/warranty-generator'}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir {activeArt.id === 'rating' ? 'Generador de etiquetas' : 'Generador de garantías'} ↗
            </Link>
          </p>
        )}

        <div className={styles.track}>
          <div
            className={styles.trackFill}
            style={{ width: aTotal ? `${(aDone / aTotal) * 100}%` : '0%' }}
          />
        </div>

        {items.length === 0 ? (
          <p className={styles.empty}>No hay ítems para este origen.</p>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => {
              const checked = !!sub.checks[activeArt.id][item.id]
              return (
                <li key={item.id} className={styles.row}>
                  <label className={styles.rowLabel}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleItem(activeArt.id, item.id)}
                    />
                    <span className={`${styles.checkmark} ${checked ? styles.checkmarkOn : ''}`} aria-hidden="true">
                      <CheckIcon />
                    </span>
                    <span className={`${styles.rowText} ${checked ? styles.rowTextDone : ''}`}>
                      {itemLabel(item, sub.origin)}
                      {item.conditional && <span className={styles.badge}>solo {item.conditional}</span>}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.globalProgress}>
          <div className={styles.globalLabel}>Progreso total</div>
          <div className={styles.track}>
            <div className={styles.trackFill} style={{ width: gTotal ? `${(gDone / gTotal) * 100}%` : '0%' }} />
          </div>
          <div className={styles.globalCount}>
            {gDone}/{gTotal}
          </div>
        </div>

        {statusMsg && (
          <div className={styles.warn} role="status" aria-live="polite">
            {statusMsg}
          </div>
        )}

        <div className={styles.footerActions}>
          <button type="button" className={styles.btnPrimary} onClick={handleSavePdf} disabled={pdfBusy}>
            {pdfBusy ? 'Generando…' : 'Guardar PDF'}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadBusy}
          >
            {uploadBusy ? 'Leyendo…' : 'Subir PDF'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={handleUploadPdf}
          />
        </div>

        <button type="button" className={styles.btnDanger} onClick={handleReset}>
          {isDev ? 'Empezar otro desarrollo' : 'Siguiente artwork'}
        </button>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
