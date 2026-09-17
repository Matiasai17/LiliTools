import { useOutletContext } from 'react-router-dom'

import ToolCard from '../components/ToolCard.jsx'
import { tools } from '../tools/registry.js'
import styles from './Home.module.css'

/*
 * Nivel de la tarjeta dentro de la grilla: primero las "completas" (sin dev),
 * después las "En desarrollo" (dev: true), y al final las pinnedLast (hoy solo
 * el buscador de artworks). Sort es estable, así que dentro de cada nivel se
 * conserva el orden del registry salvo que haya un rol activo (ver abajo).
 */
function tier(tool) {
  if (tool.pinnedLast) return 2
  if (tool.dev) return 1
  return 0
}

/*
 * Ordena las tarjetas: primero por nivel (tier), y dentro de cada nivel, si
 * hay un rol activo, las del rol elegido van antes que las del otro rol. Sin
 * rol elegido (primera visita, antes de tocar el filtro del header) no se
 * reordena por rol: todas las tarjetas del mismo nivel pesan igual.
 */
function sortTools(list, role) {
  return [...list].sort((a, b) => {
    const tierDiff = tier(a) - tier(b)
    if (tierDiff !== 0) return tierDiff
    if (!role) return 0
    return (a.role === role ? 0 : 1) - (b.role === role ? 0 : 1)
  })
}

/*
 * Home: portada del hub. Renderiza la grilla mapeando el registry, atenuando
 * las tarjetas del rol no activo (filtro elegido en el header vía RoleSwitch).
 * Contempla el estado vacío (registry sin entradas).
 */
export default function Home() {
  const { role } = useOutletContext()
  const hasTools = tools.length > 0
  const orderedTools = sortTools(tools, role)

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
