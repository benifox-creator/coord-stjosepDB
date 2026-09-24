import type { Rol, Usuari } from '../usuaris/types'

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
