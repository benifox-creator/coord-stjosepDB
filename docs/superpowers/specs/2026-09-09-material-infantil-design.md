# Material Infantil — Design Spec

**Goal:** Substituir el full de càlcul "Inventari_material_infantil" (Google Sheets) per un nou mòdul dins SJO Hub que porti el catàleg de material fungible d'Infantil, el seu estoc, la comanda anual calculada per etapa (I3/I4/I5) i el pressupost associat.

**Origen:** `Inventari_material_infantil_Google_Sheets.xlsx` (analitzat a l'escriptori de l'usuari). El full té 12 pestanyes: Tauler, Guia d'ús, Resum cursos, Comanda I3/I4/I5, Comanda total, Inventari, Materials, Proveïdors, Configuració, Llistes.

**Per què un mòdul nou:** Ja existeixen "Inventari" (equipament TIC: portàtils, projectors, IPs...) i "Material i Stock" (cables, adaptadors, perifèrics). Cap dels dos encaixa — són d'un domini totalment diferent (maquinari TIC vs. material fungible d'aula amb cicle de comanda anual lligat al nombre d'alumnes).

**Abast v1:** Rèplica completa del full (catàleg, proveïdors, estoc, comanda calculada per etapa, consolidat, dashboard, configuració del curs). Només Infantil (I3/I4/I5); Primària queda fora de l'abast, es podrà afegir més endavant reutilitzant el mateix disseny.

---

## Model de dades

