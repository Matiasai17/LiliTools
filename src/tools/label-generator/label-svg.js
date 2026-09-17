/*
 * label-generator — construcción VECTORIAL de la etiqueta como SVG.
 *
 * Es el núcleo de la herramienta: porta la matemática en mm de `drawLabelVector`
 * (Et.art/v7, js/pdf.js) a elementos SVG. El viewBox está en mm (1 unidad = 1 mm)
 * y el SVG se dimensiona en mm reales, así sirve igual para el preview en pantalla,
 * el export .svg y la impresión.
 *
 * Para que el builder sea PURO y SÍNCRONO (memoizable, testeable, sin DOM), el
 * texto se mide con tablas de anchos de Helvetica (AFM, por 1000 em). Helvetica y
 * Arial son métricamente compatibles, así que el condensado horizontal y el autofit
 * vertical se calculan acá igual que lo hacía el original midiendo con jsPDF.
 */
import { COLOR_SCHEMES } from './config.js'
import { ASSETS } from './assets.js'
import logoLilianaRaw from './logo-liliana.svg?raw'
import {
  parseBool,
  buildElectricosNacional,
  buildElectricosImportado,
  escXml,
} from './utils.js'

// Relación de aspecto (w/h) de cada logo PNG. Precalculado del header PNG (IHDR)
// para no tener que cargar la imagen en runtime (mantiene el builder síncrono).
const LOGO_ASPECTS = {
  logoIQC: 0.9551,
  logoIQCb: 1.0556,
  logoClase2: 0.9551,
  logoClase2b: 1.0556,
}

// Logo "Liliana" (isotipo + wordmark): vectorial, no PNG. Se pinta con la tinta
// del esquema de color (blanco sobre fondo oscuro, negro sobre fondo claro), así
// que se guardan solo los <path> (sin wrapper <svg>/<defs>/<style> ni el fill
// fijo del original) para pintarlos con un <g fill="..."> al insertarlos.
const LOGO_VIEWBOX = '0 0 174.93 32.46'
const LOGO_ASPECT = 174.93 / 32.46
const LOGO_PATHS = logoLilianaRaw
  .replace(/<\?xml[^>]*\?>/, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<defs>[\s\S]*?<\/defs>/, '')
  .replace(/<\/?svg[^>]*>/g, '')
  .replace(/<\/?g>/g, '')
  .replace(/\s*class="[^"]*"/g, '')
  .trim()

/** Logo "Liliana" como <svg> anidado (viewBox propio), pintado con `color`. */
function logoTag(x, y, w, h, color) {
  return `<svg x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(
    3,
  )}" viewBox="${LOGO_VIEWBOX}" preserveAspectRatio="xMinYMin meet"><g fill="${color}">${LOGO_PATHS}</g></svg>`
}

const FIT_X_MIN = 0.55 // piso de condensado horizontal (igual que el original)

// Anchos de avance de Helvetica (regular y bold), char 32..126, en 1/1000 em.
// prettier-ignore
const W_REGULAR = [
  278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,
  556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,
  722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,
  278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
  556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,
]
// prettier-ignore
const W_BOLD = [
  278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,
  556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,
  722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,
  278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,
  611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,
]
// Caracteres no-ASCII que aparecen en las etiquetas.
const W_EXTRAS = { '·': 278, '—': 1000, '–': 556, '×': 584, '°': 400, '~': 584 }
// Acentos → carácter base (Helvetica les da el mismo ancho que la base).
const ACCENTS = { á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u',ñ:'n',Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U',Ñ:'N' }

/** Ancho de un texto en mm, al tamaño de fuente dado (mm), regular o bold. Reusable (spec-svg.js). */
export function measureText(str, fontSizeMm, bold) {
  const table = bold ? W_BOLD : W_REGULAR
  let units = 0
  for (const ch of String(str)) {
    if (W_EXTRAS[ch] != null) units += W_EXTRAS[ch]
    else {
      const c = ACCENTS[ch] || ch
      const code = c.charCodeAt(0)
      units += code >= 32 && code <= 126 ? table[code - 32] : 556
    }
  }
  return (units / 1000) * fontSizeMm
}

/** Corta `text` en líneas que entren en `maxW` (mm), por palabras (greedy). Reusable (spec-svg.js). */
export function wrapText(text, maxW, fontSizeMm, bold) {
  const words = String(text).split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines = []
  let line = words[0]
  for (let i = 1; i < words.length; i++) {
    const test = `${line} ${words[i]}`
    if (measureText(test, fontSizeMm, bold) <= maxW) line = test
    else {
      lines.push(line)
      line = words[i]
    }
  }
  lines.push(line)
  return lines
}

