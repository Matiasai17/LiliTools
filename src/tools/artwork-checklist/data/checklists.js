/*
 * Contenido de los checklists (qué chequear en cada pieza de artwork).
 * Portado tal cual del HTML original (fuente de verdad validada por el equipo);
 * no se tocan textos ni ids al migrar — los ids viajan dentro de los PDF ya
 * guardados por el equipo (ver pdfState.js) y deben mantenerse estables.
 *
 * item.conditional: solo se muestra si el origen actual coincide ('nacional' | 'importada').
 * item.textByOrigin: mismo item, texto distinto según origen (reemplaza a `text`).
 */

// Checklists de ACTUALIZACIÓN (un artwork ya existente que se retoca).
export const ARTWORKS_UPDATE = [
  {
    id: 'giftbox',
    label: 'Giftbox',
    items: [
      { id: 'g1', text: 'Logo nuevo reemplazado en todas las caras del giftbox' },
      { id: 'g2', text: 'Logo nuevo en la serigrafía del producto (todas las vistas)' },
      { id: 'g3', text: 'Chatbot agregado / actualizado' },
      { id: 'g4', text: 'QR SE actualizado' },
      { id: 'g5', text: 'QR de manual agregado / actualizado' },
      { id: 'g8', text: 'Leyenda QR en solapa superior' },
      { id: 'g6', text: 'Quitar IQC', conditional: 'importada' },
      { id: 'g7', text: 'Versión y fecha actualizadas' },
    ],
  },
  {
    id: 'rating',
    label: 'Rating Label',
    items: [
      { id: 'r1', text: 'Logo nuevo' },
      { id: 'r2', text: 'Versión actualizada' },
    ],
  },
  {
    id: 'manual',
    label: 'Manual (MI)',
    items: [
      { id: 'm1', text: 'Logo nuevo en todas las caras' },
      { id: 'm2', text: 'Logo nuevo en producto e ilustraciones' },
      { id: 'm3', text: 'Versión y fecha modificadas' },
      { id: 'm4', text: 'Chatbot agregado' },
    ],
  },
  {
    id: 'garantia',
    label: 'Garantía',
    items: [
      { id: 'ga1', text: 'Logo nuevo' },
      { id: 'ga2', text: 'Chatbot agregado' },
      { id: 'ga3', text: 'QR de manual agregado', conditional: 'importada' },
    ],
  },
  {
    id: 'instructivo',
    label: 'Instructivo gráfica',
    items: [{ id: 'i1', text: 'Logo nuevo en el nuevo tamaño' }],
  },
  {
    id: 'masterbox',
    label: 'Masterbox',
    items: [
      { id: 'mb1', text: 'Logo nuevo' },
      { id: 'mb2', text: 'Quitar IQC', conditional: 'importada' },
      { id: 'mb3', text: 'QR SE actualizado (si aplica)' },
    ],
  },
]

// Checklists de NUEVO DESARROLLO (producto nuevo, se arma todo desde cero).
export const ARTWORKS_DEV = [
  {
    id: 'predesign',
    label: 'Antes de diseñar',
    items: [
      { id: 'pd1', text: 'Diecut de la caja definitivo' },
      { id: 'pd2', text: 'Diecut de masterbox', conditional: 'importada' },
      { id: 'pd3', text: 'Información del producto' },
      { id: 'pd4', text: 'Características principales del producto' },
      { id: 'pd5', text: 'Imágenes del producto en alta resolución' },
      { id: 'pd6', text: 'Muestra física del producto (idealmente)' },
    ],
  },
  {
    id: 'cajas',
    label: 'Cajas',
    items: [
      { id: 'c1', text: 'Diecut definitivo' },
      { id: 'c2', text: 'Cotas' },
      { id: 'c3', text: 'Rótulo con versión y fecha' },
      { id: 'c4', text: 'Logo en todas las caras y tapa superior' },
      { id: 'c5', text: 'Chequear resolución de imágenes' },
      { id: 'c6', text: 'Márgenes de seguridad' },
      { id: 'c7', text: 'Chequear paleta de colores' },
      { id: 'c8', text: 'QR SE' },
      { id: 'c9', text: 'EAN-13' },
      { id: 'c10', text: 'QR MI' },
      { id: 'c11', text: 'Logo QMS' },
      { id: 'c12', text: 'Garantía 2 años' },
      { id: 'c13', text: 'Industria Argentina', conditional: 'nacional' },
      { id: 'c14', text: 'Información legales' },
      { id: 'c15', text: 'Clase I - Clase II' },
      { id: 'c16', text: 'Iconografía ISO paletizado' },
      { id: 'c17', textByOrigin: { nacional: 'Fabrica y distribuye', importada: 'Importa y distribuye' } },
      { id: 'c18', text: 'Guías etiqueta trazabilidad', conditional: 'nacional' },
      { id: 'c19', text: 'Leyenda "Imágenes de carácter ilustrativo"' },
    ],
  },
  {
    id: 'masterbox',
    label: 'Masterbox',
    items: [
      { id: 'mbd1', text: 'Diecut definitivo' },
      { id: 'mbd2', text: 'DUN-14' },
      { id: 'mbd3', text: 'Código de producto, familia, nombre y origen' },
      { id: 'mbd4', text: 'Rótulo con versión y fecha' },
      { id: 'mbd5', text: 'QR SE' },
    ],
  },
  {
    id: 'rating',
    label: 'Rating Label',
    items: [
      { id: 'rd1', text: 'Potencia correcta' },
      { id: 'rd2', text: 'Logo IQC', conditional: 'nacional' },
      { id: 'rd3', text: 'Clase I - Clase II' },
      { id: 'rd4', textByOrigin: { nacional: 'Fabrica y distribuye', importada: 'Importa y distribuye' } },
    ],
  },
  {
    id: 'manual',
    label: 'Manual (MI)',
    items: [
      { id: 'md1', text: 'Código de producto' },
      { id: 'md2', text: 'Nombre y familia' },
      { id: 'md3', textByOrigin: { nacional: 'Fabrica y distribuye', importada: 'Importa y distribuye' } },
      { id: 'md4', text: 'Chatbot' },
      { id: 'md5', text: 'Versión y fecha correcta' },
      { id: 'md6', text: 'Código de insumo', conditional: 'nacional' },
    ],
  },
  {
    id: 'garantia',
    label: 'Garantía',
    items: [
      { id: 'gd1', text: 'QR MI', conditional: 'importada' },
      { id: 'gd2', text: 'Modelo, versión y fecha', conditional: 'importada' },
      { id: 'gd3', text: 'Chatbot', conditional: 'importada' },
    ],
  },
  {
    id: 'instructivo',
    label: 'Instructivo gráficas',
    items: [
      { id: 'id1', text: 'Rótulo con código, versión y fecha' },
      { id: 'id2', text: 'Chequear color de tintas' },
      { id: 'id3', text: 'Incluir medidas y posición correctas' },
      { id: 'id4', text: 'Títulos de clisés y telas', conditional: 'nacional' },
    ],
  },
]
