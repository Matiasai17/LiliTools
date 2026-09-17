# LiliTools — Guía de proyecto

App web tipo **hub de herramientas**: un home con grilla de tarjetas, donde cada tarjeta
abre una herramienta independiente y autocontenida. Se construye de forma incremental:
el armazón es estable y el catálogo crece con el tiempo.

El sistema visual y de voz sigue **`brand.md`** (marca Liliana). Leelo siempre que
toques colores, tipografía, logo o textos.

---

## Principio rector: modularidad

Pensá la app como **shell + catálogo de herramientas**.
- El armazón (home, navegación, estilo base) es compartido y estable.
- Cada herramienta es autocontenida y **no depende de otra** para funcionar.
- Desde cada herramienta tiene que haber forma clara de volver al home.
- Agregar una herramienta debe ser de baja fricción: **crear su módulo + sumarla al
  registry**, sin rehacer ni tocar el armazón ni las demás herramientas.
- Si una idea acopla dos herramientas o rompe la modularidad, marcalo como problema.

---

## Stack y arquitectura

- **Stack:** Vite + React, build a estáticos.
- **Deploy:** hoy se publica en **GitHub Pages** (`matiasai17.github.io/LiliTools/`), con
  `base: '/LiliTools/'` en `vite.config.js`. Se publica **solo el build**: se copia
  `dist/` al clon `.repo-sync/` y desde ahí se commitea y pushea. El `public/.htaccess`
  quedó de un deploy previo en Hostinger (Apache); en Pages no hace nada — el fallback
  de rutas profundas lo cubre `404.html`.
- **Routing:** `/` = home, `/tools/:toolId` = vista de cada herramienta.
- **Registry central** (`src/tools/registry.js`): array de
  `{ id, name, description, icon, status, dev?, readable?, component }`.
  - `status: 'available' | 'coming-soon'`.
  - `available` → tiene `component` y navega a `/tools/:id`.
  - `coming-soon` → placeholder visual, sin `component` ni ruta.
  - `dev: true` → sello amarillo "En desarrollo": usable pero todavía inestable o
    incompleta. Usalo en vez de vender como terminada una herramienta que no lo está.
  - `readable: true` → solo para `coming-soon`; muestra título y descripción nítidos.
- **Cada herramienta** vive en `src/tools/<id>/`, aislada. El folder coincide con el `id`.
- **Sumar una herramienta real** = crear su módulo + asignar `component` + poner
  `status: 'available'`. Nada más debe tocarse.
- **Herramientas pesadas van con `lazy()`** en el registry, para no cargar en el home lo
  que solo hace falta al abrirlas. Ya se usa para las que embeben fuentes, plantillas o
  librerías grandes (etiquetas, garantías, DXF, artworks, paletizado).

### Backend (la excepción a "todo client-side")

Casi todas las herramientas corren **100% en el navegador**. Hay dos funcionalidades que
no pueden: viven en `server/artwork-finder/` (un solo proceso Node para ambas).

1. **Buscador de artworks** — proxy autenticado contra `gestion.liliana.com.ar`, que no
   tiene API pública ni CORS.
2. **Sugerí una mejora** — guarda las sugerencias del hub para que las vea todo el mundo,
   no solo quien las escribió.

El frontend lo resuelve con `VITE_HUB_API_BASE` (ver `src/lib/hubApiBase.js`); si no está
definida, cae a `http://localhost:3000`. **En producción es obligatoria**: sin ella, esas
dos funciones quedan apuntando a localhost y no funcionan desde la web publicada.

No asumir más backend que este. Cualquier automatización (n8n u otra) es conversación
aparte.

---

## Diseño y experiencia

- Intuitiva, moderna y fluida. Navegación obvia, sin fricción.
- **Sistema visual base reutilizable:** tokens en un solo lugar (`src/styles/tokens.css`)
  para tipografía, colores, espaciados, radios, sombras, estilo de tarjeta y de botón.
  Reutilizarlos en todo el hub para que se sienta un mismo producto. No hardcodear.
- **Tema claro y oscuro** son ambos de primera clase: los tokens se reasignan bajo
  `:root[data-theme='dark']`. Toda herramienta nueva tiene que verse bien en los dos.
- Colores y tono **según `brand.md`** (rojo Pantone 485 C como acento, base neutra,
  no abusar del rojo; copy en voseo).
- **Minianimaciones** sutiles y performantes (hover/foco en tarjetas, transición de
  entrada de vistas, feedback en botones). Respetar `prefers-reduced-motion` — y si la
  animación es por JS (no CSS), consultarlo explícitamente: `global.css` solo cubre CSS.
- **Accesibilidad** como parte del trabajo: contraste suficiente, navegación por teclado,
  foco visible, `alt` en imágenes, jerarquía semántica de headings, estados claros.

---

## Calidad de cada herramienta

- Cada herramienta resuelve **un problema puntual**: mantener el foco, no inflarla.
- Contemplar casos borde, manejo de errores y estados de **carga / vacío / error**.
- Seguridad por defecto: validar inputs, cuidar datos sensibles.
- **Liberar recursos al desmontar** lo que no se limpia solo: contextos WebGL,
  object URLs, listeners globales, workers, timers. Al navegar el hub los componentes
  se desmontan seguido y las fugas se acumulan.

---

## Convenciones

- Priorizar **claridad y mantenibilidad** (el código lo sigue otra persona).
- Código e identificadores **en inglés**; textos de UI en **español rioplatense (voseo)**.
- Seguir las convenciones que ya existan en el repo antes de introducir nuevas.
- Los datos propios de una herramienta van **locales a su módulo** (ej.
  `src/tools/palletizing/data/`), separados de la lógica. No acoplar herramientas entre
  sí "porque comparten un dato": si aparece un catálogo realmente compartido, se discute
  antes.

---

## Estado actual

**7 herramientas disponibles** (las marcadas · dev muestran el sello "En desarrollo"):

- `qr-generator` — QR para gráficas de caja. Export SVG y PNG.
- `label-generator` — Etiquetas de producto para imprenta, individual o por lote desde
  Excel. Export SVG/PDF, y opción de ubicar la etiqueta en la hoja A4 al imprimir.
- `warranty-generator` — Tarjetas de garantía. Export PDF.
- `background-remover` · dev — Quita el fondo de una imagen, client-side.
- `image-to-dxf` · dev — Imagen simple a DXF vectorial para láser.
- `artwork-finder` — Busca un producto y muestra la última versión de su artwork
  (etiquetas, manuales, gráficas, cajas, imágenes). **Requiere el backend.**
- `palletizing` · dev — Consulta el estándar de armado por producto, con render 3D
  (three.js). No calcula paletizado: muestra patrones ya validados por planta.

**6 tarjetas `coming-soon`** como placeholders.

Dependencias notables: `three` (3D del paletizado, cargada bajo demanda), `jspdf` +
`svg2pdf.js` + `opentype.js` (PDF vectorial con texto en trazos), `xlsx` (lote de
etiquetas), `jszip`, `qrcode`, `@imgly/background-removal`.

---

> **Nota de mantenimiento:** `CLAUDE.md` y `AGENTS.md` son copias idénticas de este
> documento. Si editás uno, actualizá el otro: ya se desactualizaron una vez por editar
> solo uno de los dos.