/**
 * Tamaño de fuente y condensado horizontal (fx) de un renglón de texto,
 * igual matemática para las 3 salidas (texto editable, trazos SVG, PDF).
 */
function fitTextRun(text, sizeMm, bold, avail, min = 0) {
  const natural = measureText(text, sizeMm, bold)
  let fontSize = sizeMm
  let fx = 1
  if (natural > avail && natural > 0) {
    fx = avail / natural
    if (fx < FIT_X_MIN) {
      // Por debajo del piso: se reduce el font-size y se condensa al piso (= original).
      fontSize = sizeMm * (avail / (natural * FIT_X_MIN))
      fx = FIT_X_MIN
    }
  }
  // Piso de tamaño (mm): ningún carácter por debajo de `min`. La legibilidad
  // manda sobre el ajuste de ancho — si a ese tamaño el texto no entra a lo
  // ancho, se condensa hasta el piso de condensado y, si aún no entra, se
  // acepta el excedente (el overflow se avisa aparte, en el layout).
  if (min > 0 && fontSize < min) {
    fontSize = min
    const nat = measureText(text, fontSize, bold)
    fx = nat > avail && nat > 0 ? Math.max(FIT_X_MIN, avail / nat) : 1
  }
  return { fontSize, fx }
}

/** Transform SVG del condensado horizontal, anclado en x (la izquierda no se mueve). */
function condenseTransform(x, fx) {
  return fx !== 1 ? ` transform="matrix(${fx.toFixed(4)} 0 0 1 ${(x * (1 - fx)).toFixed(4)} 0)"` : ''
}

/** Emite un <text> de una línea (versión "editable": fuente del sistema, no trazos). */
function renderTextTag(op) {
  const { fontSize, fx } = fitTextRun(op.text, op.size, op.bold, op.avail, op.min)
  const weight = op.bold ? '700' : '400'
  const tf = condenseTransform(op.x, fx)
  return `<text x="${op.x.toFixed(3)}" y="${op.y.toFixed(3)}" font-size="${fontSize.toFixed(3)}" font-weight="${weight}" fill="${op.color}" dominant-baseline="text-before-edge"${tf}>${escXml(op.text)}</text>`
}

/**
 * Emite un <path> vectorizado (trazos) de una línea, usando los glyphs de `fonts`
 * (ver fonts.js). `op.y` es el borde superior del renglón (igual que text-before-edge).
 */
function renderTextPath(op, fonts) {
  const { fontSize, fx } = fitTextRun(op.text, op.size, op.bold, op.avail, op.min)
  const font = op.bold ? fonts.bold : fonts.regular
  const ascent = op.bold ? fonts.boldAscent : fonts.regularAscent
  const baselineY = op.y + fontSize * ascent
  const d = op.text ? font.getPath(op.text, op.x, baselineY, fontSize).toPathData(3) : ''
  const tf = condenseTransform(op.x, fx)
  return `<path d="${d}" fill="${op.color}"${tf}/>`
}

function imageTag(src, x, y, w, h) {
  return `<image href="${src}" x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}" preserveAspectRatio="xMinYMin meet"/>`
}

/** Op de texto reusable por otros builders SVG del tool (ver spec-svg.js). */
export function textOp(text, x, y, size, { bold = false, color = '#000', avail = Infinity, min = 0 } = {}) {
  return { type: 'text', text, x, y, size, bold, color, avail, min }
}

/** Op de markup SVG ya resuelto (rects/líneas/imágenes), reusable igual que textOp. */
export function rawOp(svg) {
  return { type: 'raw', svg }
}

/**
 * Layout puro de la etiqueta: calcula dimensiones y devuelve `{ W, H, ops }`,
 * una lista de operaciones de dibujo (rects/líneas/imágenes ya resueltas a
 * string, renglones de texto sin resolver). Se renderiza a texto editable,
 * a trazos (SVG) o a PDF con el mismo layout — ver `renderOps`.
 * `data` = modelo del formulario / fila de lote.
 */
