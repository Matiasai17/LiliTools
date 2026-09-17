/*
 * image-to-dxf — motor de vectorización, 100% client-side.
 *
 * Flujo: imagen → canvas → escala de grises → umbral (binario) → contornos por
 * marching squares → polilíneas cerradas → simplificación (Ramer–Douglas–Peucker).
 * Todo puro (salvo `imageToBinary`, que usa un canvas offscreen para leer píxeles).
 *
 * No hay backend ni librerías externas: alcanza con Canvas 2D y geometría simple.
 */

// Techo de resolución para trazar: mantiene el conteo de nodos y el tiempo de
// proceso acotados. Las imágenes más grandes se reescalan a este lado máximo.
export const MAX_TRACE_DIM = 1000

/**
 * Rasteriza `img` (HTMLImageElement ya cargado) en un canvas reducido y devuelve
 * una grilla binaria: 1 = trazo (se corta/graba), 0 = fondo.
 *
 * - `threshold` (0–255): brillo por debajo del cual el píxel se considera trazo.
 * - `invert`: invierte la relación trazo/fondo (para logos claros sobre oscuro).
 * - Los píxeles transparentes se tratan como fondo.
 *
 * La grilla viene con un borde de 1px de fondo (padding) para que las formas que
 * tocan el borde de la imagen cierren su contorno. `w`/`h` incluyen ese padding;
 * `srcW`/`srcH` son las dimensiones útiles (sin padding), base para escalar a mm.
 */
