import { useEffect, useMemo, useRef, useState } from 'react'

import {
  PRODUCTS,
  FLAG_LABELS,
  PALLET,
  isComplete,
  missingFields,
  totalBoxes,
} from './products.js'
import TopView from './TopView.jsx'
import styles from './Palletizing.module.css'

/*
 * Consulta de estándares de paletizado.
 *
 * No calcula nada: muestra el patrón de armado ya validado por planta para cada
 * producto (cajas por piso, pisos, observaciones) y lo acompaña con un render 3D
 * para entenderlo de un vistazo.
 *
 * three.js se carga con import() dinámico: son ~150 KB gzip que no tienen por qué
 * pesar en el bundle del home ni en las demás herramientas.
 */

/** ¿El usuario pidió menos movimiento? Corta la autorrotación de la escena. */
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

export default function Palletizing() {
  const [selectedCode, setSelectedCode] = useState(PRODUCTS[0]?.code ?? '')
  const [sceneStatus, setSceneStatus] = useState('loading') // loading | ready | error
  const [highlight, setHighlight] = useState(null) // null | 'layers' | 'topLayer'

  const containerRef = useRef(null)
  const sceneRef = useRef(null)

  const product = useMemo(
    () => PRODUCTS.find((p) => p.code === selectedCode) ?? PRODUCTS[0],
    [selectedCode],
  )
  const complete = product ? isComplete(product) : false
  const total = product ? totalBoxes(product) : null

  // --- Ciclo de vida de la escena 3D ---
  // Se monta una sola vez y se libera al desmontar: si no, cada visita a la
  // herramienta dejaría un contexto WebGL colgado.
  useEffect(() => {
    let cancelled = false
    let scene = null

    async function init() {
      try {
        const { createPalletScene } = await import('./scene.js')
        if (cancelled || !containerRef.current) return
        scene = createPalletScene(containerRef.current, {
          reducedMotion: prefersReducedMotion(),
        })
        sceneRef.current = scene
        setSceneStatus('ready')
      } catch {
        if (!cancelled) setSceneStatus('error')
      }
    }
    init()

    return () => {
      cancelled = true
      scene?.dispose()
      sceneRef.current = null
    }
  }, [])

  // Reconstruye el pallet cuando cambia el producto (o cuando la escena queda lista).
  useEffect(() => {
    if (sceneStatus !== 'ready' || !product || !complete) return
    sceneRef.current?.setProduct(product)
    setHighlight(null)
  }, [product, complete, sceneStatus])

  // Aplica el resaltado de pisos.
  useEffect(() => {
    if (sceneStatus !== 'ready') return
    sceneRef.current?.setHighlight(highlight)
  }, [highlight, sceneStatus])

  if (!product) {
    return <p className={styles.empty}>No hay estándares cargados todavía.</p>
  }

  return (
    <div className={styles.layout}>
      {/* ----- Escena 3D ----- */}
      <div className={styles.stage}>
        <div ref={containerRef} className={styles.canvasWrap} />

        {sceneStatus === 'loading' && (
          <p className={styles.stageState} role="status">
            Preparando la vista 3D…
          </p>
        )}
        {sceneStatus === 'error' && (
          <p className={styles.stageState} role="status">
            No se pudo iniciar la vista 3D. Los datos del estándar igual están completos
            en el panel.
          </p>
        )}
        {sceneStatus === 'ready' && !complete && (
          <p className={styles.stageState} role="status">
            Este producto no tiene cargado {missingFields(product).join(' ni ')}, así que
            no se puede dibujar el pallet.
          </p>
        )}

        {/* Aviso permanente: el dato es real, la disposición no. */}
        <p className={styles.disclaimer}>
          <b>Disposición 3D ilustrativa.</b> Los totales son el estándar real de la
          planilla; la grilla de cajas es una aproximación (falta cargar medidas de caja).
        </p>

        {sceneStatus === 'ready' && complete && (
          <p className={styles.stageHint}>arrastrá para rotar · rueda para acercar</p>
        )}
      </div>

      {/* ----- Panel de datos ----- */}
      <div className={styles.panel}>
        <fieldset className={styles.selector}>
          <legend className={styles.legend}>Producto</legend>
          <div className={styles.chips} role="radiogroup" aria-label="Producto">
            {PRODUCTS.map((p) => (
              <label
                key={p.code}
                className={`${styles.chip} ${
                  p.code === product.code ? styles.chipActive : ''
                }`}
              >
                <input
                  type="radio"
                  name="palletizing-product"
                  value={p.code}
                  checked={p.code === product.code}
                  onChange={() => setSelectedCode(p.code)}
                  className="sr-only"
                />
                <span>{p.code}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.specHead}>
          <h2 className={styles.code}>{product.code}</h2>
          <span className={styles.flag} data-flag={product.flag}>
            {FLAG_LABELS[product.flag] ?? product.flag}
          </span>
        </div>

        {complete ? (
          <>
            <div className={styles.total}>
              <p className={styles.totalNumber}>
                {total}
                <span className={styles.totalUnit}>cajas</span>
              </p>
              <p className={styles.totalLabel}>por pallet armado</p>
            </div>

            <div className={styles.stats}>
              {/* Al pasar el mouse se resalta en el 3D lo que nombra cada dato. */}
              <div
                className={styles.stat}
                onMouseEnter={() => setHighlight('topLayer')}
                onMouseLeave={() => setHighlight(null)}
              >
                <span className={styles.statValue}>{product.boxesPerLayer}</span>
                <span className={styles.statKey}>cajas por piso</span>
              </div>
              <div
                className={styles.stat}
                onMouseEnter={() => setHighlight('layers')}
                onMouseLeave={() => setHighlight(null)}
              >
                <span className={styles.statValue}>{product.layers}</span>
                <span className={styles.statKey}>pisos por pallet</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{product.unitsPerBox ?? '—'}</span>
                <span className={styles.statKey}>u. por bulto</span>
              </div>
            </div>

            <TopView boxesPerLayer={product.boxesPerLayer} />
          </>
        ) : (
          <p className={styles.empty}>
            El estándar de <b>{product.code}</b> está incompleto: falta cargar{' '}
            {missingFields(product).join(' y ')}.
          </p>
        )}

        {product.note && (
          <div className={styles.note}>
            <span className={styles.noteKey}>Observación de armado</span>
            <p className={styles.noteText}>{product.note}</p>
          </div>
        )}

        <p className={styles.standard}>
          Pallet estándar: <b>1,20 × 1,00 m</b> · altura aprox.{' '}
          <b>{PALLET.approxHeight.toFixed(2).replace('.', ',')} m</b>.
        </p>
      </div>
    </div>
  )
}
