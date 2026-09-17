import { useEffect, useRef, useState } from 'react'

import { fetchSuggestions, postSuggestion } from './suggestionsApi.js'
import styles from './SuggestionPanel.module.css'

/*
 * Panel "Sugerí una mejora" a nivel hub (se abre desde el header).
 *
 * LiliTools es estático (sin envío por correo/WhatsApp), pero la sugerencia
 * SÍ se guarda de forma compartida: viaja al backend del hub (ver
 * server/artwork-finder + suggestionsApi.js) y queda visible para cualquiera
 * que abra este panel, no solo en el navegador de quien la escribió. Se
 * muestra en una lista debajo del formulario.
 */

function formatFecha(iso) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`
}

export default function SuggestionPanel({ open, onClose }) {
  const panelRef = useRef(null)
  const firstFieldRef = useRef(null)
  const restoreFocusRef = useRef(null)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [listError, setListError] = useState('')

  // Trae la lista compartida del backend cada vez que se abre el panel.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingList(true)
    setListError('')
    fetchSuggestions()
      .then((data) => {
        if (cancelled) return
        setSuggestions(data.sugerencias || [])
      })
      .catch((err) => {
        if (cancelled) return
        setListError(err.message || 'No se pudieron cargar las sugerencias.')
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    restoreFocusRef.current = document.activeElement
    firstFieldRef.current?.focus()

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      // Trampa de foco dentro del panel.
      const focusables = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables || !focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (restoreFocusRef.current instanceof HTMLElement) restoreFocusRef.current.focus()
    }
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      setStatus('Escribí tu sugerencia antes de enviar.')
      return
    }
    setSubmitting(true)
    setStatus('')
    try {
      const data = await postSuggestion({ name, message: trimmedMessage })
      setSuggestions((prev) => [data.sugerencia, ...prev])
      setMessage('')
      setStatus('¡Gracias! Tu sugerencia ya es visible para todos, acá abajo.')
    } catch (err) {
      setStatus(err.message || 'No se pudo guardar la sugerencia. Probá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <aside
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Sugerí una mejora"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Sugerí una mejora</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <p className={styles.desc}>
          Esta suite evoluciona con tus ideas. Si tenés una sugerencia o algo que te ahorraría
          tiempo, escribilo acá abajo: queda visible para todos, no solo en tu navegador.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>
              Tu nombre <span className={styles.hint}>(opcional)</span>
            </span>
            <input
              ref={firstFieldRef}
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: María García"
              autoComplete="name"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Tu sugerencia o idea</span>
            <textarea
              className={styles.textarea}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Contanos tu idea…"
              rows={6}
            />
          </label>

          <div className={styles.history}>
            <h3 className={styles.historyTitle}>Sugerencias de todos</h3>
            {loadingList && <p className={styles.historyNote}>Cargando…</p>}
            {!loadingList && listError && <p className={styles.historyNote}>{listError}</p>}
            {!loadingList && !listError && suggestions.length === 0 && (
              <p className={styles.historyNote}>Todavía no hay sugerencias. ¡Sé el primero!</p>
            )}
            {!loadingList && !listError && suggestions.length > 0 && (
              <ul className={styles.historyList}>
                {suggestions.map((s) => (
                  <li key={s.id} className={styles.historyItem}>
                    <div className={styles.historyMeta}>
                      <span className={styles.historyName}>{s.name}</span>
                      <span className={styles.historyDate}>{formatFecha(s.fecha)}</span>
                    </div>
                    <p className={styles.historyMessage}>{s.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.status} role="status" aria-live="polite">
            {status}
          </div>

          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      </aside>
    </div>
  )
}
