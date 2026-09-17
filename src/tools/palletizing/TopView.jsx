import { gridFor } from './grid.js'
import { PALLET } from './products.js'
import styles from './Palletizing.module.css'

/*
 * Vista de planta (cenital) de UN piso.
 *
 * Complementa al 3D: "cajas por piso" es el número que más se consulta, y de
 * frente cuesta contarlo. Usa exactamente la misma grilla ilustrativa que la
 * escena 3D (gridFor), así que ambas vistas siempre coinciden.
 */
export default function TopView({ boxesPerLayer }) {
  const { rows, cols } = gridFor(boxesPerLayer)

  // Coordenadas en cm para que el viewBox sea legible; el pallet va en metros.
  const W = PALLET.length * 100
  const H = PALLET.width * 100
  const gap = 1.2
  const cellW = (W - gap * (cols + 1)) / cols
  const cellH = (H - gap * (rows + 1)) / rows

  const cells = []
  let placed = 0
  for (let r = 0; r < rows && placed < boxesPerLayer; r++) {
    for (let c = 0; c < cols && placed < boxesPerLayer; c++) {
      cells.push({
        key: `${r}-${c}`,
        x: gap + c * (cellW + gap),
        y: gap + r * (cellH + gap),
      })
      placed++
    }
  }

  return (
    <figure className={styles.topView}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.topViewSvg}
        role="img"
        aria-label={`Vista de planta ilustrativa: ${boxesPerLayer} cajas en un piso, dispuestas en ${rows} filas por ${cols} columnas sobre un pallet de 1,20 por 1,00 metros.`}
      >
        <rect x="0" y="0" width={W} height={H} className={styles.topViewDeck} rx="1.5" />
        {cells.map((cell) => (
          <rect
            key={cell.key}
            x={cell.x}
            y={cell.y}
            width={cellW}
            height={cellH}
            rx="1"
            className={styles.topViewBox}
          />
        ))}
      </svg>
      <figcaption className={styles.topViewCaption}>
        Planta de un piso · {rows} × {cols} aprox.
      </figcaption>
    </figure>
  )
}
