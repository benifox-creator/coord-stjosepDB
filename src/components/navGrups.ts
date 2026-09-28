// src/components/navGrups.ts
//
// Agrupa les entrades del menú lateral i treu els grups que es queden sense
// cap element visible per a qui mira. Aïllat de tota la resta perquè és una
// decisió que s'ha de poder provar sense muntar cap component — Vitest corre
// sense DOM en aquest projecte.

export interface GrupMenu<Item> {
  titol: string
  items: Item[]
}

/**
 * Filtra els items de cada grup amb `esVisible` i treu els grups que es
 * queden buits. L'ordre dels grups i dels items que hi queden no canvia:
 * només desapareixen els que `esVisible` descarta.
 */
export function grupsVisibles<Item>(
  grups: GrupMenu<Item>[],
  esVisible: (item: Item) => boolean,
): GrupMenu<Item>[] {
  return grups
    .map((g) => ({ titol: g.titol, items: g.items.filter(esVisible) }))
    .filter((g) => g.items.length > 0)
}
