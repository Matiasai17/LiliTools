import { useState } from 'react'

/*
 * Filtro de rol del home ('ingeniero' | 'diseñador'), persistido en localStorage
 * igual que useTheme.js. A diferencia del tema, no hay valor por defecto: en la
 * primera visita `role` es `null` (ningún rol elegido todavía) y el home muestra
 * todas las tarjetas por igual. Recién cuando el usuario elige un rol se guarda
 * y se aplica el filtro; el selector queda siempre visible para poder cambiarlo.
 */

const STORAGE_KEY = 'lilitools-role'
const VALID_ROLES = ['ingeniero', 'diseñador']

function getInitialRole() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return VALID_ROLES.includes(stored) ? stored : null
  } catch {
    // localStorage puede estar bloqueado (modo privado); arrancamos sin rol.
    return null
  }
}

/** Devuelve `[role, setRole]`. `role` es 'ingeniero' | 'diseñador' | null. */
export function useRole() {
  const [role, setRoleState] = useState(getInitialRole)

  function setRole(next) {
    setRoleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage puede estar bloqueado; el filtro sigue funcionando para
      // la sesión actual, solo no se persiste para la próxima visita.
    }
  }

  return [role, setRole]
}
