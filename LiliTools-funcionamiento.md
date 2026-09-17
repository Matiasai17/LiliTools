# LiliTools

Hub web de herramientas internas para **Liliana Electrodomésticos**: un home con
tarjetas, donde cada tarjeta abre una herramienta chica y autocontenida que resuelve
una tarea puntual del día a día (gráficas de caja, etiquetas, garantías, imágenes).

## Por qué existe

Liliana necesita, de forma recurrente, generar piezas para producto: QR de manuales,
etiquetas para imprenta, tarjetas de garantía, ajustes rápidos de imagen. Antes eran
tareas manuales o dispersas en distintos archivos/plantillas. LiliTools las junta en
un solo lugar, con un resultado consistente (mismo estilo visual, mismo criterio de
calidad de impresión) y sin fricción: se entra, se completan un par de campos, se
descarga el archivo listo.

Casi todo corre **100% en el navegador**: las herramientas de generación (QR, etiquetas,
garantías, imágenes) no suben nada a ningún servidor, y los archivos con los que trabajás
no salen de tu máquina. Esto es intencional.

Las dos excepciones son el **Buscador de artworks**, que necesita consultar el sistema
interno de Liliana, y **"Sugerí una mejora"**, que guarda las sugerencias para que las vea
todo el equipo. Ambas usan un backend propio (ver "Stack").

## Cómo funciona

La app es un **shell + catálogo de herramientas**:

- El **armazón** (home, navegación, estilo base) es compartido y estable para todas
  las herramientas.
- Cada **herramienta** vive en su propia carpeta (`src/tools/<id>/`), es autocontenida
  y no depende de ninguna otra para funcionar.
- Un **registry central** (`src/tools/registry.js`) es la fuente de verdad del catálogo:
  ahí se declara cada herramienta (nombre, ícono, estado, componente) y de ahí sale
  tanto la grilla del home como el ruteo (`/tools/:id`).
- Una herramienta puede estar `available` (funcional, con su propia vista) o
  `coming-soon` (placeholder visual, todavía sin construir).

Sumar una herramienta nueva es de baja fricción: se crea su carpeta y se suma al
registry, sin tocar el armazón ni las demás herramientas existentes.

## Herramientas disponibles

- **Generador de QR** — códigos QR para gráficas de caja, con contenedor opcional.
  Exporta en SVG (impresión) y PNG.
- **Generador de etiquetas** — etiquetas de producto listas para imprenta, de a una o
  en lote desde un Excel. Exporta en SVG o PDF, y al imprimir una suelta permite
  ubicarla en la hoja A4 (para reaprovechar autoadhesivos ya recortados).
- **Generador de Garantías** — tarjetas de garantía de producto (reverso + frente,
  QR de manual incluido), listas para imprenta. Exporta en PDF.
- **Quitar fondo** *(en desarrollo)* — remueve el fondo de una imagen al instante,
  todo client-side.
- **Imagen a DXF para Láser** *(en desarrollo)* — convierte una imagen simple en un
  DXF vectorial para corte o grabado.
- **Buscador de artworks** — busca un producto en el sistema interno y muestra la
  última versión de su artwork: etiquetas, manuales, gráficas, cajas e imágenes.
- **Paletizado** *(en desarrollo)* — consulta el estándar de armado de cada producto
  (cajas por piso, pisos por pallet, observaciones de planta), con un render 3D del
  pallet. No calcula el paletizado: muestra los patrones ya validados por planta.

Las marcadas *(en desarrollo)* son usables, pero todavía inestables o incompletas.
El resto de las tarjetas del home son *"Próximamente"*: existen como placeholder
visual para mostrar hacia dónde crece el catálogo, pero todavía no tienen
funcionalidad real.

## Stack

- **Vite + React**, build a estáticos. Hoy se publica en GitHub Pages.
- **Un backend chico** (Node, en `server/artwork-finder/`) que da servicio a dos cosas:
  el Buscador de artworks —porque el sistema interno no tiene API pública— y las
  sugerencias del hub. El resto de las herramientas no lo necesitan.
- Librerías puntuales por herramienta (QR, generación de PDF vectorial, remoción de
  fondo con IA en el navegador, 3D con three.js, etc.), aisladas dentro de cada módulo
  y cargadas solo al abrir la herramienta que las usa.

## Correrlo en local

```bash
npm install
npm run dev       # entorno de desarrollo
npm run build     # build de producción (carpeta dist/)
npm run preview   # sirve el build de producción en local
```

## Identidad de marca

El sistema visual y de voz (colores, tipografía, logo, tono de los textos) sigue
[`brand.md`](brand.md). Cualquier cambio de UI debe respetar esa guía.

## Para quien contribuya en código

Ver [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md): convenciones de arquitectura,
principio de modularidad y estado actual del proyecto pensados para asistir el
desarrollo (humano o con IA) de nuevas herramientas.
