import { Link } from 'react-router-dom'

import styles from './NotFound.module.css'

/* Página 404 / herramienta inexistente. Mensaje amable y camino de vuelta claro. */
export default function NotFound() {
  return (
    <section className={styles.wrap}>
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>No encontramos esta herramienta</h1>
      <p className={styles.text}>
        Puede que el enlace esté mal o que la herramienta todavía no esté disponible.
      </p>
      <Link to="/" className={styles.button}>
        Volver al inicio
      </Link>
    </section>
  )
}
