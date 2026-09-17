import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { DEFAULTS, NATIONAL_SIZES } from './config.js'
import { buildLabelSvg, buildLabelSvgOutlined, labelHasOverflow } from './label-svg.js'
import { buildLabelPdf } from './label-pdf.js'
import { loadLabelFonts } from './fonts.js'
import { buildFilename, triggerDownload, validateLabelData } from './utils.js'
import { parseLabelWorkbook, downloadTemplate, downloadLabelsZip } from './batch.js'
import SpecPanel from './SpecPanel.jsx'
import styles from './LabelGenerator.module.css'

/*
 * Generador de etiquetas de producto Liliana.
 * Reconstrucción nativa (React + CSS Modules) de Et.art/v7, con paridad funcional.
 *
 * - Modo individual: formulario + preview en vivo (etiqueta SVG + rótulo) + export
 *   SVG/PDF vectorial (texto en trazos, no depende de fuentes del sistema — igual
 *   filosofía que qr-generator), export SVG editable, e impresión del A4 vía
 *   window.print().
 * - Modo lote: importar Excel, validar por fila, imprimir todas o descargar un
 *   .zip con el SVG + PDF de cada etiqueta válida.
 *
 * ToolView.jsx ya provee "Volver al inicio", título y descripción.
 */

const NATIONAL_OPTIONS = [
  ['28x19', '28 × 19 mm (estándar)'],
  ['44x24', '44 × 24 mm'],
  ['40x18', '40 × 18 mm'],
  ['38x22', '38 × 22 mm'],
  ['55x20', '55 × 20 mm'],
]

const SWATCHES = [
  { value: 'negro-blanco', label: 'Blanco', bg: '#ffffff', border: '#cccccc' },
  { value: 'gris-negro', label: 'Gris', bg: '#d0d0d0', border: '#aaaaaa' },
  { value: 'negro-negro', label: 'Negro', bg: '#111111' },
  { value: 'rojo-blanco', label: '485 C', bg: '#da291c' },
]

const SPEC_WIDTH_PX = 170 * 3.7795 // 170mm en px CSS (≈96dpi)
const ZOOM_MIN = 0.5
const ZOOM_MAX = 8

/** Resuelve ancho/alto (mm) según modo, dejando el modelo listo para renderizar. */
function resolveSize(form) {
  if (form.modoImportado) {
    return { ancho: parseFloat(form.ancho) || 40, alto: parseFloat(form.alto) || 24 }
  }
  const sz = NATIONAL_SIZES[form.tamanoNacional] || NATIONAL_SIZES['28x19']
  return { ancho: sz.w, alto: sz.h }
}

/* Etiqueta como SVG inline (mismo SVG que se exporta → WYSIWYG). */
function LabelSvg({ data, className }) {
  const svg = useMemo(() => buildLabelSvg(data), [data])
  return <div className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}

