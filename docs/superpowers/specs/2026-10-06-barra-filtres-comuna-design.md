# Barra de filtres comuna a tots els llistats

**Data:** 2026-10-06 · **Estat:** aprovat el disseny en xat per l'Andrés; pendent de revisar aquest document

## 1. Per què

La capçalera nova d'Inventari (PR #25) ocupa dues línies en lloc de quatre:
- un **botó «Filtres»** que obre un panell amb els desplegables;
- **xips** per als filtres actius;
- **comptadors en píndola**, que a més filtren.

L'Andrés la vol a tots els llistats. Avui cada pantalla té la seva barra feta a mà, i cadascuna és diferent.

## 2. Decisions preses

- **Una sola peça comuna**, i cada pantalla només declara els seus filtres. Si el disseny canvia, canvia a totes alhora.
- **Les 9 pantalles en un sol treball**:
  - Incidències;
  - Préstecs;
  - Reserves;
  - Material i Stock;
  - Manteniment;
  - Base de Coneixement;
  - Excursions;
  - Correus;
  - Material Infantil (pestanya Catàleg).
- **Inventari també passa a la peça comuna**, perquè no en quedin dues còpies.
- **La lògica de filtrar de cada pantalla no es toca.** Només canvia com es presenten els filtres que ja hi ha: ni filtres nous, ni cercadors nous, ni canvis a les taules.
- **Les dates** de Reserves i Correus van dins del panell.
- **Comptadors que no són un filtre** (Ítems, Unitats, Total…): píndoles informatives, sense clic.

## 3. Peces comunes (`src/components/filtres/`)

### 3.1 Mòdul pur `filtres.ts` (amb proves)

```ts
export interface OpcioFiltre { valor: string; etiqueta: string }

export type DefinicioFiltre =
  | { clau: string; label: string; tipus: 'select'; totes: string; opcions: OpcioFiltre[] }
  | { clau: string; label: string; tipus: 'data' }

export type ValorsFiltres = Record<string, string>   // '' = sense filtre

export interface FiltreActiu { clau: string; etiqueta: string }

// Un xip per cada filtre amb valor:
// - desplegable: «Label: etiqueta de l'opció»;
// - data: «Label: dd/mm/aaaa».
// Segueix l'ordre de les definicions.
export function filtresActius(defs: DefinicioFiltre[], valors: ValorsFiltres): FiltreActiu[]
```

Si un valor no és entre les opcions (per exemple, una opció que han tret de Configuració), el xip mostra el valor tal qual.

### 3.2 `BarraFiltres.tsx`

**Props:**
- `definicions`, `valors` i `onCanvia(clau, valor)`;
- `onEsborra()`, que posa tots els filtres a `''` i no toca la cerca;
- opcionals `cerca`, `onCerca` i `placeholder`. Sense aquestes props no es pinta el quadre de cerca.

**Comportament** (com a l'Inventari d'avui):
- botó «Filtres» amb el nombre de filtres actius;
- panell sota el botó, amb un camp per definició i «Esborra filtres» al peu;
- es tanca clicant fora o amb Esc;
- xips amb ×, i «Esborra-ho tot» si n'hi ha més d'un.

### 3.3 `PindolesFiltre.tsx`

**Props:** `pindoles: { label, val, color, filtre?: { clau, valor } }[]`, més `valors` i `onCanvia`.

- **Amb `filtre`**: és un botó. Si `valors[clau] === valor` és activa; clicar-la quan ja ho és posa el filtre a `''`.
- **Sense `filtre`**: és informativa i no té clic.

### 3.4 Capçalera

Cada pantalla compon tres línies amb els seus propis títols i botons:
1. títol, recompte, píndoles i accions, en una línia que s'embolcalla en pantalles estretes;
2. `BarraFiltres`;
3. xips, que els pinta `BarraFiltres` mateixa.

## 4. Per pantalla

| Pantalla | Filtres (al panell) | Cerca | Píndoles que filtren |
|---|---|---|---|
| Inventari | Estat (amb «Avariats o en reparació»), Tipus, Ubicació, Acció pendent | sí | Actius, Avariats o en reparació, En préstec, De baixa |
| Incidències | Estat, Prioritat, Tipus | sí | Obertes, En curs, Tancades |
| Préstecs | Estat | sí | Actius, Vençuts, Retornats |
| Reserves | Estat, Data | sí | Pendents, Confirmades (Avui, informativa) |
| Material i Stock | Categoria | sí | cap (Ítems, Unitats, En préstec, Stock baix: informatives) |
| Manteniment | Estat, Categoria | no | Pendents, En gestió, Resolts (Urgents, informativa) |
| Base de Coneixement | Tipus, Categoria | sí | cap (Total, Publicats, Esborranys: informatives) |
| Excursions | Etapa, Estat, Mes | no | — |
| Correus | Estat, Des de, Fins a | no | — |
| Material Infantil · Catàleg | Categoria | sí | — |

Si una píndola de la taula no correspon exactament a un valor del filtre d'estat de la pantalla, queda informativa. No s'inventa cap filtre nou per fer-la clicable.

## 5. Inventari

- `src/modules/inventari/filtres.ts` conserva `filtraInventari`.
- Els xips passen a sortir de `filtresActius` comú. Els valors especials (`avariats`, `qualsevol`) es declaren com a opcions amb la seva etiqueta.

## 5 bis. Préstecs: camp «Destí»

**Per què:** el material de robòtica va a Material i Stock (categoria «Robòtica»). Quan es presta a una classe, l'Andrés vol saber quants kits surten i **on** han anat. Avui el préstec només guarda la persona.

- **Base de dades:** migració nova que afegeix `prestecs.desti text not null default ''`. Hi ha també un `create or replace` de `create_loan` que desa `p_data->>'desti'` (`coalesce` a `''`). La resta de la funció queda igual.
  - Abans de fer-la, s'ha comprovat que la versió de producció de `create_loan` és idèntica a la de `202609130003_integrity.sql`.
- **Tipus i dades:** `Prestec.Desti: string`, també a `PrestecFormData`. `usePrestecs` el llegeix de `desti` i l'envia a `create_loan`.
- **Formulari:** camp opcional «Destí (aula o grup)», amb el placeholder «Ex.: 5è A · aula 12».
- **Llistat:**
  - el destí es veu sota la persona, en gris;
  - la cerca de Préstecs també hi mira.
- **Detall:** fila «Destí» quan no és buit.
- **Fora d'abast:** editar el destí d'un préstec ja creat. Avui només les notes són editables.
- **Ordre de desplegament:** la migració s'aplica a producció **abans** de fusionar. Si es fusionés abans, el client enviaria un camp que la funció ignora, i el llistat no en trobaria la columna.

## 6. Proves

- **Base de dades** (`tests/database.test.ts`): `create_loan` desa `desti`, i sense `desti` el deixa a `''`.

- **Mòdul pur `filtres.ts`**, amb Vitest:
  - etiquetes de desplegable i de data;
  - valor fora de les opcions;
  - ordre dels xips;
  - valors buits.
- **`npm run typecheck`, `lint` i `test`** nets.
- **Les pantalles no tenen proves de components** (Vitest corre sense DOM). La comprovació visual la fa l'Andrés.

## 7. Fora d'abast

- Filtres o cercadors nous.
- Canvis a les taules o a la lògica de filtrar.
- Horaris i Configuració: els seus desplegables no són filtres d'un llistat.
- Substitucions (pestanya Totes) i Proveïdors d'Infantil: només tenen un quadre de cerca, que no ocupa espai de més.
