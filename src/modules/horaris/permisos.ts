import type { Rol } from '../usuaris/types'

export function potVeureTotHorari(rol: Rol | null): boolean {
  return rol === 'coordinador' || rol === 'direccio' || rol === 'titular' || rol === 'cap_estudis'
}
