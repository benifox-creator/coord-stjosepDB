// Separat de BlocEconomic.tsx i no dins seu: un fitxer de component només pot
// exportar el component (regla react-refresh/only-export-components), i així
// la guarda es pot provar sense haver de renderitzar res.

/**
 * Un preu que no és un número real (NaN, típicament d'un camp de preu buidat
 * o amb un "-" solitari) no es pot desar ni confirmar: en sortir cap al
 * servidor, `JSON.stringify(NaN)` es converteix en `null`, i un preu `null`
 * no vol dir "gratuït", vol dir una dada trencada que ha passat sense avisar.
 */
export function preuEsValid(preu: number): boolean {
  return Number.isFinite(preu)
}
