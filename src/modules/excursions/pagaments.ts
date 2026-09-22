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

/**
 * Què s'ha d'enviar al servidor quan algú acaba d'escriure al camp de
 * pagaments. `null` vol dir «res a enviar»: o el que hi ha escrit no és un
 * recompte que puguem desar, o ja és el que hi ha desat i la crida seria de
 * franc (i amb ella una recàrrega de tota la llista).
 *
 * Només dígits. Un `input type="number"` deixa escriure-hi «1e3», i `Number()`
 * ho converteix en 1000 sense dir res: apuntar mil pagaments en un grup de
 * vint-i-cinc perquè algú ha premut la «e» és pitjor que no fer res, i el
 * «més pagaments que previsions» ho ensenyaria en gris, com si fos correcte.
 * Els zeros del davant sí que passen: «007» són set pagaments i prou.
 */
export function pagamentsAApuntar(text: string, desat: number): number | null {
  const net = text.trim()
  if (!/^\d+$/.test(net)) return null
  const valor = Number(net)
  if (!Number.isSafeInteger(valor)) return null
  return valor === desat ? null : valor
}
