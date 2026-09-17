# Backend compartido de LiliTools

Proceso Node/Express **aparte** del hub estático que cubre dos funcionalidades que
no pueden correr 100% en el navegador:

1. **Buscador de artworks** — proxy autenticado contra el sistema interno de Liliana
   (`gestion.liliana.com.ar`).
2. **Sugerí una mejora** — guarda las sugerencias del panel del hub en un archivo
   compartido, para que sean visibles para todos los visitantes (no solo por
   navegador vía `localStorage`).

El hub (frontend React) le pega a esta API por HTTP.

## Por qué existe cada parte

**Buscador de artworks:** el sistema interno es una app PHP vieja, **sin API
pública, sin CORS y con auth por cookie** (`PHPSESSID`). Un navegador no puede
pedirle datos desde otro dominio, ni adjuntar esa cookie cross-origin, ni debería
tener el secreto de sesión en código cliente. Por eso este backend guarda la cookie
server-side, hace los pedidos autenticados, parsea el HTML y devuelve JSON limpio +
hace de proxy de las imágenes/PDFs.

**Sugerencias:** LiliTools no tiene base de datos ni servidor propio; para que una
sugerencia escrita por alguien sea visible para cualquier otra persona que abra el
panel, tiene que guardarse en un lugar compartido — no puede vivir solo en el
navegador de quien la escribió.

## Qué expone

| Ruta | Qué hace |
|------|----------|
| `GET /` | Health check (JSON `{ ok: true, ... }`). |
| `GET /api/tipos` | Catálogo de tipos de artwork (para el selector del frontend). |
| `GET /api/buscar?codigo=VTHA604&tipo=etiquetas` | Busca y devuelve grupos + versión "última". |
| `GET /api/archivo?url=...` | Proxy autenticado de una imagen/PDF del sistema interno. |
| `GET /api/sugerencias` | Todas las sugerencias guardadas, más nueva primero. |
| `POST /api/sugerencias` | Guarda una sugerencia nueva. Body JSON `{ name?, message }`. |

Tipos de artwork soportados: **Etiquetas**, **Manuales**, **Gráficas**, **Cajas**,
**Imágenes en alta** (ver `lib/sources.js`).

## Configuración (variables de entorno)

Copiá `.env.example` a `.env` (en local) o cargá estas variables en el panel del
hosting:

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `PHPSESSID` | Solo para el buscador | Cookie de sesión ya logueada en `gestion.liliana.com.ar`. Sin ella, `/api/buscar` y `/api/archivo` fallan con 500; el resto del backend (sugerencias) funciona igual. |
| `PORT` | No | Puerto de escucha (default `3000`). |
| `ALLOWED_ORIGIN` | Recomendada | Dominio(s) del hub permitidos por CORS, separados por coma. Vacío = cualquiera. |

> `PHPSESSID` es un **secreto**: nunca se commitea (está en `.gitignore`) y nunca
> llega al navegador. Cuando expira, la app devuelve `401` con un mensaje claro;
> hay que renovarla (loguearse de nuevo y actualizar la variable en el hosting).

## Persistencia de las sugerencias

Se guardan en `data/suggestions.json` (archivo simple, gitignoreado — es dato de
runtime, no fuente). Alcanza sin problema para el volumen esperado de un formulario
interno. **Ojo:** en hostings con filesystem efímero (algunos planes gratuitos de
Render/Railway/etc.) ese archivo puede perderse en cada redeploy; si eso pasa en la
práctica, hay que montar un disco persistente o migrar a una base de datos real.

## Correr en local

```bash
cd server/artwork-finder
npm install
cp .env.example .env      # completá PHPSESSID (para el buscador)
npm start                 # http://localhost:3000
```

Probá:
- `http://localhost:3000/api/sugerencias` (funciona sin `PHPSESSID`)
- `http://localhost:3000/api/buscar?codigo=VTHA604&tipo=etiquetas` (necesita `PHPSESSID`)

## Hostear (producción)

1. Subí esta carpeta (`server/artwork-finder`) a un hosting que **corra Node ≥18**
   (Hostinger VPS/Cloud, Render, Railway, Fly.io, etc. — **no** un plan de hosting
   estático puro).
2. `npm install` en el server.
3. Configurá las variables de entorno: `PHPSESSID`, y `ALLOWED_ORIGIN` con el
   dominio del hub (ej. `https://liliana.com.ar`).
4. Arrancá con `npm start` (idealmente detrás de un process manager como `pm2`, o
   el que ofrezca la plataforma).
5. Anotá la URL pública del backend (ej. `https://api.tudominio.com`): esa URL va
   en la variable `VITE_HUB_API_BASE` **del build del hub** (ver README raíz de
   LiliTools). Así el frontend sabe a dónde pegarle, tanto para el buscador como
   para las sugerencias.

## Nota de seguridad

- Restringí `ALLOWED_ORIGIN` al dominio del hub.
- Con backend hosteado, **una sola** sesión (`PHPSESSID`) queda del lado del server
  y la comparten todos los que usen el buscador desde el hub; hay que renovarla
  manualmente cuando expira (no hay login automático).
- Las sugerencias quedan abiertas (cualquiera que use el hub puede escribir una y
  ver todas). Si en algún momento hace falta moderarlas o filtrarlas, es un cambio
  a futuro sobre `lib/suggestionsStore.js` + el endpoint `GET /api/sugerencias`.
