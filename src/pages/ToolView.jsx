import { Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getAvailableTool } from '../tools/registry.js'
import NotFound from './NotFound.jsx'
import styles from './ToolView.module.css'

/*
 * Vista de una herramienta. Resuelve :toolId contra el registry y monta su
 * component. Si el id no existe o no está 'available', muestra el 404 (las
 * tarjetas 'coming-soon' no tienen ruta, así que llegar acá es un id inválido).
 *
 * Incluye una sub-cabecera estable con enlace claro para volver al home.
 */
export default function ToolView() {
  const { toolId } = useParams()
  const tool = getAvailableTool(toolId)

  if (!tool) {
    return <NotFound />
  }

  const ToolComponent = tool.component

  return (
    <section>
      <div className={styles.bar}>
        <Link to="/" className={styles.back}>
          <span aria-hidden="true">←</span> Volver al inicio
        </Link>
      </div>

      <header className={styles.head}>
        <h1 className={styles.title}>{tool.name}</h1>
        <p className={styles.desc}>{tool.description}</p>
      </header>

      <Suspense fallback={<p className={styles.loading}>Cargando herramienta…</p>}>
        <ToolComponent />
      </Suspense>
    </section>
  )
}
