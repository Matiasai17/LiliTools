/*
 * Lógica de estado del checklist: pura, sin DOM ni React. Portada del HTML
 * original, que la tenía mezclada con el render imperativo.
 */

export const STORAGE_KEY = 'lilitools-artwork-checklist-v2'

/** Todos los ids de item arrancan sin marcar. */
function buildChecks(list) {
  const checks = {}
  list.forEach((a) => {
    checks[a.id] = {}
    a.items.forEach((it) => {
      checks[a.id][it.id] = false
    })
  })
  return checks
}

export function defaultSub(list) {
  return { activeTab: list[0].id, origin: 'nacional', artworkName: '', checks: buildChecks(list) }
}

export function makeDefaultState({ ARTWORKS_UPDATE, ARTWORKS_DEV }) {
  return {
    mode: 'actualizacion',
    update: defaultSub(ARTWORKS_UPDATE),
    dev: defaultSub(ARTWORKS_DEV),
  }
}

/** Reconstruye una sub-sección (`update` o `dev`) validando contra `list`. */
export function mergeSub(parsedSub, list) {
  const base = defaultSub(list)
  if (!parsedSub) return base
  base.origin = parsedSub.origin === 'importada' ? 'importada' : 'nacional'
  base.artworkName = typeof parsedSub.artworkName === 'string' ? parsedSub.artworkName.toUpperCase() : ''
  base.activeTab = list.some((a) => a.id === parsedSub.activeTab) ? parsedSub.activeTab : list[0].id
  list.forEach((a) => {
    a.items.forEach((it) => {
      if (parsedSub.checks && parsedSub.checks[a.id] && typeof parsedSub.checks[a.id][it.id] === 'boolean') {
        base.checks[a.id][it.id] = parsedSub.checks[a.id][it.id]
      }
    })
  })
  return base
}

/** Reconstruye el estado completo desde algo parseado de localStorage o un PDF. */
export function mergeFullState(parsed, lists) {
  const base = makeDefaultState(lists)
  if (parsed) {
    base.mode = parsed.mode === 'desarrollo' ? 'desarrollo' : 'actualizacion'
    base.update = mergeSub(parsed.update, lists.ARTWORKS_UPDATE)
    base.dev = mergeSub(parsed.dev, lists.ARTWORKS_DEV)
  }
  return base
}

export function currentArtworks(state, { ARTWORKS_UPDATE, ARTWORKS_DEV }) {
  return state.mode === 'desarrollo' ? ARTWORKS_DEV : ARTWORKS_UPDATE
}

export function currentSub(state) {
  return state.mode === 'desarrollo' ? state.dev : state.update
}

export function itemLabel(item, origin) {
  if (item.textByOrigin) return item.textByOrigin[origin] || item.textByOrigin.nacional
  return item.text
}

/** Ítems visibles de un checklist para el origen actual (filtra los `conditional`). */
export function visibleItems(art, origin) {
  return art.items.filter((it) => !it.conditional || it.conditional === origin)
}

export function tabProgress(art, sub) {
  const items = visibleItems(art, sub.origin)
  const done = items.filter((it) => sub.checks[art.id][it.id]).length
  return { done, total: items.length }
}

export function globalProgress(artworks, sub) {
  let done = 0
  let total = 0
  artworks.forEach((a) => {
    const p = tabProgress(a, sub)
    done += p.done
    total += p.total
  })
  return { done, total }
}

export function sanitizeFilename(str) {
  return (
    (str || 'SIN-NOMBRE')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'SIN-NOMBRE'
  )
}

export function formatTimestamp(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ----- Persistencia local -----
// Siempre localStorage: no hay backend para este tool (ver AGENTS.md). El PDF
// exportado es el mecanismo real para pasar el progreso a otra máquina/persona.

export function loadStateFromStorage(lists) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return mergeFullState(JSON.parse(raw), lists)
  } catch {
    /* localStorage bloqueado o JSON corrupto: arranca en default */
  }
  return makeDefaultState(lists)
}

export function saveStateToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* localStorage puede estar bloqueado (modo privado); no es crítico */
  }
}
