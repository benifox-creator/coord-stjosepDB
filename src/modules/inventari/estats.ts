// Els nou estats d'un dispositiu. Són fixos i no una llista de Configuració:
// el Dashboard i les etiquetes de color en depenen, i la base de dades
// (inventari_estat_check) admet exactament aquests.
export const ESTATS_INVENTARI = [
  'Actiu', 'Avariat', 'En reparació', 'En préstec', 'En proves',
  'No desplegat', 'Retirat temporalment', 'De baixa', 'Robat',
] as const

export type EstatInventari = typeof ESTATS_INVENTARI[number]

// El que compta la targeta del Dashboard: tot el que necessita que algú hi
// faci alguna cosa per tornar a funcionar.
export function esAvariat(estat: EstatInventari): boolean {
  return estat === 'Avariat' || estat === 'En reparació'
}
