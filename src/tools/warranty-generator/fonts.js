/*
 * warranty-generator — carga de la fuente usada para vectorizar los pocos
 * campos dinámicos (Artículo, Descripción, pie de página). El resto del
 * documento ya viene vectorizado de fábrica en templates/ (ver el script de
 * conversión offline documentado en el plan de esta herramienta).
 *
 * Arimo es metricamente compatible con Arial/Helvetica; se distribuye bajo
 * Apache License 2.0 (ver fonts/LICENSE.txt). Copia propia (no se importa
 * desde label-generator) para que la herramienta sea autocontenida.
 *
 * `opentype.js` se importa de forma DINÁMICA: solo se descarga cuando el
 * usuario realmente genera una garantía.
 */
import regularUrl from './fonts/arimo-regular.woff?url'
import boldUrl from './fonts/arimo-bold.woff?url'

let cached = null

async function loadFont(opentype, url) {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  return opentype.parse(buf)
}

/** Carga (una sola vez, cacheada) las fuentes para vectorizar los campos dinámicos. */
export function loadWarrantyFonts() {
  if (!cached) {
    cached = import('opentype.js').then(async (mod) => {
      const opentype = mod.default || mod
      const [regular, bold] = await Promise.all([loadFont(opentype, regularUrl), loadFont(opentype, boldUrl)])
      return { regular, bold }
    })
  }
  return cached
}
