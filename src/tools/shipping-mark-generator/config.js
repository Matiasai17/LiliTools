/*
 * Posiciones de celda dentro de template.xlsx (hoja de referencia, 2 mitades
 * "SIDE 1" / "SIDE 2" en columnas C-D y F-G). Aisladas acá para que mover un
 * campo sea cambiar una constante, no rastrear un `.getCell('C9')` perdido en
 * medio de la lógica.
 *
 * Referencia del layout original (ver discovery): C1 = título suelto; C7/F7
 * eran fórmulas "=C1" (se reemplazan por texto plano); D7/G7 = descripción.
 * Todo lo demás del template (datos fijos, notas 1/2/3, campos "XX" del
 * fabricante) no se toca: se clona tal cual en cada hoja.
 */

// Título de la etiqueta: el código tal cual lo tipeó el ingeniero + " -".
export const TITLE_CELL = 'C1'
export const TITLE_MIRROR_CELLS = ['C7', 'F7'] // antes fórmulas "=C1"

// Descripción del producto, una vez por mitad.
export const DESCRIPTION_CELLS = ['D7', 'G7']

// N° de Fabricante: campo nuevo, posición todavía no confirmada por el
// ingeniero real. Fila 9 estaba vacía en el template original; se replica en
// las mismas columnas que el título (C y F) para quedar alineado con SIDE 1 /
// SIDE 2. Mover esto = cambiar MFG_NUMBER_ROW / MFG_NUMBER_COLS.
export const MFG_NUMBER_ROW = 9
export const MFG_NUMBER_COLS = ['C', 'F']
export const MFG_NUMBER_LABEL = 'N° de Fabricante: '

// Límite de filas por archivo subido (evita workbooks gigantes que traben el navegador).
export const MAX_ROWS = 300
