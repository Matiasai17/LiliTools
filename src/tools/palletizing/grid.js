import { PALLET } from './products.js'

/*
 * Grilla ILUSTRATIVA de un piso.
 *
 * Portado de la demo (paletizado-demo.html). Partimos las N cajas de un piso en
 * filas × columnas buscando celdas lo más cuadradas posible sobre el pallet y
 * con el mínimo de huecos.
 *
 * OJO: esto NO es el patrón real de armado. El estándar de planta define cuántas
 * cajas entran por piso, no cómo se acomodan; sin las medidas de caja no se puede
 * reconstruir la disposición real. Por eso la vista se muestra siempre con el
 * aviso de "disposición ilustrativa".
 *
 * @returns {{rows:number, cols:number}} rows -> eje Z, cols -> eje X
 */
export function gridFor(n) {
  let best = null
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    const cellWidth = PALLET.length / cols
    const cellDepth = PALLET.width / rows
    const cellRatio = Math.max(cellWidth, cellDepth) / Math.min(cellWidth, cellDepth)
    const waste = rows * cols - n
    const score = cellRatio + waste * 0.18
    if (!best || score < best.score) best = { rows, cols, score }
  }
  return best ? { rows: best.rows, cols: best.cols } : { rows: 1, cols: 1 }
}
