import { useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { useRole } from '../hooks/useRole.js'
import { useTheme } from '../hooks/useTheme.js'
import SuggestionPanel from './SuggestionPanel.jsx'
import styles from './Layout.module.css'
import logoUrl from '/logo.svg'

const ROLE_TABS = [
  { value: 'diseñador', label: 'Diseño' },
  { value: 'ingeniero', label: 'Ingeniería' },
]

/*
 * Layout compartido del hub: header estable con el logo (enlace al home) +
 * área de contenido donde se monta cada vista. El `key` por pathname en <main>
 * dispara la minianimación de entrada de vista (atenuada con reduced-motion).
 */
export default function Layout() {
  const location = useLocation()
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [theme, toggleTheme] = useTheme()
  const [role, setRole] = useRole()
  const isDark = theme === 'dark'

  return (
    <div className={styles.app}>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand} aria-label="LiliTools — ir al inicio">
            <img src={logoUrl} alt="Liliana" className={styles.logo} />
          </Link>

          <div className={styles.actions}>
            <RoleTabs role={role} onChange={setRole} />
            <button
              type="button"
              className={styles.themeToggle}
              onClick={toggleTheme}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-pressed={isDark}
              title={isDark ? 'Modo claro' : 'Modo oscuro'}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button type="button" className={styles.suggest} onClick={() => setSuggestOpen(true)}>
              Sugerí una mejora
            </button>
          </div>
        </div>
      </header>

      <SuggestionPanel open={suggestOpen} onClose={() => setSuggestOpen(false)} />

      <main id="main" className={styles.main} key={location.pathname}>
        <div className={styles.content}>
          <Outlet context={{ role }} />
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>LiliTools — herramientas de Liliana</span>
          <a
            href="https://wa.me/5493435462568"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.developerLink}
          >
            Developer: Matias Medrano
          </a>
        </div>
      </footer>
    </div>
  )
}

/*
 * Selector de rol del home, con semántica de tabs (tablist/tab) navegable por
 * teclado: ←/→ mueven el foco y activan el rol (roving tabindex, activación
 * automática). No hay tabpanel dedicado porque filtra tarjetas en el home en
 * vez de alternar entre paneles separados; por eso `aria-controls` apunta al
 * grid de herramientas cuando existe, y no pasa nada si la ruta actual no lo
 * tiene montado (por ejemplo, dentro de una herramienta).
 */
function RoleTabs({ role, onChange }) {
  const tabRefs = useRef({})

  function focusAndSelect(value) {
    onChange(value)
    tabRefs.current[value]?.focus()
  }

  function handleKeyDown(event, index) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const dir = event.key === 'ArrowRight' ? 1 : -1
    const next = ROLE_TABS[(index + dir + ROLE_TABS.length) % ROLE_TABS.length]
    focusAndSelect(next.value)
  }

  return (
    <div className={styles.roleTabs} role="tablist" aria-label="Filtrar herramientas por rol">
      {ROLE_TABS.map((tab, index) => {
        const selected = role === tab.value
        // Sin rol elegido todavía, el primer tab queda en el orden de tabulación
        // (guía WAI-ARIA APG para tabs sin selección inicial).
        const isTabbable = selected || (!role && index === 0)

        return (
          <button
            key={tab.value}
            ref={(el) => {
              tabRefs.current[tab.value] = el
            }}
            type="button"
            role="tab"
            id={`role-tab-${tab.value}`}
            aria-selected={selected}
            aria-controls="home-tools-grid"
            tabIndex={isTabbable ? 0 : -1}
            className={`${styles.roleTab} ${selected ? styles.roleTabActive : ''}`}
            onClick={() => focusAndSelect(tab.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

/* ----- Íconos inline (stroke = currentColor), al estilo de components/Icon.jsx ----- */

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
    </svg>
  )
}
