// Què s'ha recaptat d'una excursió. Va a part perquè és l'entrada del panell
// econòmic que ve després, i perquè així es prova sense muntar cap pantalla.
import type { ExcursioGrup } from './types'

export function totalPagats(grups: ExcursioGrup[]): number {
  return grups.reduce((s, g) => s + g.AlumnesPagats, 0)
}

/**
 * Els diners que han entrat. `null` quan encara no hi ha preu confirmat: no és
 * el mateix que zero, i a un panell econòmic confondre-ho ensenyaria una
 * pèrdua que no existeix.
 */
export function recaptat(grups: ExcursioGrup[], preuAlumne: number | null): number | null {
  if (preuAlumne === null) return null
  // En cèntims: 3 × 10,10 en coma flotant fa 30,299999999999997, i això
  // acabaria imprès en una pantalla que parla de diners.
  return Math.round(totalPagats(grups) * preuAlumne * 100) / 100
}
