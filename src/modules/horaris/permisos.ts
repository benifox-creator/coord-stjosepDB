import type { Rol } from '../usuaris/types'

export function potVeureTotHorari(rol: Rol | null): boolean {
  return rol === 'coordinador' || rol === 'direccio' || rol === 'titular' || rol === 'cap_estudis'
}

// Només la coordinació pot tocar l'horari d'una altra persona. La resta de
// càrrecs el veuen però no l'editen; és el mateix que aplica la política
// `own_schedule` al servidor, i aquí només serveix per no oferir una acció
// que la base de dades rebutjaria.
export function potEditarHorarisAliens(rol: Rol | null): boolean {
  return rol === 'coordinador'
}