export function imageToBinary(img, { threshold = 128, invert = false } = {}) {
  const natW = img.naturalWidth || img.width
  const natH = img.naturalHeight || img.height
  const scale = Math.min(1, MAX_TRACE_DIM / Math.max(natW, natH))
  const srcW = Math.max(1, Math.round(natW * scale))
  const srcH = Math.max(1, Math.round(natH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = srcW
  canvas.height = srcH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, srcW, srcH)
  const { data } = ctx.getImageData(0, 0, srcW, srcH)

  // Grilla con padding de 1px en cada lado (todo fondo).
  const w = srcW + 2
  const h = srcH + 2
  const binary = new Uint8Array(w * h)

  for (let y = 0; y < srcH; y += 1) {
    for (let x = 0; x < srcW; x += 1) {
      const p = (y * srcW + x) * 4
      const alpha = data[p + 3]
      let fill = 0
      if (alpha >= 128) {
        // Luminancia perceptual (Rec. 601).
        const lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
        fill = lum < threshold ? 1 : 0
      }
      if (invert) fill = fill ? 0 : 1
      binary[(y + 1) * w + (x + 1)] = fill
    }
  }

  return { binary, w, h, srcW, srcH, pad: 1 }
}

/**
 * Marching squares sobre la grilla binaria → segmentos de contorno (iso-nivel
 * entre trazo y fondo), con puntos en los puntos medios de las aristas de cada
 * celda. Devuelve un array plano de segmentos [ax, ay, bx, by].
 */
function marchingSquares(binary, w, h) {
  const segs = []
  const push = (a, b) => segs.push([a[0], a[1], b[0], b[1]])

  for (let y = 0; y < h - 1; y += 1) {
    for (let x = 0; x < w - 1; x += 1) {
      const tl = binary[y * w + x]
      const tr = binary[y * w + x + 1]
      const br = binary[(y + 1) * w + x + 1]
      const bl = binary[(y + 1) * w + x]
      const idx = (tl << 3) | (tr << 2) | (br << 1) | bl
      if (idx === 0 || idx === 15) continue

      // Puntos medios de las aristas de la celda.
      const T = [x + 0.5, y]
      const R = [x + 1, y + 0.5]
      const B = [x + 0.5, y + 1]
      const L = [x, y + 0.5]

      switch (idx) {
        case 1: push(L, B); break
        case 2: push(B, R); break
        case 3: push(L, R); break
        case 4: push(T, R); break
        case 5: push(T, R); push(L, B); break // silla: envuelve tr y bl
        case 6: push(T, B); break
        case 7: push(T, L); break
        case 8: push(T, L); break
        case 9: push(T, B); break
        case 10: push(T, L); push(B, R); break // silla: envuelve tl y br
        case 11: push(T, R); break
        case 12: push(L, R); break
        case 13: push(B, R); break
        case 14: push(L, B); break
        default: break
      }
    }
  }
  return segs
}

/**
 * Une los segmentos sueltos en polilíneas (bucles). Cada punto medio activo es
 * compartido por exactamente dos segmentos, así que el recorrido es determinista.
 * Devuelve un array de `{ points: [[x,y]...], closed: boolean }`.
 */
function stitchSegments(segs) {
  const key = (x, y) => `${Math.round(x * 2)},${Math.round(y * 2)}`
  const map = new Map() // key de punto → índices de segmentos que lo tocan
  const add = (k, i) => {
    const arr = map.get(k)
    if (arr) arr.push(i)
    else map.set(k, [i])
  }
  segs.forEach((s, i) => {
    add(key(s[0], s[1]), i)
    add(key(s[2], s[3]), i)
  })

  const used = new Array(segs.length).fill(false)
  const loops = []

  for (let i = 0; i < segs.length; i += 1) {
    if (used[i]) continue
    used[i] = true

    const start = [segs[i][0], segs[i][1]]
    const startKey = key(start[0], start[1])
    let cx = segs[i][2]
    let cy = segs[i][3]
    const points = [start, [cx, cy]]
    let closed = false

    for (;;) {
      const k = key(cx, cy)
      const candidates = map.get(k) || []
      let next = -1
      for (const j of candidates) {
        if (!used[j]) { next = j; break }
      }
      if (next === -1) break

      used[next] = true
      const s = segs[next]
      // Avanzamos al extremo opuesto del segmento encontrado.
      if (key(s[0], s[1]) === k) { cx = s[2]; cy = s[3] } else { cx = s[0]; cy = s[1] }

      if (key(cx, cy) === startKey) { closed = true; break }
      points.push([cx, cy])
    }

    loops.push({ points, closed })
  }

  return loops
}

/** Distancia perpendicular de `p` al segmento `a`–`b`. */
function perpDistance(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (len * len)
  const projX = a[0] + t * dx
  const projY = a[1] + t * dy
  return Math.hypot(p[0] - projX, p[1] - projY)
}

/** Simplificación Ramer–Douglas–Peucker de una polilínea abierta. */
function rdp(points, epsilon) {
  if (points.length < 3) return points.slice()
  let maxDist = 0
  let index = 0
  const end = points.length - 1
  for (let i = 1; i < end; i += 1) {
    const d = perpDistance(points[i], points[0], points[end])
    if (d > maxDist) { maxDist = d; index = i }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon)
    const right = rdp(points.slice(index), epsilon)
    return left.slice(0, -1).concat(right)
  }
  return [points[0], points[end]]
}

/**
 * Vectoriza una grilla binaria en polilíneas simplificadas, ya con el padding
 * removido (coordenadas en píxeles de la imagen reducida, origen arriba-izq).
 *
 * - `epsilon`: tolerancia de simplificación en px (mayor = menos nodos).
 * - `minPoints`: descarta bucles demasiado chicos (ruido/moteado).
 */
export function traceBinary({ binary, w, h, pad = 0 }, { epsilon = 0.9, minPoints = 3 } = {}) {
  const segs = marchingSquares(binary, w, h)
  const loops = stitchSegments(segs)

  const paths = []
  for (const loop of loops) {
    let pts = loop.closed ? loop.points : loop.points
    pts = rdp(pts, epsilon).map(([x, y]) => [x - pad, y - pad])
    if (pts.length < minPoints) continue
    paths.push({ points: pts, closed: loop.closed })
  }
  return paths
}

/** Cantidad total de nodos en un conjunto de paths (para avisos de peso). */
export function countNodes(paths) {
  return paths.reduce((sum, p) => sum + p.points.length, 0)
}
