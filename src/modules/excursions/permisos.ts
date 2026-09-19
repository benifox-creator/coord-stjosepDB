import type { Rol, Usuari } from '../usuaris/types'
import type { Excursio } from './types'

const ROLS_AMB_DINERS: Rol[] = ['coordinador', 'direccio', 'titular']

/** Qui aprova o rebutja una proposta. */
export function potAprovar(rol: Rol | null): boolean {
  return rol !== null && ROLS_AMB_DINERS.includes(rol)
}

/**
 * Qui pot reservar, enviar la circular i cancel·lar. Inclou qui tingui
 * qualsevol de les dues caselles: la de costos també dona logística.
 * Ha de coincidir amb `app_private.excursions_gestio()` al servidor.
 */
export function potGestionar(rol: Rol | null, usuari: Usuari | null): boolean {
  if (rol !== null && ROLS_AMB_DINERS.includes(rol)) return true
  return Boolean(usuari?.PotGestionarExcursions || usuari?.PotGestionarCostosExcursions)
}

/**
 * Qui veu i edita els costos. A la Fase A encara no hi ha cap dada econòmica;
 * es defineix ara perquè el client i el servidor diguin el mateix des del
 * primer dia. Ha de coincidir amb `app_private.excursions_costos()`.
 */
export function potVeureCostos(rol: Rol | null, usuari: Usuari | null): boolean {
  if (rol !== null && ROLS_AMB_DINERS.includes(rol)) return true
  return Boolean(usuari?.PotGestionarCostosExcursions)
}

/** Qui pot editar una excursió: el seu autor mentre és esborrany, o qui gestiona. */
export function potEditar(e: Excursio, email: string, rol: Rol | null, usuari: Usuari | null): boolean {
  if (potGestionar(rol, usuari)) return true
  return e.Estat === 'Esborrany' && e.Creat_per.toLowerCase() === email.toLowerCase()
}
