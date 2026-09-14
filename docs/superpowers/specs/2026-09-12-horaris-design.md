# Horaris — Design Spec

**Objectiu:** Mòdul nou perquè cada professor introdueixi el seu horari lectiu i no lectiu setmanal, que la resta de càrrecs el puguin consultar, i que serveixi de font de dades perquè, en generar una absència, es creïn soles les substitucions corresponents amb Etapa/Grup/Matèria ja emplenats.

**Origen:** Queda explícitament fora d'abast al pla "Millores Absències + Substitucions" (2026-09-08): *"la idea de l'horari de professorat / suggeriment automàtic de substitut queda fora d'abast d'aquest pla — és una iniciativa separada i molt més gran, a dissenyar més endavant."* Aquesta spec és aquesta iniciativa.

---

## Model de dades

Taules noves, mateixa convenció que la resta de `schema.sql` (`snake_case`, `id uuid primary key default gen_random_uuid()`, RLS amb la mateixa política permissiva `anon_full_access` — el control d'accés real viu al frontend, com a tot SJO Hub).

### `horaris`

Una fila = un període setmanal recurrent d'un professor.

| Camp | Tipus | Notes |
|---|---|---|
| `id` | uuid pk | |
| `professor` | text not null | email, igual que `absencies.professor` i `substitucions.professor_absent` |
| `dia_setmana` | text not null | check: `Dilluns, Dimarts, Dimecres, Dijous, Divendres` |
| `etapa` | text not null | check: mateixos valors que `ETAPES_SUBSTITUCIO` (`EI, EP, ESO 1r-2n, ESO 3r-4t, BATX, GM`) |
| `franja` | text not null | reutilitza literalment els strings de `substitucions.franges.<ETAPA>` ja existents a `configStore.ts` |
| `tipus` | text not null default `'Lectiva'` | check: `Lectiva, No lectiva` |
| `grup` | text not null default `''` | només rellevant si `tipus = 'Lectiva'` |
| `materia` | text not null default `''` | si `tipus = 'Lectiva'`: matèria. Si `tipus = 'No lectiva'`: hi guarda el tipus (Guàrdia, Pati...) triat de la llista de config nova — **es reutilitza el mateix camp** per no duplicar columnes |
| `creat_el`, `creat_per` | text | com a la resta de mòduls |

`unique (professor, dia_setmana, franja)` — un professor no pot tenir dos períodes al mateix dia i franja.

### `absencia_periodes`

Una fila = un període concret marcat com a afectat en crear una absència. **És una fotografia**, no una referència viva a `horaris`: si el professor canvia el seu horari més endavant, l'històric de l'absència no es veu alterat. Mateix criteri que ja fa servir la resta de l'app (p.ex. `professor` com a string, no FK a `usuaris`).

| Camp | Tipus | Notes |
|---|---|---|
| `id` | uuid pk | |
| `absencia_id` | uuid not null | FK → `absencies(id) on delete cascade` |
| `franja` | text not null | |
| `etapa` | text not null | |
| `tipus` | text not null | check: `Lectiva, No lectiva` |
| `grup` | text not null default `''` | |
| `materia` | text not null default `''` | |

### Config nova

Reutilitza la taula `config` (clau/valors) existent, mateix patró que `substitucions.franges.*`:

- `horaris.tipus-no-lectiva` → `['Guàrdia', 'Pati', 'Tutoria', 'Coordinació', 'Reunió', 'Hora lliure']`, editable des de Configuració com la resta de llistes.

---

## Permisos

**Editar el propi horari:**
- Qualsevol professor pot afegir/editar/eliminar el seu propi horari en qualsevol moment, sense aprovació — és informatiu, no un procés amb estat.

**Veure horaris d'altres:**
- `potVeureTotHorari(rol)` → `true` per `coordinador, direccio, titular, cap_estudis`. Resta de rols només veuen el seu propi horari.

**Visibilitat del mòdul:**
- `visibilitat.horaris` (config, mateix sistema que la resta de mòduls) → tots els rols excepte `convidat`.
- `convidat` no té accés al mòdul (no és professorat, no necessita horari).

---

## Estructura del mòdul (navegació)

Nou ítem al menú lateral: **"Horaris"**, dins `src/modules/horaris/`, seguint la mateixa convenció de fitxers que `material-infantil` (types.ts, `horaris.utils.ts` amb els mappers row↔domini, `useHoraris.ts` store zustand, `permisos.ts`, formularis, `HorarisPage.tsx` amb pestanyes):

1. **El meu horari** — graella setmanal (columnes Dilluns–Divendres, files = franges de la seva Etapa per defecte). Clic a una cel·la buida obre `HorariSlotForm` (Etapa → filtra Franja disponibles → Lectiva/No lectiva → si Lectiva: Grup + Matèria obligatoris; si No lectiva: desplegable de `horaris.tipus-no-lectiva` obligatori). Clic a una cel·la ocupada l'edita amb el mateix formulari.
2. **Tots els horaris** — només visible si `potVeureTotHorari(rol)`. Selector de professor (llista de `useUsuarisStore`) + la mateixa graella en mode només lectura. **Deliberat**: en v1 ningú edita l'horari d'un altre professor, ni tan sols coordinació — evita canvis fets sense que el professor titular de l'horari se n'assabenti.

---

## Integració amb Absències (`AbsenciaForm.tsx`)

En triar la `Data`, es calcula el dia de la setmana i es consulten a `useHoraris` els períodes del professor per aquell dia:

- **Si n'hi ha**: es mostren com a checkboxes (`Franja — Grup Matèria` o `Franja — [tipus no lectiva]`), en lloc dels camps lliures d'hora d'inici/fi. En marcar/desmarcar:
  - `HoraInici` = inici del primer període marcat; `HoraFi` = fi de l'últim.
  - `Hores` = suma de durades dels períodes marcats.
  - `HoresNoLectives` = suma de durades dels períodes marcats amb `tipus = 'No lectiva'` (deixa de ser un camp manual).
  - En desar, es creen les files corresponents a `absencia_periodes` (una per període marcat).
- **Si no n'hi ha** (professor sense horari carregat aquell dia): cau al formulari manual d'avui (inputs lliures d'hora + `HoresNoLectives` manual) — no es trenca cap cas existent.

---

## Integració amb Substitucions (`useAbsencies.ts` → `aprovar()`)

En aprovar una absència, per cada fila de `absencia_periodes` amb `tipus = 'Lectiva'` es crea automàticament una `Substitucio`:

- `Data` = `absencia.Data`, `Etapa`/`Franja`/`Grup`/`Materia` = els del període, `Tipus = 'Classe'`, `ProfessorAbsent` = `absencia.Professor`, `ProfessorSubstitut = ''`, `Estat = 'Pendent'`, `Absencia_ID = absencia.id`.
- Substitueix el botó manual "Crea la substitució" actual per a absències creades amb periodes d'horari. Si l'absència no té cap `absencia_periodes` (cas fallback manual), es manté el flux manual d'avui sense canvis.
- L'assignació de `ProfessorSubstitut` es continua fent a mà, editant la substitució generada (fora d'abast automatitzar-ho, veure més avall).

---

## Testing

- Unitat: càlcul d'`Hores`/`HoraInici`/`HoraFi`/`HoresNoLectives` a partir d'una selecció de períodes.
- Unitat: generació de les `Substitucio` corresponents en aprovar una absència amb `absencia_periodes`.
- Unitat: que una absència sense `absencia_periodes` (fallback manual) no generi cap substitució automàtica i mantingui el comportament actual.

---

## Fora d'abast (v1)

- **Suggeriment automàtic de professor substitut**: creuar l'horari de tot el claustre + substitucions ja assignades aquell dia per proposar qui està lliure. Fase futura separada.
- **Absències de fracció de període**: només es treballa a nivell de període complet; una absència de mitja hora dins un període es gestiona amb el formulari manual (fallback).
- **Dissabtes / horaris no setmanals fixos**: no contemplats.
- **Hardening de RLS**: gap ja existent a tot el projecte, no és part d'aquesta spec.
- **Importació des d'Untis**: el centre genera els horaris amb el programa Untis (WebUntis). No es construeix cap importador en aquesta v1 — l'entrada és manual. El disseny de `horaris` (una fila per professor/dia/franja) queda prou pla perquè un futur importador d'exportacions Untis (CSV/XML) pugui inserir-hi files directament sense canviar l'esquema. Es documenta aquí perquè no es perdi la intenció, no perquè s'implementi ara.
