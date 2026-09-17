/*
 * Acceso al catálogo de estándares de paletizado.
 *
 * IMPORTANTE: esta herramienta NO calcula paletizado, lo CONSULTA. Cada entrada
 * es un patrón ya validado por planta (no un óptimo calculado), así que los
 * números se muestran tal cual vienen del dato. Lo único que derivamos es el
 * total (cajas por piso × pisos), que es aritmética directa del estándar.
 *
 * El dataset vive local al módulo a propósito (`data/products.json`). Más
 * adelante puede existir un catálogo de productos compartido con otras
 * herramientas; hasta que exista, no acoplamos nada.
 */
import raw from './data/products.json'

/** Texto de la marca T/X/CC que acompaña a cada estándar. */
export const FLAG_LABELS = {
  T: 'con termo',
  X: 'sin termo',
  CC: 'caja contenedora',
}

/** Medidas del pallet estándar, en metros. */
export const PALLET = { length: 1.2, width: 1.0, approxHeight: 1.45 }

/**
 * Un producto es "consultable" si tiene los dos números que definen el armado.
 * Si falta alguno mostramos un estado vacío claro en vez de romper el render.
 */
export function isComplete(product) {
  return (
    Number.isFinite(product?.boxesPerLayer) &&
    product.boxesPerLayer > 0 &&
    Number.isFinite(product?.layers) &&
    product.layers > 0
  )
}

/** Campos faltantes, para poder decir en pantalla QUÉ falta. */
export function missingFields(product) {
  const missing = []
  if (!Number.isFinite(product?.boxesPerLayer) || product.boxesPerLayer <= 0) {
    missing.push('cajas por piso')
  }
  if (!Number.isFinite(product?.layers) || product.layers <= 0) {
    missing.push('pisos por pallet')
  }
  return missing
}

/** Total de cajas del pallet armado. Null si el estándar está incompleto. */
export function totalBoxes(product) {
  return isComplete(product) ? product.boxesPerLayer * product.layers : null
}

export const PRODUCTS = raw

export function getProduct(code) {
  return PRODUCTS.find((p) => p.code === code)
}
