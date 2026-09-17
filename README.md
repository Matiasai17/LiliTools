# LiliTools

Hub web de herramientas internas para **Liliana Electrodomésticos**: un home con
tarjetas, donde cada tarjeta abre una herramienta chica y autocontenida. Hecho con
**Vite + React**, se despliega como estáticos (hoy en GitHub Pages).

## Arquitectura

Es un **shell + catálogo de herramientas**:

- El **armazón** (home, navegación, estilo base, tema claro/oscuro) es compartido.
- Cada **herramienta** vive aislada en `src/tools/<id>/` y se declara en el
  **registry central** (`src/tools/registry.js`), que alimenta la grilla del home y
  el ruteo (`/tools/:id`).
- Casi todas las herramientas corren **100% en el navegador**, sin backend.
  - **Excepción:** el *Buscador de artworks* y las sugerencias del panel "Sugerí una
    mejora" dependen de un backend compartido (ver abajo) — el primero porque
    consume el sistema interno de Liliana (sin API pública ni CORS), el segundo
    para que las sugerencias sean visibles para todos y no solo por navegador.

## Correr en local

```bash
npm install
npm run dev       # desarrollo
npm run build     # build de producción (dist/)
npm run preview   # sirve el build en local
```

## Variables de entorno (build)

Copiá `.env.example` a `.env`. Solo las variables `VITE_` llegan al cliente.

| Variable | Para qué |
|----------|----------|
| `VITE_HUB_API_BASE` | URL pública del backend compartido (*Buscador de artworks* + sugerencias). En dev, si no se define, usa `http://localhost:3000`. En producción es obligatoria para que ambos funcionen. |

## Backend compartido (artworks + sugerencias)

Dos funcionalidades del hub tienen su parte de frontend acá y su parte de backend
aparte, en `server/artwork-finder/` (mismo proceso Node para las dos):

1. **Buscador de artworks** (`src/tools/artwork-finder/`) — proxy autenticado contra
   `gestion.liliana.com.ar`.
2. **Sugerí una mejora** (`src/components/SuggestionPanel.jsx`) — guarda las
   sugerencias en el servidor para que sean visibles para todos, no solo por
   navegador.

**Hay que hostear `server/artwork-finder` por separado**, en un entorno que corra
Node ≥18, y apuntar `VITE_HUB_API_BASE` a su URL. Ver
[`server/artwork-finder/README.md`](server/artwork-finder/README.md) para el detalle
de deploy, endpoints y variables (`PHPSESSID`, `ALLOWED_ORIGIN`).

Si el backend no está configurado/disponible, el resto del hub funciona igual; solo
esas dos partes mostrarán un aviso de que no se pudo conectar.

## Identidad de marca

El sistema visual y de voz sigue [`brand.md`](brand.md). Convenciones de arquitectura
y estilo en [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md).
