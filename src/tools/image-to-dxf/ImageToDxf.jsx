import { useEffect, useMemo, useRef, useState } from 'react'

import { imageToBinary, traceBinary, countNodes } from './vectorize.js'
import { buildDxf, dxfBlob } from './dxf.js'
import styles from './ImageToDxf.module.css'

/*
 * Imagen a DXF para Láser — 100% client-side.
 *
 * Convierte una imagen simple (logo, silueta, ícono, dibujo de alto contraste) en
 * un DXF vectorial: la rasteriza en un canvas, la binariza con un umbral ajustable
 * y traza los contornos con marching squares (ver vectorize.js). El resultado es
 * geometría real (polilíneas), nunca una imagen embebida.
 *
 * ToolView.jsx ya renderiza "Volver", el título y la descripción; este componente
 * aporta solo la UI interactiva.
 */

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const ACCEPTED_LABEL = 'PNG, JPG o WebP'
const MAX_MB = 15
const MAX_BYTES = MAX_MB * 1024 * 1024
const OUTPUT_NAME = 'imagen-a-dxf-laser.dxf'

// Umbral de nodos por encima del cual avisamos que el archivo puede salir pesado/sucio.
const HEAVY_NODES = 6000

function validateFile(file) {
  if (!file) return 'No se pudo leer el archivo.'
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return `Ese formato no está soportado. Usá ${ACCEPTED_LABEL}.`
  }
  if (file.size > MAX_BYTES) {
    return `La imagen pesa demasiado. El límite es ${MAX_MB} MB.`
  }
  return ''
}

