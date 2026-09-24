import type { Rol, Usuari } from '../usuaris/types'
import { canAccessModul } from '../../store/configStore'

/**
 * Qui veu el mòdul: ha de dir exactament el mateix que
 * `app_private.module_visible('coneixement')` al servidor (migració
 * `202609240001_coneixement_redaccio.sql`) — la casella de redactar dona
 * accés per si sola encara que el rol no en tingui, i si no hi ha casella,
 * mana la configuració de visibilitat com per a qualsevol altre mòdul.
 * Mateix patró que `potVeureMaterialInfantil`.
 */
export function potVeureConeixement(
  usuari: Usuari | null,
  rol: Rol | null,
  config: Record<string, string[]>,
): boolean {
  if (rol === 'coordinador') return true
  if (usuari?.PotRedactarConeixement) return true
  return canAccessModul(config, 'coneixement', rol)
}

/**
 * Qui redacta: crea, edita i veu els esborranys. No és un càrrec, és una
 * casella —qui sap explicar una cosa no coincideix amb cap organigrama—,
 * tret del coordinador, que hi entra sempre. Ha de coincidir amb
 * `app_private.coneixement_redactor()` a la migració
 * `202609240001_coneixement_redaccio.sql`.
 */
export function potRedactar(rol: Rol | null, usuari: Usuari | null): boolean {
  if (rol === 'coordinador') return true
  return Boolean(usuari?.PotRedactarConeixement)
}

/**
 * Qui publica un article i qui n'esborra un ja publicat: només el
 * coordinador. Cap casella hi dona accés — a diferència de redactar, aquí no
 * hi ha «rol o casella», només rol. Ha de coincidir amb `app_private.admin()`,
 * la mateixa comprovació que fan `publica_article` i la política
 * `module_delete` per a una fila publicada.
 */
export function potPublicar(rol: Rol | null): boolean {
  return rol === 'coordinador'
}

/**
 * Qui pot esborrar un article concret: el coordinador, sempre; qui redacta,
 * només mentre encara és un esborrany seu — un cop publicat, ja no en fa
 * prou amb la casella. Ha de coincidir exactament amb la política
 * `module_delete` de la migració `202609240001_coneixement_redaccio.sql`:
 * `admin() or (coneixement_redactor() and not publicat)`.
 */
export function potEliminar(rol: Rol | null, usuari: Usuari | null, publicat: boolean): boolean {
  return potPublicar(rol) || (potRedactar(rol, usuari) && !publicat)
}
