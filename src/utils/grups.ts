/**
 * Opcions per a un desplegable de grup. Hi afegeix el valor actual si no és a
 * la llista: els registres antics porten noms d'abans d'unificar la
 * nomenclatura, i obrir-los no ha de buidar-los en silenci.
 */
export function opcionsDeGrup(disponibles: string[], actual: string): string[] {
  if (!actual || disponibles.includes(actual)) return disponibles
  return [actual, ...disponibles]
}
