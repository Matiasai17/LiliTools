/*
 * label-generator — configuración y datos estáticos.
 * Portado de Et.art/v7 (js/config.js), que es la fuente de verdad de los datos.
 */

// Esquemas de color de la etiqueta física (fondo + tinta).
export const COLOR_SCHEMES = {
  'negro-blanco': { inkColor: '#000000', labelBg: '#ffffff', isDark: false },
  'gris-negro': { inkColor: '#000000', labelBg: '#D0D0D0', isDark: false },
  'negro-negro': { inkColor: '#ffffff', labelBg: '#111111', isDark: true },
  'rojo-blanco': { inkColor: '#ffffff', labelBg: '#DA291C', isDark: true },
}

// Nombre del color tal como va en el rótulo (es / en para importado).
export const COLOR_LABELS = {
  'negro-blanco': 'Negro',
  'gris-negro': 'Gris',
  'negro-negro': 'Negro',
  'rojo-blanco': 'PANTONE 485C',
}

export const COLOR_LABELS_EN = {
  'negro-blanco': 'Black',
  'gris-negro': 'Gray',
  'negro-negro': 'Black',
  'rojo-blanco': 'Red',
}

// Tamaños estándar nacionales (mm).
export const NATIONAL_SIZES = {
  '28x19': { w: 28, h: 19 },
  '44x24': { w: 44, h: 24 },
  '40x18': { w: 40, h: 18 },
  '38x22': { w: 38, h: 22 },
  '55x20': { w: 55, h: 20 },
}

// Valores por defecto del formulario.
export const DEFAULTS = {
  codigo: 'ZZCC2198',
  version: 0,
  articulo: 'CFI830',
  descripcion: 'Caloventor PTC',
  tamanoNacional: '28x19',
  ancho: 40,
  alto: 24,
  voltMin: 220,
  voltMax: 240,
  hzMin: 50,
  hzMax: 60,
  potencia: '1500/3000',
  impresion: 'Negro',
  colorImpresion: 'negro-blanco',
  claseII: false,
  modoImportado: false,
  paisFabricacion: 'China',
  supplierNote: '',
}

// Mapeo de encabezados de Excel/CSV → claves del modelo (modo lote).
export const COL_MAP = {
  modo: 'modoImportado',
  'modo importado': 'modoImportado',
  'código de insumo': 'codigo',
  'codigo de insumo': 'codigo',
  código: 'codigo',
  codigo: 'codigo',
  versión: 'version',
  version: 'version',
  artículo: 'articulo',
  articulo: 'articulo',
  descripción: 'descripcion',
  descripcion: 'descripcion',
  'ancho (mm)': 'ancho',
  'alto (mm)': 'alto',
  dimensiones: 'dimensiones',
  tamaño: 'tamano',
  tamano: 'tamano',
  'v mín': 'voltMin',
  'v min': 'voltMin',
  'v máx': 'voltMax',
  'v max': 'voltMax',
  'hz mín': 'hzMin',
  'hz min': 'hzMin',
  'hz máx': 'hzMax',
  'hz max': 'hzMax',
  'potencia (w)': 'potencia',
  potencia: 'potencia',
  'especificaciones eléctricas': 'electricos',
  'especificaciones electricas': 'electricos',
  impresión: 'impresion',
  impresion: 'impresion',
  color: 'colorImpresion',
  'color fondo': 'colorImpresion',
  'color de impresión': 'colorImpresion',
  'color de impresion': 'colorImpresion',
  'doble aislamiento': 'claseII',
  'clase ii': 'claseII',
  'país de fabricación': 'paisFabricacion',
  'pais de fabricacion': 'paisFabricacion',
  'nota al proveedor': 'supplierNote',
  'supplier note': 'supplierNote',
}

// Colores del rótulo (documento para imprenta). Se mantienen fieles al original
// (NO son los de la marca LiliTools: el rótulo es un artefacto técnico).
export const SPEC_COLORS = {
  cyan: '#29ABE2',
  darkBlue: '#0D3572',
  magenta: '#D4006A',
  headerBg: '#EAF5FC',
  version: '#999999',
}
