import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import './styles/tokens.css'
import './styles/global.css'
import App from './App.jsx'

const routerBaseName = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* BrowserRouter = rutas limpias (/tools/:id). `basename` permite servir la
        misma app desde subcarpetas como /LiliTools/ en GitHub Pages. */}
    <BrowserRouter basename={routerBaseName}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
