/*
 * Codificación del progreso dentro de los metadatos de un PDF exportado.
 *
 * El PDF que genera "Guardar PDF" es el mecanismo real de guardado entre
 * sesiones/máquinas (no hay backend para este tool): además del resumen
 * visible, el JSON del estado va codificado en base64 dentro del campo
 * Keywords del PDF. "Subir PDF" lo relee para retomar donde quedó.
 *
 * IMPORTANTE — compatibilidad con PDFs ya guardados por el equipo: estos
 * marcadores y el shape del payload son los mismos que usaba la versión
 * standalone de esta herramienta (antes de sumarla a LiliTools). No cambiar
 * sin pensar en los PDFs que la gente ya tiene guardados como "save file".
 */
export const STATE_MARKER = 'ARTWORKCHECKLIST_V2:'
export const OLD_MARKER = 'ARTWORKCHECKLIST_V1:' // formato previo, se sigue leyendo

function toBase64Utf8(str) {
  return btoa(unescape(encodeURIComponent(str)))
}

function fromBase64Utf8(b64) {
  return decodeURIComponent(escape(atob(b64)))
}

/** Payload que viaja dentro del PDF: la sub-sección activa, no el estado completo. */
export function buildExportPayload(state, sub) {
  return {
    mode: state.mode,
    activeTab: sub.activeTab,
    origin: sub.origin,
    artworkName: sub.artworkName,
    checks: sub.checks,
  }
}

export function encodeKeywords(payload) {
  return STATE_MARKER + toBase64Utf8(JSON.stringify(payload))
}

/**
 * Parsea el campo Keywords de un PDF leído. Devuelve `{ mode, payload }` o
 * `null` si esos Keywords no tienen progreso de esta app.
 */
export function decodeKeywords(keywords) {
  const kw = keywords || ''
  const idxV2 = kw.indexOf(STATE_MARKER)
  if (idxV2 !== -1) {
    const b64 = kw.slice(idxV2 + STATE_MARKER.length).trim()
    const raw = JSON.parse(fromBase64Utf8(b64))
    return { mode: raw.mode === 'desarrollo' ? 'desarrollo' : 'actualizacion', payload: raw }
  }
  const idxV1 = kw.indexOf(OLD_MARKER)
  if (idxV1 !== -1) {
    const b64 = kw.slice(idxV1 + OLD_MARKER.length).trim()
    const raw = JSON.parse(fromBase64Utf8(b64))
    return { mode: 'actualizacion', payload: raw } // V1 no tenía modo: siempre era "actualización"
  }
  return null
}