Totes les taules noves, `snake_case`, `id uuid primary key default gen_random_uuid()`, seguint la convenció de la resta de `schema.sql`. RLS: mateixa política permissiva `anon_full_access` que la resta de taules (el control d'accés real viu al frontend, com a tot SJO Hub).

### `materials_infantil`
Catàleg + estoc fusionats (al full són dues pestanyes gairebé duplicades — Materials i Inventari comparteixen Codi/Material/Categoria/Unitat; aquí es fusionen en una sola taula).

| Camp | Tipus | Notes |
|---|---|---|
| `id` | uuid pk | |
| `codi` | text unique | `MINF-001`, `MINF-002`... autogenerat per seqüència (prefix `MINF-` per no col·lidir amb els codis `MAT-` del mòdul "Material i Stock" existent) |
| `nom` | text not null | |
| `categoria` | text | check: `Plàstica, Papereria, Psicomotricitat, Higiene, Aula, Llibres/quaderns, Altres` |
| `unitat` | text | check: `unitat, pack, capsa, rotlle, litre, paquet, joc` |
| `proveidor_id` | uuid null | FK → `proveidors_infantil(id)` |
| `preu_unitari` | numeric(8,2) default 0 | |
| `unitats_per_alumne` | numeric(6,2) default 1 | **Simplificació respecte al full**: un sol valor per material, no varia per etapa. Als valors reals del full mai canvia entre I3/I4/I5 pel mateix material. Si mai cal diferenciar-ho, és una ampliació petita (columna per etapa o taula de relació). |
| `comanda_habitual` | text default 'Sí' | check: `Sí, Revisar, No` — si és `No`, el material no surt per defecte als llistats de "materials pendents de comanda" del dashboard |
| `recompte_manual` | numeric default 0 | |
| `entrades_rebudes` | numeric default 0 | |
| `consum_manual` | numeric default 0 | |
| `notes` | text default '' | |
| `creat_el`, `creat_per` | text | com a la resta de mòduls |

`estoc_disponible` **no es guarda** — es calcula al frontend: `recompte_manual + entrades_rebudes − consum_manual`.

### `proveidors_infantil`
| Camp | Tipus |
|---|---|
| `id` | uuid pk |
| `nom` | text not null |
| `contacte` | text default '' |
| `email` | text default '' |
| `telefon` | text default '' |
| `web` | text default '' |
| `termini_lliurament` | text default '' |
| `notes` | text default '' |

### `comandes_infantil`
Una fila = una línia de comanda d'un material dins una etapa i un curs escolar concrets. **Aquí és on els usuaris autoritzats afegeixen i eliminen línies** — és el nucli de la funcionalitat "afegir i eliminar" que va motivar aquest mòdul.

| Camp | Tipus | Notes |
|---|---|---|
| `id` | uuid pk | |
| `curs_escolar` | text not null | p.ex. `'2026-2027'` |
| `etapa` | text not null | check: `I3, I4, I5` |
| `material_id` | uuid not null | FK → `materials_infantil(id)` |
| `estoc_aplicat` | numeric default 0 | **Suggerit automàticament + editable** (veure fórmules més avall) |
| `marge_seguretat` | numeric default 0 | unitats absolutes (no percentatge — així és com el full l'usa per línia, tot i que `Configuració` guarda un marge global en %) |
| `estat` | text default 'Pendent' | check: `Pendent, Revisar, Demanat, Rebut, Cancel·lat` |
| `notes` | text default '' | |
| `creat_el`, `creat_per` | text | |

Camps derivats, **no es guarden**, es calculen al frontend (veure secció Fórmules).

### Configuració del curs
No cal taula nova — es reutilitza la taula `config` genèrica (clau/valors) ja existent, amb noves claus:
- `material-infantil.curs-actiu` → `['2026-2027']`
- `material-infantil.alumnes-i3`, `alumnes-i4`, `alumnes-i5` → nombre d'alumnes per etapa
- `material-infantil.marge-seguretat-pct` → marge global suggerit (%), només com a referència inicial
- `material-infantil.pressupost-objectiu` → pressupost del curs

### Camp nou a `usuaris`
`pot_gestionar_material boolean not null default false` — checkbox independent del Rol, editable des de Configuració → Usuaris (mateix lloc on ja s'edita Rol i Etapa).

---

## Permisos

Dos eixos independents:

**Visibilitat del mòdul** (pot accedir-hi / el veu al menú):
- `coordinador` → sempre.
- Usuari amb `pot_gestionar_material = true` → sempre, encara que el seu Rol no estigui marcat a `visibilitat.material-infantil`.
- Resta → només si el seu Rol està inclòs a `visibilitat.material-infantil` (mateix sistema que la resta de mòduls, configurable des de Configuració → Visibilitat de mòduls).

**Gestionar** (afegir/editar/eliminar materials, proveïdors i línies de comanda):
- `coordinador`, `direccio`, `titular` → sempre (igual que a la resta de mòduls, `potGestionar`).
- Qualsevol altre rol (`cap_estudis`, `professorat`, `convidat`) → només si té `pot_gestionar_material = true`.
- Sense el checkbox i sense ser coordinador/direcció/titular → només consulta, encara que vegi el mòdul.

Aquesta és una **excepció deliberada** a la regla habitual `potGestionar` (que normalment inclou `cap_estudis`): en aquest mòdul concret, `cap_estudis` necessita el checkbox igual que un professor.

---

## Estructura del mòdul (navegació)

Nou ítem al menú lateral: **"Material Infantil"**, amb pestanyes internes (mateix patró de tabs que Substitucions):

1. **Catàleg** — llista de `materials_infantil` amb estoc disponible calculat; alta/baixa/edició (si es pot gestionar).
2. **Comandes** — selector d'etapa (I3/I4/I5) + curs escolar; llista de línies de `comandes_infantil` amb quantitat a demanar i cost calculats; afegir/eliminar línies (si es pot gestionar).
3. **Consolidat** — suma de les 3 etapes del curs actiu (equivalent a "Comanda total" del full), amb possibilitat d'exportar/imprimir.
4. **Proveïdors** — CRUD senzill sobre `proveidors_infantil`.
5. **Dashboard** — cost total, % de pressupost utilitzat, línies pendents, desglossament per etapa i per categoria — amb gràfics recharts, mateix estil visual que ja s'usa a Substitucions/Absències.
6. **Configuració del curs** — nombre d'alumnes per etapa, marge, pressupost objectiu, curs actiu (només visible/editable per qui pot gestionar).

**Resum cursos (històric)**: no necessita vista pròpia complexa — com que cada línia de `comandes_infantil` guarda `curs_escolar`, l'històric per any surt d'un agrupat simple sobre aquesta taula. Es pot mostrar com una taula senzilla dins el Dashboard (cost total i unitats per curs escolar, ordenat descendent), sense necessitat de pantalla dedicada en v1.

---

## Fórmules (calculades al frontend, no es guarden)

Per cada línia de `comandes_infantil`:

- `nre_alumnes` = valor de `material-infantil.alumnes-{etapa}` (config del curs actiu)
- `necessitat_base` = `material.unitats_per_alumne × nre_alumnes`
- `quantitat_a_demanar` = `max(0, necessitat_base + marge_seguretat − estoc_aplicat)`
- `cost_estimat` = `quantitat_a_demanar × material.preu_unitari`

**Suggeriment automàtic d'`estoc_aplicat`** en crear una línia nova: `max(0, estoc_disponible_del_material − suma(estoc_aplicat de totes les altres línies del mateix material i mateix curs_escolar))`. És a dir, es reparteix l'estoc compartit per ordre d'arribada: la primera etapa que es registra "es queda" l'estoc disponible per defecte. Un cop creada la línia, el camp és totalment editable — si es modifica, el valor desat es respecta i no es torna a recalcular automàticament.

Dashboard (per curs actiu):
- Cost total = suma de `cost_estimat` de totes les línies del curs
- % pressupost utilitzat = `cost_total / pressupost_objectiu`
- Línies pendents = compte de línies amb `estat = 'Pendent'`
- Desglossament per etapa i per categoria = agrupats sobre les línies + el material associat

---

## Fora d'abast (v1)

- **Primària**: el disseny (etapa com a camp obert, no un enum tancat a nivell de UI) ho permetria en el futur, però v1 només construeix I3/I4/I5.
- **`unitats_per_alumne` diferenciat per etapa**: simplificat a un sol valor per material (veure nota a la taula `materials_infantil`).
- **Importació directa de l'Excel**: no forma part d'aquesta spec: el catàleg (9 materials, 4 proveïdors) es donarà d'alta manualment un cop el mòdul estigui construït — és poca quantitat de dades per justificar un importador dedicat.