export default function ImageToDxf() {
  const [image, setImage] = useState(null) // HTMLImageElement cargado
  const [originalUrl, setOriginalUrl] = useState('')
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const [threshold, setThreshold] = useState(128)
  const [invert, setInvert] = useState(false)
  const [widthMm, setWidthMm] = useState(100)

  const [paths, setPaths] = useState([])
  const [srcSize, setSrcSize] = useState({ w: 0, h: 0 })

  const urlRef = useRef('')

  // Limpia el object URL vivo al desmontar (evita fugas de memoria).
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  function loadFile(file) {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')

    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(file)
    urlRef.current = url
    setOriginalUrl(url)

    const img = new Image()
    img.onload = () => setImage(img)
    img.onerror = () => setError('No se pudo abrir la imagen. Probá con otro archivo.')
    img.src = url
  }

  // Recalcula binarización + trazado cuando cambia la imagen o los parámetros de
  // procesamiento. Debounce chico para que el slider de umbral se sienta fluido.
  useEffect(() => {
    if (!image) {
      setPaths([])
      return
    }
    const id = setTimeout(() => {
      try {
        const grid = imageToBinary(image, { threshold, invert })
        const traced = traceBinary(grid, { epsilon: 0.9 })
        setSrcSize({ w: grid.srcW, h: grid.srcH })
        setPaths(traced)
        setError('')
      } catch {
        setError('No se pudo procesar la imagen. Probá con otra.')
        setPaths([])
      }
    }, 120)
    return () => clearTimeout(id)
  }, [image, threshold, invert])

  const nodeCount = useMemo(() => countNodes(paths), [paths])
  const isHeavy = nodeCount > HEAVY_NODES

  // Path SVG de la vista previa vectorial (coordenadas en px de la imagen reducida).
  const svgPath = useMemo(() => {
    return paths
      .map((p) => {
        const d = p.points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
        return p.closed ? `${d} Z` : d
      })
      .join(' ')
  }, [paths])

  function handleInputChange(e) {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
    e.target.value = '' // permite volver a elegir el mismo archivo
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) loadFile(file)
  }

  function reset() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = ''
    setImage(null)
    setOriginalUrl('')
    setPaths([])
    setError('')
    setThreshold(128)
    setInvert(false)
    setWidthMm(100)
  }

  function download() {
    if (!paths.length) return
    const dxf = buildDxf(paths, { srcW: srcSize.w, srcH: srcSize.h, widthMm: Number(widthMm) || 100 })
    const url = URL.createObjectURL(dxfBlob(dxf))
    const a = document.createElement('a')
    a.href = url
    a.download = OUTPUT_NAME
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      URL.revokeObjectURL(url)
      a.remove()
    }, 1000)
  }

  const heightMm = srcSize.w ? ((Number(widthMm) || 0) * srcSize.h) / srcSize.w : 0
  const canDownload = paths.length > 0 && Number(widthMm) > 0

  return (
    <div className={styles.layout}>
      <div className={styles.warningBanner} role="note">
        ⚠️ Funciona mejor con logos, siluetas, íconos y dibujos de alto contraste. Las fotos
        complejas pueden generar demasiados nodos o resultados poco limpios.
      </div>

      {!image ? (
        <>
          <label
            className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={handleInputChange}
              className="sr-only"
            />
            <span className={styles.dropIcon} aria-hidden="true">
              <UploadIcon />
            </span>
            <span className={styles.dropTitle}>
              Arrastrá una imagen o <span className={styles.dropLink}>cargá un archivo</span>
            </span>
            <span className={styles.dropHint}>
              {ACCEPTED_LABEL} · hasta {MAX_MB} MB
            </span>
          </label>

          <p className={styles.privacy}>
            <LockIcon />
            Todo se procesa en tu navegador: la imagen nunca se sube a ningún servidor.
          </p>
        </>
      ) : (
        <div className={styles.workspace}>
          {/* ---- Previews: original + vectorizado ---- */}
          <div className={styles.previews}>
            <figure className={styles.previewCard}>
              <div className={styles.previewFrame}>
                <img className={styles.previewImg} src={originalUrl} alt="Imagen original cargada" />
              </div>
              <figcaption className={styles.previewCaption}>Original</figcaption>
            </figure>

            <figure className={styles.previewCard}>
              <div className={`${styles.previewFrame} ${styles.vectorFrame}`}>
                {paths.length > 0 ? (
                  <svg
                    className={styles.vectorSvg}
                    viewBox={`0 0 ${srcSize.w} ${srcSize.h}`}
                    preserveAspectRatio="xMidYMid meet"
                    role="img"
                    aria-label="Vista previa del contorno vectorizado"
                  >
                    <path d={svgPath} fill="none" stroke="var(--color-accent)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  </svg>
                ) : (
                  <p className={styles.emptyVector}>Ajustá el umbral para detectar el contorno.</p>
                )}
              </div>
              <figcaption className={styles.previewCaption}>Vectorizado (lo que sale al DXF)</figcaption>
            </figure>
          </div>

          {/* ---- Controles ---- */}
          <div className={styles.controls}>
            <div className={styles.control}>
              <div className={styles.controlHead}>
                <label htmlFor="threshold" className={styles.controlLabel}>Umbral</label>
                <span className={styles.controlValue}>{threshold}</span>
              </div>
              <input
                id="threshold"
                type="range"
                min="1"
                max="254"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className={styles.range}
              />
              <label className={styles.checkbox}>
                <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
                Invertir (para trazos claros sobre fondo oscuro)
              </label>
            </div>

            <div className={styles.control}>
              <label htmlFor="widthMm" className={styles.controlLabel}>Ancho final en mm</label>
              <div className={styles.mmRow}>
                <input
                  id="widthMm"
                  type="number"
                  min="1"
                  max="2000"
                  value={widthMm}
                  onChange={(e) => setWidthMm(e.target.value)}
                  className={styles.number}
                />
                <span className={styles.mmHint}>
                  {heightMm > 0 ? `≈ ${heightMm.toFixed(1)} mm de alto` : ''}
                </span>
              </div>
            </div>

            <p className={`${styles.stat} ${isHeavy ? styles.statWarn : ''}`} role="status" aria-live="polite">
              {paths.length} contorno{paths.length === 1 ? '' : 's'} · {nodeCount} nodos
              {isHeavy ? ' — muchos nodos: subí el umbral o usá una imagen más simple.' : ''}
            </p>
          </div>

          {error && (
            <p className={styles.error} role="status" aria-live="polite">{error}</p>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.btnPrimary} onClick={download} disabled={!canDownload}>
              Descargar DXF
            </button>
            <button type="button" className={styles.btnSecondary} onClick={reset}>
              Elegir otra imagen
            </button>
          </div>
        </div>
      )}

      {!image && error && (
        <p className={styles.error} role="status" aria-live="polite">{error}</p>
      )}
    </div>
  )
}

/* ----- Íconos inline (stroke = currentColor), al estilo de components/Icon.jsx ----- */

function UploadIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M21 15v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" />
      <path d="M12 3v13M7 8l5-5 5 5" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}
