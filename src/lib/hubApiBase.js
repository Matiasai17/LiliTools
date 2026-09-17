/*
 * URL base del backend compartido de LiliTools (ver server/artwork-finder),
 * que sirve tanto al Buscador de artworks como a las sugerencias del hub.
 * Se configura en build con VITE_HUB_API_BASE; en desarrollo cae a localhost:3000.
 */

export const HUB_API_BASE = (import.meta.env.VITE_HUB_API_BASE || 'http://localhost:3000').replace(/\/$/, '')

/** ¿Está configurada explícitamente la URL del backend? (para avisos en prod). */
export const isHubApiConfigured = Boolean(import.meta.env.VITE_HUB_API_BASE)
