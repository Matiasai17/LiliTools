/*
 * image-to-dxf — serialización a DXF ASCII R12 (AC1009), geometría real.
 *
 * Se apunta a máxima compatibilidad con importadores exigentes (Illustrator,
 * software de láser), por eso:
 *   - Entidades POLYLINE/VERTEX/SEQEND clásicas (NO LWPOLYLINE, que es R13+ y
 *     Illustrator importa mal).
 *   - Secciones HEADER + TABLES (capa 0 y tipo de línea CONTINUOUS declarados) +
 *     BLOCKS (vacía) + ENTITIES. Sin la tabla LAYER, Illustrator rechaza el archivo.
 *
 * No se embebe la imagen: el DXF contiene solo vectores.
 */

// $INSUNITS = 4 → milímetros (que el software interprete la escala real).
const INSUNITS_MM = 4

/** HEADER con versión, unidades y extents del dibujo. */
function headerSection(widthMm, heightMm, fmt) {
  return [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1009', // R12
    '9', '$INSUNITS', '70', String(INSUNITS_MM),
    '9', '$EXTMIN', '10', '0.0', '20', '0.0', '30', '0.0',
    '9', '$EXTMAX', '10', fmt(widthMm), '20', fmt(heightMm), '30', '0.0',
    '0', 'ENDSEC',
  ]
}

/** TABLES con LTYPE (CONTINUOUS) y LAYER (0): mínimo que Illustrator exige. */
function tablesSection() {
  return [
    '0', 'SECTION',
    '2', 'TABLES',
    // --- Tipos de línea ---
    '0', 'TABLE',
    '2', 'LTYPE',
    '70', '1',
    '0', 'LTYPE',
    '2', 'CONTINUOUS',
    '70', '0',
    '3', 'Solid line',
    '72', '65',
    '73', '0',
    '40', '0.0',
    '0', 'ENDTAB',
    // --- Capas ---
    '0', 'TABLE',
    '2', 'LAYER',
    '70', '1',
    '0', 'LAYER',
    '2', '0',
    '70', '0',
    '62', '7', // color 7 (blanco/negro)
    '6', 'CONTINUOUS',
    '0', 'ENDTAB',
    '0', 'ENDSEC',
  ]
}

/** BLOCKS vacía: algunos parsers esperan la sección aunque no haya bloques. */
function blocksSection() {
  return ['0', 'SECTION', '2', 'BLOCKS', '0', 'ENDSEC']
}

/**
 * Convierte paths en píxeles (origen arriba-izquierda) a un string DXF en mm.
 *
 * - `paths`: array de `{ points: [[x,y]...], closed }` en px de la imagen reducida.
 * - `srcW` / `srcH`: dimensiones de esa imagen (px), marco de referencia.
 * - `widthMm`: ancho físico final; el alto sale del aspecto de la imagen.
 *
 * El eje Y se invierte (en CAD crece hacia arriba) para que el DXF no salga
 * espejado respecto de la imagen.
 */
export function buildDxf(paths, { srcW, srcH, widthMm }) {
  const scale = widthMm / srcW
  const heightMm = srcH * scale
  const fmt = (n) => n.toFixed(4)

  const lines = [
    ...headerSection(widthMm, heightMm, fmt),
    ...tablesSection(),
    ...blocksSection(),
    '0', 'SECTION',
    '2', 'ENTITIES',
  ]

  for (const path of paths) {
    const pts = path.points
    if (pts.length < 2) continue
    // POLYLINE clásica: cabecera + un VERTEX por punto + SEQEND de cierre.
    lines.push(
      '0', 'POLYLINE',
      '8', '0', // capa 0
      '66', '1', // "siguen vértices" (obligatorio en R12)
      '70', path.closed ? '1' : '0', // bit 1 = polilínea cerrada
      '10', '0.0', '20', '0.0', '30', '0.0', // punto de elevación
    )
    for (const [x, y] of pts) {
      lines.push(
        '0', 'VERTEX',
        '8', '0',
        '10', fmt(x * scale),
        '20', fmt((srcH - y) * scale),
        '30', '0.0',
      )
    }
    lines.push('0', 'SEQEND', '8', '0')
  }

  lines.push('0', 'ENDSEC', '0', 'EOF')
  return lines.join('\r\n')
}

/** Empaqueta el DXF como Blob descargable. */
export function dxfBlob(dxfString) {
  return new Blob([dxfString], { type: 'application/dxf' })
}
