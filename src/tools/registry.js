import { lazy } from 'react'

import QrGenerator from './qr-generator/QrGenerator.jsx'

// Lazy: el label-generator embebe logos (base64) y suma código de impresión/lote.
// Cargándolo bajo demanda no pesa en el bundle del home. ToolView lo envuelve en
// <Suspense>. (Cualquier herramienta puede migrar a este patrón si crece.)
const LabelGenerator = lazy(() => import('./label-generator/LabelGenerator.jsx'))

// Lazy por el mismo motivo: embebe fuentes + plantillas vectoriales y arma PDF.
const WarrantyGenerator = lazy(() => import('./warranty-generator/WarrantyGenerator.jsx'))

// Lazy: el trazado de contornos (marching squares) y la generación de DXF solo
// hacen falta al abrir la herramienta, no en el bundle del home.
const ImageToDxf = lazy(() => import('./image-to-dxf/ImageToDxf.jsx'))

// Lazy, y con motivo de peso: arrastra three.js (~150 KB gzip) para el render 3D
// del pallet. Cargarlo bajo demanda deja el bundle del home intacto.
const Palletizing = lazy(() => import('./palletizing/Palletizing.jsx'))

// Lazy: jsPDF y pdfjs-dist se importan dinámicamente recién al usar
// "Guardar PDF" / "Subir PDF" (ver pdfBuilder.js / pdfImport.js), pero el
// componente en sí también se difiere para no pesar en el bundle del home.
const ArtworkChecklist = lazy(() => import('./artwork-checklist/ArtworkChecklist.jsx'))

// Lazy: arrastra ExcelJS (pesada) para clonar el template de referencia con
// estilos, merges e imágenes intactos; solo hace falta al abrir la herramienta.
const ShippingMarkGenerator = lazy(() => import('./shipping-mark-generator/ShippingMarkGenerator.jsx'))

/*
 * Registry central del catálogo de herramientas (fuente de verdad del home).
 *
 * Cada entrada:
 *   { id, name, description, icon, status, role, dev?, readable?, component }
 *   - id:          slug único; define la ruta /tools/:id.
 *   - name:        título visible en la tarjeta.
 *   - description: una línea corta, en voseo.
 *   - icon:        nombre de ícono (ver components/Icon.jsx).
 *   - status:      'available' | 'coming-soon'.
 *   - role:        'ingeniero' | 'diseñador'. Define a qué filtro de rol
 *                  pertenece la tarjeta en el home (ver useRole.js / Home.jsx).
 *   - dev:         opcional; si es true, la tarjeta muestra un sello amarillo
 *                  "En desarrollo" (herramienta usable pero todavía inestable).
 *   - readable:    opcional, solo para 'coming-soon'; si es true, el título y la
 *                  descripción se ven nítidos (sin el blur por defecto). Se usa
 *                  para herramientas reales que ya funcionaron y están en pausa,
 *                  a diferencia de los placeholders que nunca se construyeron.
 *   - pinnedLast:  opcional; la tarjeta se renderiza siempre al final de la
 *                  grilla, sin importar el rol activo (ver sortTools en Home.jsx).
 *   - component:   solo para 'available'. Es el módulo de la herramienta.
 *
 * Orden de la grilla en el home (Home.jsx / sortTools): primero las tarjetas
 * "completas" (sin `dev`), después las `dev` ("En desarrollo"), y al final las
 * `pinnedLast`. Dentro de cada grupo, si hay un rol activo, sus tarjetas van
 * primero. Sumar una herramienta real = crear su módulo en src/tools/<id>/,
 * importarlo acá, asignar `component` y poner status 'available'.
 * Nada más del armazón debe tocarse.
 */
export const tools = [
  // ----- Rol: diseñador -----
  {
    id: 'qr-generator',
    name: 'Generador de QR',
    description: 'Códigos QR para gráficas de caja. Exportá en SVG y PNG.',
    icon: 'qr',
    status: 'available',
    role: 'diseñador',
    component: QrGenerator,
  },
  {
    id: 'label-generator',
    name: 'Generador de etiquetas',
    description: 'Etiquetas de producto Liliana listas para imprenta. Exportá en SVG o PDF.',
    icon: 'tag',
    status: 'available',
    role: 'diseñador',
    component: LabelGenerator,
  },
  {
    id: 'warranty-generator',
    name: 'Generador de Garantías',
    description: 'Tarjetas de garantía de producto, listas para imprenta. Exportá en PDF.',
    icon: 'shield',
    status: 'available',
    role: 'diseñador',
    component: WarrantyGenerator,
  },
  {
    id: 'artwork-checklist',
    name: 'Checklist de artworks',
    description:
      'Seguimiento de actualización o desarrollo de artworks, pieza por pieza. Guardá tu progreso en un PDF y retomalo cuando quieras.',
    icon: 'checklist',
    status: 'available',
    role: 'diseñador',
    component: ArtworkChecklist,
  },
  {
    id: 'image-to-dxf',
    name: 'Imagen a DXF para Láser',
    description: 'Convertí una imagen simple en un DXF vectorial para corte o grabado láser. Todo en tu navegador.',
    icon: 'vector',
    status: 'available',
    role: 'diseñador',
    dev: true,
    component: ImageToDxf,
  },

  // ----- Rol: ingeniero -----
  {
    id: 'palletizing',
    name: 'Paletizado',
    description:
      'Consultá el estándar de armado de cada producto: cajas por piso, pisos por pallet y observaciones de planta.',
    icon: 'pallet',
    status: 'available',
    role: 'ingeniero',
    dev: true,
    component: Palletizing,
  },
  {
    id: 'shipping-mark-generator',
    name: 'Generador de Shipping Mark',
    description:
      'Subí la plantilla de códigos completada y generá el shipping mark de cada uno, con el formato de Liliana listo para imprenta.',
    icon: 'document',
    status: 'available',
    role: 'ingeniero',
    dev: true,
    component: ShippingMarkGenerator,
  },
  {
    id: 'artwork-finder',
    name: 'Buscador de artworks',
    description: 'Buscá un producto y visualizá la última versión de su artwork: etiquetas, manuales, gráficas, cajas e imágenes.',
    icon: 'search',
    status: 'coming-soon',
    role: 'ingeniero',
    readable: true,
    pinnedLast: true,
  },
]

/** Devuelve una herramienta disponible (con component) por id, o undefined. */
export function getAvailableTool(id) {
  return tools.find((t) => t.id === id && t.status === 'available' && t.component)
}
