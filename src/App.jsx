import { Routes, Route } from 'react-router-dom'

import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import ToolView from './pages/ToolView.jsx'
import NotFound from './pages/NotFound.jsx'

/*
 * Armazón de rutas (shell). Mínimo y estable:
 *   /                -> home (grilla del catálogo)
 *   /tools/:toolId   -> vista de una herramienta del registry
 *   *                -> 404
 * Layout es compartido (header con logo->home + área de contenido).
 */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="tools/:toolId" element={<ToolView />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