/* Escala su contenido (de ancho natural `width` px) para entrar en el contenedor. */
function ScaledBox({ width, className, children }) {
  const wrapRef = useRef(null)
  const innerRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const wrap = wrapRef.current
    const inner = innerRef.current
    if (!wrap || !inner) return
    const update = () => {
      const s = Math.min(1, wrap.clientWidth / width)
      setScale(s)
      setHeight(inner.offsetHeight * s)
    }
    const ro = new ResizeObserver(update)
    ro.observe(wrap)
    ro.observe(inner)
    update()
    return () => ro.disconnect()
  }, [width])

  return (
    <div ref={wrapRef} className={className} style={{ height }}>
      <div
        ref={innerRef}
        style={{ width, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  )
}

/* Una hoja A4 imprimible: rótulo + etiqueta (igual que el documento del original). */
function PrintSheet({ data }) {
  return (
    <div className={styles.sheet}>
      <SpecPanel data={data} />
      <div className={styles.sheetLabel}>
        <LabelSvg data={data} />
      </div>
    </div>
  )
}

const A4_W = 210
const A4_H = 297

/* Hoja A4 con la etiqueta sola, ubicada en un punto concreto del papel. */
function PositionedSheet({ data, pos }) {
  return (
    <div className={styles.sheetPositioned}>
      <div className={styles.positionedLabel} style={{ left: `${pos.x}mm`, top: `${pos.y}mm` }}>
        <LabelSvg data={data} />
      </div>
    </div>
  )
}

/*
 * Mapa de la hoja A4 para ubicar la etiqueta antes de imprimir.
 *
 * Caso de uso: reaprovechar una hoja autoadhesiva a la que ya le recortaron
 * etiquetas. Se arrastra la etiqueta hasta una zona todavía libre del papel.
 * Coordenadas en mm desde el borde superior izquierdo de la hoja física.
 */
function SheetPlacer({ w, h, pos, onChange }) {
  const mapRef = useRef(null)
  const dragRef = useRef(null)

  const maxX = Math.max(0, A4_W - w)
  const maxY = Math.max(0, A4_H - h)
  const clamp = (x, y) => ({
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  })

  function pointerToMm(e) {
    const r = mapRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * A4_W,
      y: ((e.clientY - r.top) / r.height) * A4_H,
    }
  }

  function handlePointerDown(e) {
    const p = pointerToMm(e)
    dragRef.current = { dx: p.x - pos.x, dy: p.y - pos.y }
    // La captura es una mejora (seguir el puntero fuera del elemento), no un
    // requisito: si falla, el arrastre igual funciona.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignorado */
    }
  }
  function handlePointerMove(e) {
    if (!dragRef.current) return
    const p = pointerToMm(e)
    onChange(clamp(p.x - dragRef.current.dx, p.y - dragRef.current.dy))
  }
  function handlePointerUp(e) {
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
      /* ignorado */
    }
  }

  // Ajuste fino por teclado: 1 mm, o 5 mm con Shift.
  function handleKeyDown(e) {
    const step = e.shiftKey ? 5 : 1
    const moves = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const m = moves[e.key]
    if (!m) return
    e.preventDefault()
    onChange(clamp(pos.x + m[0], pos.y + m[1]))
  }

  return (
    <div className={styles.placer}>
      <div ref={mapRef} className={styles.sheetMap} aria-hidden="true">
        <div
          className={styles.sheetMapLabel}
          style={{
            left: `${(pos.x / A4_W) * 100}%`,
            top: `${(pos.y / A4_H) * 100}%`,
            width: `${(w / A4_W) * 100}%`,
            height: `${(h / A4_H) * 100}%`,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-hidden="false"
          aria-label={`Posición de la etiqueta en la hoja: ${Math.round(pos.x)} mm desde la izquierda, ${Math.round(pos.y)} mm desde arriba. Movela con las flechas.`}
        />
      </div>
      <div className={styles.placerFields}>
        <Field label="Desde izq. (mm)">
          <input
            className={styles.input}
            type="number"
            min="0"
            max={Math.floor(maxX)}
            value={Math.round(pos.x)}
            onChange={(e) => onChange(clamp(parseFloat(e.target.value) || 0, pos.y))}
          />
        </Field>
        <Field label="Desde arriba (mm)">
          <input
            className={styles.input}
            type="number"
            min="0"
            max={Math.floor(maxY)}
            value={Math.round(pos.y)}
            onChange={(e) => onChange(clamp(pos.x, parseFloat(e.target.value) || 0))}
          />
        </Field>
      </div>
    </div>
  )
}

export default function LabelGenerator() {
  const [mode, setMode] = useState('individual') // 'individual' | 'batch'
  const [form, setForm] = useState({ ...DEFAULTS })
  const [zoom, setZoom] = useState(3)
  const [exportBusy, setExportBusy] = useState(null) // null | 'svg' | 'pdf' | 'svg-editable'
  const [exportError, setExportError] = useState('')

  // Impresión individual ubicada en la hoja (para reusar autoadhesivos recortados).
  const [placeOnSheet, setPlaceOnSheet] = useState(false)
  const [sheetPos, setSheetPos] = useState({ x: 10, y: 10 })

  // Lote
  const [batchRows, setBatchRows] = useState([])
  const [batchStatus, setBatchStatus] = useState('idle') // idle | loading | ready | error
  const [batchError, setBatchError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [zipBusy, setZipBusy] = useState(false)
  const [zipProgress, setZipProgress] = useState(null) // { done, total } | null
  const [zipError, setZipError] = useState('')

  const renderData = useMemo(() => ({ ...form, ...resolveSize(form) }), [form])
  const errors = useMemo(() => validateLabelData(renderData), [renderData])
  // En 40×18 y 55×20 el texto no puede bajar de 5 pt; si a ese tamaño el
  // contenido no entra a lo alto, se avisa para revisar la etiqueta a mano.
  const overflow = useMemo(
    () => errors.length === 0 && labelHasOverflow(renderData),
    [renderData, errors],
  )
  const imported = !!form.modoImportado

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }))
  }

  // ----- Export individual -----
  // SVG/PDF vectorial (texto en trazos): no depende de fuentes del sistema, no
  // se rompe al abrirlo en Illustrator. Es la exportación recomendada.
  async function downloadOutlined(kind) {
    setExportError('')
    setExportBusy(kind)
    try {
      const fonts = await loadLabelFonts()
      if (kind === 'svg') {
        const svg = buildLabelSvgOutlined(renderData, fonts)
        triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${buildFilename(renderData)}.svg`)
      } else {
        const pdfBlob = await buildLabelPdf(renderData, fonts)
        triggerDownload(pdfBlob, `${buildFilename(renderData)}.pdf`)
      }
    } catch (err) {
      setExportError(err?.message || 'No se pudo generar el archivo. Probá de nuevo.')
    } finally {
      setExportBusy(null)
    }
  }

  // SVG con texto real (<text>), editable en Illustrator pero depende de que el
  // sistema tenga una fuente Helvetica/Arial instalada. Opción secundaria.
  function downloadSvgEditable() {
    const svg = buildLabelSvg(renderData)
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    triggerDownload(blob, `${buildFilename(renderData)}_editable.svg`)
  }

  function printDoc() {
    const prev = document.title
    document.title = buildFilename(renderData)
    window.print()
    window.setTimeout(() => {
      document.title = prev
    }, 1000)
  }

  // ----- Lote -----
  async function handleFile(file) {
    if (!file) return
    setBatchStatus('loading')
    setBatchError('')
    try {
      const buf = await file.arrayBuffer()
      const rows = await parseLabelWorkbook(buf)
      setBatchRows(rows)
      setBatchStatus('ready')
    } catch (err) {
      setBatchRows([])
      setBatchError(err?.message || 'No se pudo leer el archivo. Verificá que sea un Excel válido.')
      setBatchStatus('error')
    }
  }

  function editRow(data) {
    // Carga la fila en el formulario individual para ajustarla / exportarla.
    const next = { ...DEFAULTS, ...data }
    if (!next.modoImportado) {
      // Mapear ancho/alto a un preset si coincide, para el select nacional.
      const match = Object.entries(NATIONAL_SIZES).find(
        ([, s]) => s.w === Number(data.ancho) && s.h === Number(data.alto),
      )
      next.tamanoNacional = match ? match[0] : DEFAULTS.tamanoNacional
    }
    setForm(next)
    setMode('individual')
  }

  const validRows = batchRows.filter((r) => r.errors.length === 0)
  const errorCount = batchRows.length - validRows.length
  const printDataList = mode === 'individual' ? [renderData] : validRows.map((r) => r.data)

  async function downloadZip() {
    setZipError('')
    setZipBusy(true)
    setZipProgress({ done: 0, total: validRows.length })
    try {
      await downloadLabelsZip(
        validRows.map((r) => r.data),
        (done, total) => setZipProgress({ done, total }),
      )
    } catch (err) {
      setZipError(err?.message || 'No se pudo generar el .zip. Probá de nuevo.')
    } finally {
      setZipBusy(false)
      setZipProgress(null)
    }
  }

  return (
    <div className={styles.tool}>
      {/* Tabs de modo */}
      <div className={styles.tabs} role="tablist" aria-label="Modo de carga">
        <button
          role="tab"
          aria-selected={mode === 'individual'}
          className={`${styles.tab} ${mode === 'individual' ? styles.tabActive : ''}`}
          onClick={() => setMode('individual')}
        >
          Una por vez
        </button>
        <button
          role="tab"
          aria-selected={mode === 'batch'}
          className={`${styles.tab} ${mode === 'batch' ? styles.tabActive : ''}`}
          onClick={() => setMode('batch')}
        >
          Por lote (Excel)
        </button>
      </div>

      {mode === 'individual' ? (
        <div className={styles.layout}>
          {/* ---- Formulario ---- */}
          <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Modo</legend>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={imported}
                  onChange={(e) => setField('modoImportado', e.target.checked)}
                />
                <span>Producto importado</span>
              </label>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Documento</legend>
              {!imported && (
                <Field label="Código de insumo">
                  <input
                    className={styles.input}
                    type="text"
                    value={form.codigo}
                    onChange={(e) => setField('codigo', e.target.value)}
                  />
                </Field>
              )}
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

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Producto</legend>
              <Field label="Artículo">
                <input
                  className={styles.input}
                  type="text"
                  value={form.articulo}
                  onChange={(e) => setField('articulo', e.target.value)}
                />
              </Field>
              <Field label="Descripción">
                <input
                  className={styles.input}
                  type="text"
                  value={form.descripcion}
                  onChange={(e) => setField('descripcion', e.target.value)}
                />
              </Field>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Tamaño de etiqueta</legend>
              {!imported ? (
                <Field label="Tamaño estándar">
                  <select
                    className={styles.input}
                    value={form.tamanoNacional}
                    onChange={(e) => setField('tamanoNacional', e.target.value)}
                  >
                    {NATIONAL_OPTIONS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <div className={styles.row}>
                  <Field label="Ancho (mm)">
                    <input
                      className={styles.input}
                      type="number"
                      min="1"
                      max="500"
                      step="0.5"
                      value={form.ancho}
                      onChange={(e) => setField('ancho', e.target.value)}
                    />
                  </Field>
                  <Field label="Alto (mm)">
                    <input
                      className={styles.input}
                      type="number"
                      min="1"
                      max="500"
                      step="0.5"
                      value={form.alto}
                      onChange={(e) => setField('alto', e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Especificaciones eléctricas</legend>
              <div className={styles.row}>
                <Field label="V mín">
                  <input className={styles.input} type="number" value={form.voltMin} onChange={(e) => setField('voltMin', e.target.value)} />
                </Field>
                {/* Vacío = tensión única (ej. 220 V), sin guion colgado. */}
                <Field label="V máx">
                  <input className={styles.input} type="number" value={form.voltMax} onChange={(e) => setField('voltMax', e.target.value)} placeholder="vacío = 220 V" />
                </Field>
              </div>
              <div className={styles.row}>
                <Field label="Hz mín">
                  <input className={styles.input} type="number" value={form.hzMin} onChange={(e) => setField('hzMin', e.target.value)} />
                </Field>
                <Field label="Hz máx">
                  <input className={styles.input} type="number" value={form.hzMax} onChange={(e) => setField('hzMax', e.target.value)} placeholder="vacío = 50 Hz" />
                </Field>
              </div>
              <Field label="Potencia (W)">
                <input className={styles.input} type="text" value={form.potencia} onChange={(e) => setField('potencia', e.target.value)} placeholder="1500/3000" />
              </Field>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Impresión</legend>
              <Field label="Impresión (texto del rótulo)">
                <input className={styles.input} type="text" value={form.impresion} onChange={(e) => setField('impresion', e.target.value)} />
              </Field>
              <div className={styles.field}>
                <span className={styles.label}>Color de fondo</span>
                <div className={styles.swatches} role="radiogroup" aria-label="Color de fondo">
                  {SWATCHES.map((s) => (
                    <label
                      key={s.value}
                      className={`${styles.swatch} ${form.colorImpresion === s.value ? styles.swatchActive : ''}`}
                    >
                      <input
                        type="radio"
                        name="colorImpresion"
                        value={s.value}
                        checked={form.colorImpresion === s.value}
                        onChange={() => setField('colorImpresion', s.value)}
                        className="sr-only"
                      />
                      <span
                        className={styles.swatchDisk}
                        style={{ background: s.bg, borderColor: s.border || s.bg }}
                      />
                      <span className={styles.swatchLabel}>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className={styles.check}>
                <input type="checkbox" checked={!!form.claseII} onChange={(e) => setField('claseII', e.target.checked)} />
                <span>Doble aislamiento (Clase II)</span>
              </label>
            </fieldset>

            {imported && (
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Datos de fabricación</legend>
                <Field label="País de fabricación">
                  <input className={styles.input} type="text" value={form.paisFabricacion} onChange={(e) => setField('paisFabricacion', e.target.value)} />
                </Field>
                <Field label="Nota al proveedor (opcional)">
                  <input className={styles.input} type="text" value={form.supplierNote} onChange={(e) => setField('supplierNote', e.target.value)} placeholder="Ej: Regulatory text required by law" />
                </Field>
              </fieldset>
            )}
          </form>

          {/* ---- Preview + acciones ---- */}
          <div className={styles.previewCol}>
            <div className={styles.stageToolbar}>
              <span className={styles.stageTitle}>Etiqueta</span>
              <div className={styles.zoomControls} aria-label="Zoom">
                <button type="button" className={styles.zoomBtn} onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z / 1.25))} aria-label="Alejar">−</button>
                <button type="button" className={styles.zoomBtn} onClick={() => setZoom(3)} aria-label="Ajustar">⊡</button>
                <button type="button" className={styles.zoomBtn} onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z * 1.25))} aria-label="Acercar">+</button>
              </div>
            </div>

            <div className={styles.stage}>
              <div style={{ transform: `scale(${zoom})` }} className={styles.stageInner}>
                <LabelSvg data={renderData} className={styles.labelBox} />
              </div>
            </div>

            <div className={styles.specPreview}>
              <span className={styles.stageTitle}>Rótulo (para imprenta)</span>
              <ScaledBox width={SPEC_WIDTH_PX} className={styles.specScaler}>
                <SpecPanel data={renderData} />
              </ScaledBox>
            </div>

            {errors.length > 0 && (
              <div className={styles.warn} role="status" aria-live="polite">
                Revisá: {errors.join(' · ')}
              </div>
            )}

            {overflow && (
              <div className={styles.warn} role="status" aria-live="polite">
                En este tamaño el texto no baja de 5 pt (mínimo de imprenta) y, a ese
                tamaño, el contenido no entra cómodo. Revisá la etiqueta: puede quedar
                apretada o pisar el pie. Conviene acortar la descripción o usar un tamaño
                más grande.
              </div>
            )}

            {exportError && (
              <div className={styles.warn} role="status" aria-live="polite">
                {exportError}
              </div>
            )}

            <div className={styles.placeBlock}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={placeOnSheet}
                  onChange={(e) => setPlaceOnSheet(e.target.checked)}
                />
                <span>Ubicar la etiqueta en la hoja al imprimir</span>
              </label>
              {placeOnSheet && (
                <>
                  <p className={styles.hint}>
                    Para reaprovechar una hoja autoadhesiva ya recortada: arrastrá la etiqueta
                    hasta una zona libre del papel. Se imprime sola, sin el rótulo. La posición
                    se mide desde el borde de la hoja, así que imprimí al 100% (sin “ajustar a
                    página”) y con márgenes en “ninguno”.
                  </p>
                  <SheetPlacer
                    w={Number(renderData.ancho) || 0}
                    h={Number(renderData.alto) || 0}
                    pos={sheetPos}
                    onChange={setSheetPos}
                  />
                </>
              )}
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => downloadOutlined('svg')}
                disabled={exportBusy !== null}
              >
                {exportBusy === 'svg' ? 'Generando…' : 'Descargar SVG'}
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => downloadOutlined('pdf')}
                disabled={exportBusy !== null}
              >
                {exportBusy === 'pdf' ? 'Generando…' : 'Descargar PDF'}
              </button>
              <button type="button" className={styles.btnSecondary} onClick={printDoc}>
                Imprimir
              </button>
              <button type="button" className={styles.btnLink} onClick={downloadSvgEditable}>
                SVG editable (texto)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <BatchPanel
          status={batchStatus}
          error={batchError}
          rows={batchRows}
          validCount={validRows.length}
          errorCount={errorCount}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          onFile={handleFile}
          onEditRow={editRow}
          onPrintAll={() => window.print()}
          onDownloadZip={downloadZip}
          zipBusy={zipBusy}
          zipProgress={zipProgress}
          zipError={zipError}
        />
      )}

      {/* Área de impresión (portal a <body>): solo visible al imprimir. */}
      {createPortal(
        <div className={styles.printArea}>
          {mode === 'individual' && placeOnSheet ? (
            <PositionedSheet data={renderData} pos={sheetPos} />
          ) : (
            printDataList.map((d, i) => <PrintSheet key={i} data={d} />)
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}

/* ---- Subcomponentes ---- */

function Field({ label, children }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  )
}

function BatchPanel({
  status,
  error,
  rows,
  validCount,
  errorCount,
  isDragging,
  setIsDragging,
  onFile,
  onEditRow,
  onPrintAll,
  onDownloadZip,
  zipBusy,
  zipProgress,
  zipError,
}) {
  return (
    <div className={styles.batch}>
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
          onFile(e.dataTransfer.files?.[0])
        }}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(e) => {
            onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <span className={styles.dropTitle}>
          Arrastrá un Excel o <span className={styles.dropLink}>elegí un archivo</span>
        </span>
        <span className={styles.dropHint}>.xlsx · .xls · .csv</span>
      </label>

      <button type="button" className={styles.btnLink} onClick={() => downloadTemplate()}>
        Descargar plantilla de ejemplo
      </button>

      <div className={styles.batchStatus} role="status" aria-live="polite">
        {status === 'loading' && <span>Leyendo el archivo…</span>}
        {status === 'error' && <span className={styles.warn}>{error}</span>}
        {status === 'ready' && (
          <span>
            {validCount} etiqueta{validCount !== 1 ? 's' : ''} lista{validCount !== 1 ? 's' : ''}
            {errorCount > 0 ? ` · ${errorCount} con error` : ''}
          </span>
        )}
      </div>

      {status === 'ready' && rows.length > 0 && (
        <>
          <div className={styles.batchActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={onDownloadZip}
              disabled={validCount === 0 || zipBusy}
            >
              {zipBusy
                ? `Generando… (${zipProgress?.done ?? 0}/${zipProgress?.total ?? validCount})`
                : `Descargar todo (.zip)`}
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onPrintAll}
              disabled={validCount === 0}
            >
              Imprimir todo ({validCount})
            </button>
          </div>
          {zipError && (
            <div className={styles.warn} role="status" aria-live="polite">
              {zipError}
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Modo</th>
                  <th>Artículo</th>
                  <th>Descripción</th>
                  <th>Dimensiones</th>
                  <th>Color</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ok = r.errors.length === 0
                  return (
                    <tr key={r.index} className={ok ? '' : styles.rowError}>
                      <td>{r.index}</td>
                      <td>{r.data.modoImportado ? 'Importado' : 'Nacional'}</td>
                      <td>{r.data.articulo}</td>
                      <td>{r.data.descripcion}</td>
                      <td>
                        {r.data.ancho}×{r.data.alto} mm
                      </td>
                      <td>{r.data.colorImpresion}</td>
                      <td>{ok ? 'OK' : `Error: ${r.errors.join(', ')}`}</td>
                      <td>
                        <button type="button" className={styles.btnLinkSm} onClick={() => onEditRow(r.data)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
