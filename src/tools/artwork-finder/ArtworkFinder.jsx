import { useEffect, useState } from 'react'

import { fetchTipos, buscarArtwork, artworkFileUrl, CODIGO_RE } from './api.js'
import styles from './ArtworkFinder.module.css'

/*
 * Buscador de artworks — frontend de la herramienta.
 *
 * Busca un código de producto en el sistema interno de Liliana y muestra la
 * ÚLTIMA versión del artwork elegido (etiquetas, manuales, gráficas, cajas,
 * imágenes en alta), más el listado de todas las versiones encontradas.
 *
 * A diferencia del resto del hub, esta herramienta depende de un backend
 * (ver server/artwork-finder): el sistema interno no tiene API pública ni CORS
 * y exige sesión. Por eso maneja estados extra: sesión vencida y backend caído.
 *
 * ToolView.jsx ya renderiza "Volver", el título y la descripción.
 */

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp']

function esImagen(fileType) {
  return IMAGE_EXT.includes((fileType || '').toLowerCase())
}

function accionLabel(version) {
  return esImagen(version.fileType) ? 'Ver imagen' : 'Visualizar'
}

export default function ArtworkFinder() {
  const [tipos, setTipos] = useState([])
  const [tiposError, setTiposError] = useState('')
  const [codigo, setCodigo] = useState('')
  const [tipo, setTipo] = useState('')

  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'done' | 'error'
  const [message, setMessage] = useState('') // aviso (error / no encontrado)
  const [result, setResult] = useState(null) // { ultima, grupos, tipoLabel }

  // Catálogo de tipos (desde el backend) para poblar el selector.
  useEffect(() => {
    let cancelled = false
    fetchTipos()
      .then((data) => {
        if (cancelled) return
        setTipos(data.tipos || [])
        setTipo(data.default || data.tipos?.[0]?.id || '')
      })
      .catch((err) => {
        if (cancelled) return
        setTiposError(
          err.code === 'network'
            ? 'No se pudo conectar con el servidor del buscador. Verificá que esté disponible.'
            : err.message || 'No se pudo cargar el catálogo de tipos.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  const tipoLabel = (id) => tipos.find((t) => t.id === id)?.label || id
  const codigoValido = CODIGO_RE.test(codigo.trim().toUpperCase())

  async function onSubmit(e) {
    e.preventDefault()
    const code = codigo.trim().toUpperCase()
    if (!CODIGO_RE.test(code) || !tipo) return

    setStatus('loading')
    setMessage('')
    setResult(null)

    try {
      const data = await buscarArtwork(code, tipo)
      if (!data.encontrado) {
        setStatus('error')
        setMessage(`No se encontró ${tipoLabel(tipo)} para "${code}".`)
        return
      }
      setResult({ ultima: data.ultima, grupos: data.grupos, tipoLabel: tipoLabel(tipo) })
      setStatus('done')
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Ocurrió un error al buscar.')
    }
  }

  return (
    <div className={styles.layout}>
      <p className={styles.intro}>
        Buscá un producto en el sistema interno y visualizá o descargá la última versión de su
        artwork. Requiere conexión con el servidor interno de Liliana.
      </p>

      <form className={styles.form} onSubmit={onSubmit}>
        <input
          className={styles.input}
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Código de producto (ej. VTHA604)"
          maxLength={15}
          aria-label="Código de producto"
          autoComplete="off"
        />
        <select
          className={styles.select}
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          aria-label="Tipo de artwork"
          disabled={tipos.length === 0}
        >
          {tipos.length === 0 ? (
            <option>Cargando…</option>
          ) : (
            tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))
          )}
        </select>
        <button
          type="submit"
          className={styles.btnPrimary}
          disabled={status === 'loading' || !codigoValido || !tipo}
        >
          {status === 'loading' ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {tiposError && (
        <p className={styles.warn} role="status" aria-live="polite">
          {tiposError}
        </p>
      )}

      {status === 'error' && message && (
        <p className={styles.warn} role="status" aria-live="polite">
          {message}
        </p>
      )}

      {status === 'loading' && (
        <div className={styles.loadingBlock} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Buscando {tipoLabel(tipo)} de {codigo.trim().toUpperCase()}…</span>
        </div>
      )}

      {status === 'done' && result && (
        <section className={styles.results}>
          <h2 className={styles.sectionTitle}>
            Última versión <span className={styles.tipoLabel}>{result.tipoLabel}</span>
          </h2>
          <UltimaCard ultima={result.ultima} />

          <h2 className={styles.sectionTitle}>Todas las versiones encontradas</h2>
          <div className={styles.grupos}>
            {result.grupos.map((g, i) => (
              <GrupoCard key={g.id || i} grupo={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** Miniatura: preview de la versión, o la foto del producto, o un placeholder. */
function Thumb({ version, grupo, alt, size }) {
  const src = version.previewUrl || grupo.fotoUrl
  if (src) {
    return <img className={styles.thumbImg} src={artworkFileUrl(src)} alt={alt} loading="lazy" />
  }
  return (
    <div className={`${styles.filetype} ${size === 'lg' ? styles.filetypeLg : ''}`}>
      {(version.fileType || 'archivo').toUpperCase()}
    </div>
  )
}

function UltimaCard({ ultima }) {
  if (!ultima) {
    return <p className={styles.empty}>No se encontró ninguna versión cargada para este código.</p>
  }
  const g = ultima.grupo
  return (
    <div className={styles.ultimaCard}>
      <div className={styles.thumbLg}>
        <Thumb version={ultima} grupo={g} alt={`${g.codigo} ${ultima.version || ''}`} size="lg" />
      </div>
      <div className={styles.info}>
        <h3 className={styles.infoTitle}>
          {g.codigo} {ultima.version && <span className={styles.badge}>{ultima.version}</span>}
        </h3>
        {g.descripcion && <p className={styles.infoLine}>{g.descripcion}</p>}
        <p className={styles.infoLine}>
          <strong>Estado producto:</strong> {g.estado || '-'}
        </p>
        <p className={styles.infoLine}>
          <strong>Fecha:</strong> {ultima.fecha || '-'}
        </p>
        {ultima.seccion && (
          <p className={styles.infoLine}>
            <strong>Sección:</strong> {ultima.seccion}
          </p>
        )}
        {ultima.comentario && (
          <p className={styles.infoLine}>
            <strong>Detalle:</strong> {ultima.comentario}
          </p>
        )}
        <div className={styles.acciones}>
          <a
            className={styles.btnPrimary}
            href={artworkFileUrl(ultima.url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {accionLabel(ultima)}
          </a>
          {ultima.pdfUrl && ultima.pdfUrl !== ultima.url && (
            <a
              className={styles.btnSecondary}
              href={artworkFileUrl(ultima.pdfUrl)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Descargar PDF
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function GrupoCard({ grupo }) {
  return (
    <div className={styles.grupo}>
      <h4 className={styles.grupoTitle}>
        {grupo.codigo} — {grupo.descripcion || ''}{' '}
        <small className={styles.grupoEstado}>({grupo.estado || 'sin estado'})</small>
      </h4>
      <div className={styles.versiones}>
        {grupo.versiones.map((v, i) => (
          <div className={styles.versionCard} key={i}>
            <div className={styles.thumbSm}>
              <Thumb version={v} grupo={grupo} alt={v.version || ''} />
            </div>
            <div className={styles.vmeta}>
              {v.version && <span className={styles.badge}>{v.version}</span>}
              <span>{v.fecha || '-'}</span>
            </div>
            {v.comentario && <div className={styles.vcoment}>{v.comentario}</div>}
            <a
              className={styles.versionLink}
              href={artworkFileUrl(v.url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {accionLabel(v)}
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
