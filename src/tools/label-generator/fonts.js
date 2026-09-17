/*
 * label-generator — carga de la fuente usada para vectorizar texto (trazos).
 *
 * Arimo es metricamente compatible con Arial/Helvetica (misma tabla de anchos
 * que usa label-svg.js para el layout), y se distribuye bajo Apache License 2.0
 * (ver fonts/LICENSE.txt) — segura para embeber y redistribuir en un sitio público.
 *
 * `opentype.js` se importa de forma DINÁMICA (como `xlsx` en batch.js): solo se
 * descarga cuando el usuario realmente exporta (SVG en trazos / PDF), no de entrada.
 */
import regularUrl from './fonts/arimo-regular.woff?url'
import boldUrl from './fonts/arimo-bold.woff?url'

let cached = null

async function loadFont(opentype, url) {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  return opentype.parse(buf)
}

/** Carga (una sola vez, cacheada) las fuentes para exportar SVG/PDF en trazos. */
export function loadLabelFonts() {
  if (!cached) {
    cached = import('opentype.js').then(async (mod) => {
      const opentype = mod.default || mod
      const [regular, bold] = await Promise.all([
        loadFont(opentype, regularUrl),
        loadFont(opentype, boldUrl),
      ])
      return {
        regular,
        bold,
        regularAscent: regular.ascender / regular.unitsPerEm,
        boldAscent: bold.ascender / bold.unitsPerEm,
      }
    })
  }
  return cached
}
