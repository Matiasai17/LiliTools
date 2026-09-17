import { useEffect, useState } from 'react'

/*
 * Modo oscuro, aplicado a la web completa vía `data-theme` en <html> (ver
 * tokens.css para la paleta oscura). Persistido en localStorage; en la
 * primera visita cae al preference del sistema (prefers-color-scheme).
 *
 * index.html repite esta misma lógica de forma inline (antes de que React
 * monte) para evitar el flash del tema equivocado al cargar la página.
 */

const STORAGE_KEY = 'lilitools-theme'

function getInitialTheme() {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Devuelve `[theme, toggleTheme]`. `theme` es 'light' | 'dark'. */
export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // localStorage puede estar bloqueado (modo privado); el tema sigue
      // funcionando para la sesión actual, solo no se persiste.
    }
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return [theme, toggleTheme]
}