function layoutLabel(data) {
  const W = parseFloat(data.ancho) || 28
  const H = parseFloat(data.alto) || 19
  const imported = parseBool(data.modoImportado)
  const ink = COLOR_SCHEMES[data.colorImpresion] || COLOR_SCHEMES['negro-blanco']
  // El texto usa la tinta del esquema (igual que el export vectorial original).
  const color = ink.inkColor
  const hasClase2 = parseBool(data.claseII)
  const hasIQC = !imported
  const hasIcons = hasIQC || hasClase2

  // Factores de fuente (fracción de W) por breakpoint de aspecto.
  // fFooter va aparte de fOrigin (más grande): es el pie "Fabrica y distribuye…",
  // se prioriza su lectura y tiene su propio margen inferior (footerPadY).
  const aspect = W / H
  let fArt, fSpecs, fOrigin, fFooter, fDesc
  if (aspect > 2.5) {
    fArt = 0.065; fSpecs = 0.03; fOrigin = 0.028; fFooter = 0.033; fDesc = 0.035
  } else if (aspect > 2.0) {
    fArt = 0.085; fSpecs = 0.04; fOrigin = 0.035; fFooter = 0.041; fDesc = 0.045
  } else {
    fArt = 0.12; fSpecs = 0.054; fOrigin = 0.05; fFooter = 0.053; fDesc = 0.055
  }

  // Tamaños absolutos (mm) de cada renglón. A partir de acá se trabaja con estos
  // (no con las fracciones) para poder aplicarles un piso de tamaño uniforme.
  let sArt = fArt * W
  let sSpecs = fSpecs * W
  let sOrigin = fOrigin * W
  let sDesc = fDesc * W
  let footerSize = fFooter * W

  // Piso de tamaño de fuente: en las etiquetas 40×18 y 55×20 ningún carácter
  // puede quedar por debajo de 5 pt (requisito de legibilidad de imprenta).
  // 5 pt = 5 · 25.4/72 mm ≈ 1.764 mm. En el resto de los tamaños no hay piso.
  const PT_TO_MM = 25.4 / 72
  const hasFloor = (W === 40 && H === 18) || (W === 55 && H === 20)
  const minFont = hasFloor ? 5 * PT_TO_MM : 0
  footerSize = Math.max(footerSize, minFont)

  // Margen mínimo de 2mm entre el contenido (texto/logo/íconos) y el borde.
  const padX = 2
  const padY = 2
  // El pie "Fabrica y distribuye…" usa un margen inferior más chico (pedido
  // explícito: se prioriza que el texto entre más grande antes que el aire
  // de sobra abajo).
  const footerPadY = 1.5
  // Interlineado del pie (el resto del texto usa `lineH`, definido más abajo).
  // En 40×18 y 55×20, donde el texto no puede bajar de 5 pt, se comprime para
  // recuperar alto y que el pie no quede pisado por "INDUSTRIA ARGENTINA".
  const footerLineH = hasFloor ? 1.02 : 1.2
  const iconColW = hasIcons ? 0.16 * W + 0.6 : 0
  const mainX = padX
  const mainW = W - 2 * padX - iconColW

  const logoAsp = LOGO_ASPECT

  // Interlineado de los renglones de una sola línea (Art., specs, origen). En
  // los tamaños con piso el texto ya está en su mínimo de 5 pt y no puede
  // encoger más: se comprime este interlineado (y los espaciados de abajo) para
  // devolverle esa altura al logo, que si no queda achicado al mínimo.
  const lineH = hasFloor ? 1.0 : 1.15

  // Espaciados verticales (mm), escalables si el contenido no entra.
  let spLogoArt = 0.4
  let spArtDesc = hasFloor ? 0.2 : 0.4
  let spDescSpec = hasFloor ? 0.15 : 0.25
  let spSpecFoot = hasFloor ? 0.2 : 0.4
  let spOriginFt = hasFloor ? 0.2 : 0.4
  let spSpecNac = hasFloor ? 0.15 : 0.3
  const spDivider = 0.5 // fijo

  // ── Zona inferior (footer de 2 líneas), calculada primero ──
  const pais = (data.paisFabricacion || 'China').trim()
  const footerLines = (imported
    ? `Fabricado en ${pais} · Importa y distribuye: Liliana S.R.L.\nWarnes 1155 · S2005PDG Rosario · Santa Fe · Argentina`
    : `Fabrica y distribuye: Liliana S.R.L.\nWarnes 1155 · S2005PDG Rosario · Santa Fe`
  ).split('\n')

  // El tamaño no se preencoge acá por ancho: si una línea no entra, se condensa
  // horizontalmente al renderizarla (textOp con avail: mainW, igual que el resto
  // de los renglones) en vez de achicar la letra — se lee mejor angosta que chica.
  // (footerSize ya se definió arriba, con el piso aplicado.)
  const footerBlockH = footerLines.length * footerSize * footerLineH
  const footerY = H - footerPadY - footerBlockH
  const availableContentH = footerY - spDivider - padY

  // ── Estimación del bloque de texto superior (sin el logo, que no escala) ──
  const descUpper = (data.descripcion || '').toUpperCase()
  const nDesc = imported ? wrapText(descUpper, mainW, sDesc, true).length : 0
  // El logo se dibuja al ancho de la columna (alto proporcional). En los tamaños
  // con piso puede achicarse después para hacerle lugar al texto (ver más abajo).
  let logoDrawW = mainW
  let logoDrawH = logoDrawW / logoAsp
  const availableTextH = availableContentH - logoDrawH

  let estTextH = spLogoArt + sArt + spArtDesc
  if (imported) {
    estTextH += nDesc * sDesc * lineH + spDescSpec
    estTextH += sSpecs * lineH + spSpecFoot
  } else {
    estTextH += sSpecs * lineH + spSpecNac
    estTextH += sOrigin + spOriginFt
  }

  if (estTextH > availableTextH && availableTextH > 0) {
    const cs = availableTextH / estTextH
    sArt *= cs; sSpecs *= cs; sOrigin *= cs; sDesc *= cs
    spLogoArt *= cs; spArtDesc *= cs; spDescSpec *= cs
    spSpecFoot *= cs; spOriginFt *= cs; spSpecNac *= cs
  }

  // Piso de tamaño: se aplica DESPUÉS del encogido vertical, porque la
  // legibilidad mínima manda sobre el ajuste. Puede hacer que el bloque no
  // entre a lo alto → se reporta como `overflow` para avisar en pantalla.
  sArt = Math.max(sArt, minFont)
  sSpecs = Math.max(sSpecs, minFont)
  sOrigin = Math.max(sOrigin, minFont)
  sDesc = Math.max(sDesc, minFont)

  let usedTextH = spLogoArt + sArt + spArtDesc
  if (imported) {
    usedTextH += nDesc * sDesc * lineH + spDescSpec + sSpecs * lineH + spSpecFoot
  } else {
    usedTextH += sSpecs * lineH + spSpecNac + sOrigin + spOriginFt
  }

  // En los tamaños con piso el texto ya está a 5 pt y no encoge más. Para que el
  // contenido entre sin pisar el pie, se le cede alto al texto achicando el logo
  // proporcionalmente (con un piso para que no desaparezca). Junto con el
  // interlineado del pie comprimido, es la solución al pisado en 40×18 y 55×20.
  const MIN_LOGO_H = 3.2
  if (hasFloor && logoDrawH + usedTextH > availableContentH) {
    logoDrawH = Math.max(MIN_LOGO_H, availableContentH - usedTextH)
    logoDrawW = logoDrawH * logoAsp
  }
  const overflow = logoDrawH + usedTextH > availableContentH + 0.1

  // ── Dibujo ──
  const ops = []

  // Fondo + borde cyan.
  ops.push(rawOp(`<rect x="0" y="0" width="${W}" height="${H}" rx="2.5" ry="2.5" fill="${ink.labelBg}"/>`))
  ops.push(
    rawOp(
      `<rect x="0.106" y="0.106" width="${(W - 0.212).toFixed(3)}" height="${(H - 0.212).toFixed(
        3,
      )}" rx="2.5" ry="2.5" fill="none" stroke="#29abe2" stroke-width="0.212"/>`,
    ),
  )

  // Logo.
  let curY = padY
  ops.push(rawOp(logoTag(mainX, curY, logoDrawW, logoDrawH, color)))
  curY += logoDrawH + spLogoArt

  // Art. + código.
  ops.push(textOp(`Art. ${data.articulo || 'N/A'}`, mainX, curY, sArt, { bold: true, color, avail: mainW, min: minFont }))
  curY += sArt + spArtDesc

  if (imported) {
    const descLines = wrapText(descUpper, mainW, sDesc, true)
    for (const ln of descLines) {
      ops.push(textOp(ln, mainX, curY, sDesc, { bold: true, color, avail: mainW, min: minFont }))
      curY += sDesc * lineH
    }
    curY += spDescSpec
    ops.push(textOp(buildElectricosImportado(data), mainX, curY, sSpecs, { bold: true, color, avail: mainW, min: minFont }))
    curY += sSpecs * lineH + spSpecFoot
  } else {
    ops.push(textOp(buildElectricosNacional(data), mainX, curY, sSpecs, { bold: true, color, avail: mainW, min: minFont }))
    curY += sSpecs * lineH + spSpecNac
    ops.push(textOp('INDUSTRIA ARGENTINA', mainX, curY, sOrigin, { bold: true, color, avail: mainW, min: minFont }))
    curY += sOrigin + spOriginFt
  }

  // Divisor + footer.
  const dividerY = footerY - spDivider
  ops.push(
    rawOp(
      `<line x1="${mainX.toFixed(3)}" y1="${dividerY.toFixed(3)}" x2="${(mainX + mainW).toFixed(
        3,
      )}" y2="${dividerY.toFixed(3)}" stroke="${color}" stroke-width="0.106"/>`,
    ),
  )
  footerLines.forEach((ln, i) => {
    ops.push(textOp(ln, mainX, footerY + i * footerSize * footerLineH, footerSize, { color, avail: mainW, min: minFont }))
  })

  // Íconos (columna derecha, apilados desde abajo).
  //
  // Piso de tamaño: ni el símbolo IQC ni el de doble aislamiento (Clase II)
  // pueden imprimirse por debajo de 3 mm (requisito de legibilidad). Los íconos
  // son casi cuadrados; se acota la dimensión MENOR (ancho o alto) a 3 mm,
  // escalando el otro lado en proporción para no deformarlos.
  const ICON_MIN_MM = 3
  const iconSize = (fracW, asp) => {
    let iW = fracW * W
    let iH = iW / asp
    const small = Math.min(iW, iH)
    if (small < ICON_MIN_MM) {
      const k = ICON_MIN_MM / small
      iW *= k
      iH *= k
    }
    return { iW, iH }
  }
  if (hasIcons) {
    const iconColX = W - padX - iconColW + 0.6
    const iconW = iconColW - 0.6
    let iconY = H - padY - 2.5
    if (hasClase2) {
      const src = ink.isDark ? ASSETS.logoClase2b : ASSETS.logoClase2
      const asp = LOGO_ASPECTS[ink.isDark ? 'logoClase2b' : 'logoClase2']
      const { iW, iH } = iconSize(0.14, asp)
      iconY -= iH
      ops.push(rawOp(imageTag(src, iconColX + (iconW - iW) / 2, iconY, iW, iH)))
      iconY -= 0.6
    }
    if (hasIQC) {
      const src = ink.isDark ? ASSETS.logoIQCb : ASSETS.logoIQC
      const asp = LOGO_ASPECTS[ink.isDark ? 'logoIQCb' : 'logoIQC']
      const { iW, iH } = iconSize(0.16, asp)
      iconY -= iH
      ops.push(rawOp(imageTag(src, iconColX + (iconW - iW) / 2, iconY, iW, iH)))
    }
  }

  return { W, H, ops, overflow }
}

