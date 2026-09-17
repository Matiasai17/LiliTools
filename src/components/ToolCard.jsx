import { Link } from 'react-router-dom'

import Icon from './Icon.jsx'
import styles from './ToolCard.module.css'

/*
 * Tarjeta de herramienta del home. Dos estados según el registry:
 *  - 'available': es un <Link> navegable a /tools/:id, con hover/foco animado.
 *  - 'coming-soon': tarjeta atenuada, NO navegable y NO enfocable como enlace,
 *    con sello "Próximamente". El estado se comunica también con texto (no solo
 *    color), y aria-disabled lo expone a tecnologías de asistencia.
 */
export default function ToolCard({ tool }) {
  const { id, name, description, icon, status, dev, readable } = tool
  const isAvailable = status === 'available'

  const inner = (
    <>
      <span className={styles.iconWrap} aria-hidden="true">
        <Icon name={icon} />
      </span>

      <span className={styles.body}>
        <span className={styles.titleRow}>
          <span className={styles.title}>{name}</span>
          {!isAvailable && <span className={styles.badge}>Próximamente</span>}
          {isAvailable && dev && <span className={styles.badgeDev}>En desarrollo</span>}
        </span>
        <span className={styles.desc}>{description}</span>
      </span>

      {isAvailable && (
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      )}
    </>
  )

  if (isAvailable) {
    return (
      <Link to={`/tools/${id}`} className={styles.card}>
        {inner}
      </Link>
    )
  }

  return (
    <div
      className={`${styles.card} ${styles.disabled} ${readable ? styles.readable : ''}`}
      aria-disabled="true"
    >
      {inner}
      <span className="sr-only">(próximamente, no disponible aún)</span>
    </div>
  )
}
