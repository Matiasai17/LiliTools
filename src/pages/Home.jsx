import { useOutletContext } from 'react-router-dom'

import ToolCard from '../components/ToolCard.jsx'
import { tools } from '../tools/registry.js'
import styles from './Home.module.css'

/*
 * Ordena las tarjetas según el rol activo: las del rol elegido van primero,
 * conservando su orden relativo del registry (sort es estable). Sin rol
 * elegido (primera visita, antes de tocar el filtro del header) no se
 * reordena nada: todas las tarjetas pesan igual.
 */
function sortByRole(list, role) {
  if (!role) return list
  return [...list].sort((a, b) => (a.role === role ? 0 : 1) - (b.role === role ? 0 : 1))
}

/*
 * Home: portada del hub. Renderiza la grilla mapeando el registry, atenuando
 * las tarjetas del rol no activo (filtro elegido en el header vía RoleTabs).
 * Contempla el estado vacío (registry sin entradas).
 */
export default function Home() {
  const { role } = useOutletContext()
  const hasTools = tools.length > 0
  const orderedTools = sortByRole(tools, role)

  return (
    <section>
      <header className={styles.intro}>
        <h1 className={styles.title}>LiliTools</h1>
        <p className={styles.subtitle}>
          Elegí una herramienta para empezar. Sumamos nuevas de a poco.
        </p>
      </header>

      {hasTools ? (
        <ul id="home-tools-grid" className={styles.grid}>
          {orderedTools.map((tool) => {
            const isDimmed = role && tool.role !== role
            return (
              <li
                key={tool.id}
                className={`${styles.gridItem} ${isDimmed ? styles.gridItemDim : ''}`}
              >
                <ToolCard tool={tool} />
              </li>
            )
          })}
        </ul>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Todavía no hay herramientas</p>
          <p className={styles.emptyText}>
            Estamos preparando las primeras utilidades. Volvé pronto.
          </p>
        </div>
      )}
    </section>
  )
}
