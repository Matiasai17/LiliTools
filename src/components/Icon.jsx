/*
 * Set de íconos de línea (stroke = currentColor), inline para no sumar dependencias.
 * El registry referencia un ícono por nombre; este componente lo resuelve.
 * Si un nombre no existe, cae en un ícono genérico de "herramienta".
 */

const paths = {
  // Generador de QR
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 14h3v3M21 14v.01M21 17v4h-4M17 21h-3" />
    </>
  ),
  // Optimizador de imágenes
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.8" />
      <path d="M4 17l4.5-4.5a2 2 0 0 1 2.8 0L20 21" />
    </>
  ),
  // Conversor de unidades (flechas de intercambio)
  scale: (
    <>
      <path d="M7 4v13M7 4l-3 3M7 4l3 3" />
      <path d="M17 20V7M17 20l3-3M17 20l-3-3" />
    </>
  ),
  // Generador de etiquetas
  tag: (
    <>
      <path d="M3.5 11.5l8-8a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v5.6a2 2 0 0 1-.6 1.4l-8 8a2 2 0 0 1-2.8 0l-6.1-6.1a2 2 0 0 1 0-2.7Z" />
      <circle cx="16.5" cy="7.5" r="1.3" />
    </>
  ),
  // Paleta de colores (muestrario)
  palette: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
  // Renombrador de archivos (pila)
  files: (
    <>
      <rect x="8" y="3" width="12" height="14" rx="2" />
      <path d="M4 7v12a2 2 0 0 0 2 2h10" />
    </>
  ),
  // Unir PDF / documento
  document: (
    <>
      <path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5M8.5 13h7M8.5 16.5h7" />
    </>
  ),
  // Generador de garantías (escudo con check)
  shield: (
    <>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  // Calcular paletizado (cajas sobre pallet)
  pallet: (
    <>
      <rect x="5" y="3.5" width="6" height="6" rx="1" />
      <rect x="13" y="3.5" width="6" height="6" rx="1" />
      <path d="M3 13.5h18v4H3z" />
      <path d="M6 17.5v3M18 17.5v3" />
    </>
  ),
  // Buscador de artworks (lupa)
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  // Imagen a DXF (trazo vectorial con nodos)
  vector: (
    <>
      <path d="M5 18 L10 7 L14 15 L19 6" />
      <rect x="3" y="16" width="4" height="4" rx="1" />
      <rect x="17" y="4" width="4" height="4" rx="1" />
      <circle cx="10" cy="7" r="1.4" />
      <circle cx="14" cy="15" r="1.4" />
    </>
  ),
  // Checklist de artworks (clipboard con ítems tildados)
  checklist: (
    <>
      <rect x="4" y="4" width="16" height="17" rx="2" />
      <path d="M8 2.5h8" />
      <path d="M7.5 9.3l1.2 1.2L11 8" />
      <path d="M13 9h4" />
      <path d="M7.5 14.8l1.2 1.2L11 13.5" />
      <path d="M13 14.5h4" />
    </>
  ),
  // Temporizador
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13V9M9 2h6M12 5V2" />
    </>
  ),
  // Fallback genérico
  tool: (
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.1-2.1Z" />
  ),
}

export default function Icon({ name, size = 24, className }) {
  const glyph = paths[name] || paths.tool
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyph}
    </svg>
  )
}