/**
 * ¿El contenido no entra a lo alto de la etiqueta con el piso de tamaño de
 * fuente aplicado? Solo puede dar true en los tamaños con piso (40×18, 55×20):
 * en el resto no hay piso y el layout siempre encoge para entrar. La UI lo usa
 * para avisar que conviene revisar esa etiqueta a mano.
 */
export function labelHasOverflow(data) {
  return layoutLabel(data).overflow
}

/**
 * Renderiza una lista de ops a body SVG. `outline`: trazos (fonts) vs. <text>
 * editable. Reusable por otros builders SVG del tool (ver spec-svg.js).
 */
export function renderOps(ops, { outline = false, fonts } = {}) {
  return ops
    .map((op) => (op.type === 'raw' ? op.svg : outline ? renderTextPath(op, fonts) : renderTextTag(op)))
    .join('')
}

/** Envoltorio <svg> con viewBox en mm. Reusable por otros builders SVG del tool. */
export function svgWrap(W, H, body, { outline = false } = {}) {
  const fontAttr = outline ? '' : ' font-family="Helvetica, Arial, sans-serif"'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}"` +
    `${fontAttr} shape-rendering="geometricPrecision">${body}</svg>`
  )
}

/**
 * Construye la etiqueta física como string SVG con texto real (editable en un
 * editor vectorial, pero depende de una fuente Helvetica/Arial instalada).
 * `data` = modelo del formulario / fila de lote.
 */
export function buildLabelSvg(data) {
  const { W, H, ops } = layoutLabel(data)
  return svgWrap(W, H, renderOps(ops, { outline: false }), { outline: false })
}

/**
 * Construye la etiqueta como SVG con el texto convertido a trazos (paths):
 * 100% vectorial y autocontenido, no depende de ninguna fuente en el sistema
 * donde se abra (Illustrator, etc). `fonts` = resultado de `loadLabelFonts()`.
 */
export function buildLabelSvgOutlined(data, fonts) {
  const { W, H, ops } = layoutLabel(data)
  return svgWrap(W, H, renderOps(ops, { outline: true, fonts }), { outline: true })
}
