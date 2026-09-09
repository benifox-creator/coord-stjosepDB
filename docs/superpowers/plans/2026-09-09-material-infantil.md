# Material Infantil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el mòdul "Material Infantil" dins SJO Hub: catàleg de material fungible d'Infantil amb estoc, comanda anual calculada per etapa (I3/I4/I5), consolidat, dashboard i configuració del curs — substituint el full de càlcul Excel existent.

**Architecture:** Mòdul nou `src/modules/material-infantil/` amb 3 taules Supabase noves (`materials_infantil`, `proveidors_infantil`, `comandes_infantil`) + un camp nou a `usuaris` (`pot_gestionar_material`). Cada entitat té el seu propi store Zustand i el seu propi component de pestanya autosuficient (crida el seu store, gestiona el seu propi estat de formulari/confirmació — no hi ha un "Wrapper" central a `App.tsx` que faci de mitjancer, cada Tab és independent). `MaterialInfantilPage` és només un selector de pestanyes + porta d'accés (calcula els dos booleans de permisos i els passa avall).

**Tech Stack:** React 19 + TypeScript + Zustand + Supabase + Tailwind + recharts (ja usat a Substitucions/Absències per als gràfics).

**Spec:** `docs/superpowers/specs/2026-09-09-material-infantil-design.md`

## Global Constraints

- **Base de dades ja migrada**: les 3 taules noves i el camp `usuaris.pot_gestionar_material` ja existeixen a Supabase (projecte `gbugvympcvlskkrbklae`) — aplicats directament pel controlador abans d'escriure aquest pla. Cap tasca ha d'executar `apply_migration`; només cal sincronitzar `supabase/schema.sql` (Task 1) perquè el repositori reflecteixi l'estat real.
- **Sense framework de tests**: aquest projecte no en té (convenció establerta i confirmada repetidament). Verificació de cada tasca: `npx tsc -b`, `npx eslint <fitxers tocats>`, i `npm run build` a la darrera tasca. No escriguis fitxers `*.test.ts`.
- **Color corporatiu**: `#861414` per a botons primaris (mateix valor exacte a tots els mòduls, no una variable Tailwind).
- **Convenció de noms de camps TS**: paraules en català amb majúscula inicial (`Nom`, `Categoria`), camps compostos concatenats (`ProveidorId`, `UnitatsPerAlumne`) excepte `Creat_el`/`Creat_per` que sempre porten guió baix (així és arreu de l'app).
- **Patró de formulari**: un sol component `<Entitat>Form` gestiona alta I edició (prop `inicial?` — si està present és edició), estil modal centrat (`fixed inset-0 ... bg-black/40`, targeta `rounded-2xl max-w-md`), no el panell lliscant per la dreta que fan servir Absències/Substitucions. Mira `src/modules/material/MaterialForm.tsx` com a referència exacta d'estil.
- **Cada Tab és autosuficient**: crida el seu(s) propi(s) store(s) Zustand i gestiona el seu propi estat local (formulari obert, ítem en edició, confirmació d'eliminar). Rep només `potGestionar: boolean` com a prop (quan calgui). Cap Tab rep dades via un component "Wrapper" — trenca amb el patró d'Absències/Substitucions deliberadament per mantenir cada peça independent i revisable per separat.
- **Permisos del mòdul (excepció deliberada a `potGestionar` general)**:
  - Pot GESTIONAR (afegir/editar/eliminar): `coordinador`, `direccio`, `titular` sempre; qualsevol altre rol només si `usuari.PotGestionarMaterial === true`.
  - Pot VEURE el mòdul: `coordinador` sempre; qualsevol usuari amb `PotGestionarMaterial === true` sempre (encara que el seu rol no estigui a `visibilitat.material-infantil`); la resta, només si el seu Rol està a `visibilitat.material-infantil`.
- **`estoc_aplicat` és suggerit + editable**: en crear una línia de comanda es precalcula (estoc disponible del material menys el que ja s'hagi assignat a altres línies del mateix material+curs), però l'usuari el pot sobreescriure lliurement; un cop desat no es torna a recalcular automàticament.

---

### Task 1: Fundació — sincronitzar schema.sql i crear tipus + utilitats del mòdul

**Files:**
- Modify: `supabase/schema.sql`
- Create: `src/modules/material-infantil/types.ts`
- Create: `src/modules/material-infantil/materialInfantil.utils.ts`

**Interfaces:**
- Produces: tots els tipus (`MaterialInfantil`, `ProveidorInfantil`, `ComandaInfantil`, `*FormData`, enums) i totes les funcions de `materialInfantil.utils.ts` (`rowToMaterial`, `materialToInsert`, `materialToUpdate`, `estocDisponible`, `rowToProveidor`, `proveidorToInsert`, `proveidorToUpdate`, `rowToComanda`, `comandaToInsert`, `comandaToUpdate`, `necessitatBase`, `quantitatADemanar`, `costEstimat`, `suggeriEstocAplicat`, `nreAlumnesFromConfig`, constants `TABLE_MATERIALS`/`TABLE_PROVEIDORS`/`TABLE_COMANDES`) — totes les tasques posteriors en depenen. `nreAlumnesFromConfig(config, etapa)` centralitza la lectura de `material-infantil.alumnes-{etapa}` perquè Tasks 6/7/8 no la duplicain cadascuna pel seu compte.

- [ ] **Step 1: Sincronitzar `supabase/schema.sql`**

Obre `supabase/schema.sql` i localitza el bloc final on ja hi ha `alter table public.substitucions add column absencia_id...` (prop del final del fitxer, abans dels `create policy` restants). Afegeix just després d'aquest bloc (abans de les policies que segueixen):

```sql
create table public.proveidors_infantil (
  id uuid primary key default gen_random_uuid(),
  nom text not null default '',
  contacte text not null default '',
  email text not null default '',
  telefon text not null default '',
  web text not null default '',
  termini_lliurament text not null default '',
  notes text not null default ''
);

create sequence public.materials_infantil_codi_seq;

create table public.materials_infantil (
  id uuid primary key default gen_random_uuid(),
  codi text not null unique
        default ('MINF-' || lpad(nextval('public.materials_infantil_codi_seq')::text, 3, '0')),
  nom text not null default '',
  categoria text not null default 'Altres'
             check (categoria in ('Plàstica','Papereria','Psicomotricitat','Higiene','Aula','Llibres/quaderns','Altres')),
  unitat text not null default 'unitat'
             check (unitat in ('unitat','pack','capsa','rotlle','litre','paquet','joc')),
  proveidor_id uuid references public.proveidors_infantil(id),
  preu_unitari numeric(8,2) not null default 0,
  unitats_per_alumne numeric(6,2) not null default 1,
  comanda_habitual text not null default 'Sí'
             check (comanda_habitual in ('Sí','Revisar','No')),
  recompte_manual numeric not null default 0,
  entrades_rebudes numeric not null default 0,
  consum_manual numeric not null default 0,
  notes text not null default '',
  creat_el text not null default to_char(now(), 'YYYY-MM-DD HH24:MI'),
  creat_per text not null default ''
);

create table public.comandes_infantil (
  id uuid primary key default gen_random_uuid(),
  curs_escolar text not null default '',
  etapa text not null check (etapa in ('I3','I4','I5')),
  material_id uuid not null references public.materials_infantil(id),
  estoc_aplicat numeric not null default 0,
  marge_seguretat numeric not null default 0,
  estat text not null default 'Pendent'
             check (estat in ('Pendent','Revisar','Demanat','Rebut','Cancel·lat')),
  notes text not null default '',
  creat_el text not null default to_char(now(), 'YYYY-MM-DD HH24:MI'),
  creat_per text not null default ''
);

alter table public.usuaris add column pot_gestionar_material boolean not null default false;

alter table public.proveidors_infantil enable row level security;
create policy "anon_full_access" on public.proveidors_infantil for all using (true) with check (true);
alter table public.materials_infantil enable row level security;
create policy "anon_full_access" on public.materials_infantil for all using (true) with check (true);
alter table public.comandes_infantil enable row level security;
create policy "anon_full_access" on public.comandes_infantil for all using (true) with check (true);
```

- [ ] **Step 2: Crear `src/modules/material-infantil/types.ts`**

```typescript
export type CategoriaMaterialInfantil =
  | 'Plàstica' | 'Papereria' | 'Psicomotricitat' | 'Higiene' | 'Aula' | 'Llibres/quaderns' | 'Altres'

export const CATEGORIES_MATERIAL_INFANTIL: CategoriaMaterialInfantil[] = [
  'Plàstica', 'Papereria', 'Psicomotricitat', 'Higiene', 'Aula', 'Llibres/quaderns', 'Altres',
]

export type UnitatMaterialInfantil = 'unitat' | 'pack' | 'capsa' | 'rotlle' | 'litre' | 'paquet' | 'joc'

export const UNITATS_MATERIAL_INFANTIL: UnitatMaterialInfantil[] = [
  'unitat', 'pack', 'capsa', 'rotlle', 'litre', 'paquet', 'joc',
]

export type ComandaHabitual = 'Sí' | 'Revisar' | 'No'
export const COMANDA_HABITUAL_VALORS: ComandaHabitual[] = ['Sí', 'Revisar', 'No']

export type EtapaInfantil = 'I3' | 'I4' | 'I5'
export const ETAPES_INFANTIL: EtapaInfantil[] = ['I3', 'I4', 'I5']

export type EstatComandaInfantil = 'Pendent' | 'Revisar' | 'Demanat' | 'Rebut' | 'Cancel·lat'
export const ESTATS_COMANDA_INFANTIL: EstatComandaInfantil[] = [
  'Pendent', 'Revisar', 'Demanat', 'Rebut', 'Cancel·lat',
]

export interface MaterialInfantil {
  id: string
  Codi: string
  Nom: string
  Categoria: CategoriaMaterialInfantil
  Unitat: UnitatMaterialInfantil
  ProveidorId: string | null
  PreuUnitari: number
  UnitatsPerAlumne: number
  ComandaHabitual: ComandaHabitual
  RecompteManual: number
  EntradesRebudes: number
  ConsumManual: number
  Notes: string
  Creat_el: string
  Creat_per: string
}

export type MaterialInfantilFormData = Omit<MaterialInfantil, 'id' | 'Codi' | 'Creat_el' | 'Creat_per'>

export interface ProveidorInfantil {
  id: string
  Nom: string
  Contacte: string
  Email: string
  Telefon: string
  Web: string
  TerminiLliurament: string
  Notes: string
}

export type ProveidorInfantilFormData = Omit<ProveidorInfantil, 'id'>

export interface ComandaInfantil {
  id: string
  CursEscolar: string
  Etapa: EtapaInfantil
  MaterialId: string
  EstocAplicat: number
  MargeSeguretat: number
  Estat: EstatComandaInfantil
  Notes: string
  Creat_el: string
  Creat_per: string
}

export type ComandaInfantilFormData = Omit<ComandaInfantil, 'id' | 'Creat_el' | 'Creat_per'>
```

- [ ] **Step 3: Crear `src/modules/material-infantil/materialInfantil.utils.ts`**

```typescript
import type {
  MaterialInfantil, MaterialInfantilFormData, CategoriaMaterialInfantil, UnitatMaterialInfantil, ComandaHabitual,
  ProveidorInfantil, ProveidorInfantilFormData,
  ComandaInfantil, ComandaInfantilFormData, EtapaInfantil, EstatComandaInfantil,
} from './types'

export const TABLE_MATERIALS = 'materials_infantil'
export const TABLE_PROVEIDORS = 'proveidors_infantil'
export const TABLE_COMANDES = 'comandes_infantil'

// ---- Materials ----

export interface MaterialInfantilRow {
  id: string
  codi: string
  nom: string
  categoria: string
  unitat: string
  proveidor_id: string | null
  preu_unitari: number
  unitats_per_alumne: number
  comanda_habitual: string
  recompte_manual: number
  entrades_rebudes: number
  consum_manual: number
  notes: string
  creat_el: string
  creat_per: string
}

export function rowToMaterial(row: MaterialInfantilRow): MaterialInfantil {
  return {
    id: row.id,
    Codi: row.codi,
    Nom: row.nom,
    Categoria: row.categoria as CategoriaMaterialInfantil,
    Unitat: row.unitat as UnitatMaterialInfantil,
    ProveidorId: row.proveidor_id,
    PreuUnitari: row.preu_unitari,
    UnitatsPerAlumne: row.unitats_per_alumne,
    ComandaHabitual: row.comanda_habitual as ComandaHabitual,
    RecompteManual: row.recompte_manual,
    EntradesRebudes: row.entrades_rebudes,
    ConsumManual: row.consum_manual,
    Notes: row.notes,
    Creat_el: row.creat_el,
    Creat_per: row.creat_per,
  }
}

export function materialToInsert(data: MaterialInfantilFormData & { Creat_per: string }): Record<string, unknown> {
  return {
    nom: data.Nom,
    categoria: data.Categoria,
    unitat: data.Unitat,
    proveidor_id: data.ProveidorId,
    preu_unitari: data.PreuUnitari,
    unitats_per_alumne: data.UnitatsPerAlumne,
    comanda_habitual: data.ComandaHabitual,
    recompte_manual: data.RecompteManual,
    entrades_rebudes: data.EntradesRebudes,
    consum_manual: data.ConsumManual,
    notes: data.Notes,
    creat_per: data.Creat_per,
  }
}

export function materialToUpdate(data: MaterialInfantilFormData): Record<string, unknown> {
  return {
    nom: data.Nom,
    categoria: data.Categoria,
    unitat: data.Unitat,
    proveidor_id: data.ProveidorId,
    preu_unitari: data.PreuUnitari,
    unitats_per_alumne: data.UnitatsPerAlumne,
    comanda_habitual: data.ComandaHabitual,
    recompte_manual: data.RecompteManual,
    entrades_rebudes: data.EntradesRebudes,
    consum_manual: data.ConsumManual,
    notes: data.Notes,
  }
}

export function estocDisponible(m: MaterialInfantil): number {
  return m.RecompteManual + m.EntradesRebudes - m.ConsumManual
}

// ---- Proveïdors ----

export interface ProveidorInfantilRow {
  id: string
  nom: string
  contacte: string
  email: string
  telefon: string
  web: string
  termini_lliurament: string
  notes: string
}

export function rowToProveidor(row: ProveidorInfantilRow): ProveidorInfantil {
  return {
    id: row.id,
    Nom: row.nom,
    Contacte: row.contacte,
    Email: row.email,
    Telefon: row.telefon,
    Web: row.web,
    TerminiLliurament: row.termini_lliurament,
    Notes: row.notes,
  }
}

export function proveidorToInsert(data: ProveidorInfantilFormData): Record<string, unknown> {
  return {
    nom: data.Nom,
    contacte: data.Contacte,
    email: data.Email,
    telefon: data.Telefon,
    web: data.Web,
    termini_lliurament: data.TerminiLliurament,
    notes: data.Notes,
  }
}

export const proveidorToUpdate = proveidorToInsert

// ---- Comandes ----

export interface ComandaInfantilRow {
  id: string
  curs_escolar: string
  etapa: string
  material_id: string
  estoc_aplicat: number
  marge_seguretat: number
  estat: string
  notes: string
  creat_el: string
  creat_per: string
}

export function rowToComanda(row: ComandaInfantilRow): ComandaInfantil {
  return {
    id: row.id,
    CursEscolar: row.curs_escolar,
    Etapa: row.etapa as EtapaInfantil,
    MaterialId: row.material_id,
    EstocAplicat: row.estoc_aplicat,
    MargeSeguretat: row.marge_seguretat,
    Estat: row.estat as EstatComandaInfantil,
    Notes: row.notes,
    Creat_el: row.creat_el,
    Creat_per: row.creat_per,
  }
}

export function comandaToInsert(data: ComandaInfantilFormData & { Creat_per: string }): Record<string, unknown> {
  return {
    curs_escolar: data.CursEscolar,
    etapa: data.Etapa,
    material_id: data.MaterialId,
    estoc_aplicat: data.EstocAplicat,
    marge_seguretat: data.MargeSeguretat,
    estat: data.Estat,
    notes: data.Notes,
    creat_per: data.Creat_per,
  }
}

export function comandaToUpdate(
  data: Partial<Pick<ComandaInfantil, 'EstocAplicat' | 'MargeSeguretat' | 'Estat' | 'Notes'>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (data.EstocAplicat !== undefined) out.estoc_aplicat = data.EstocAplicat
  if (data.MargeSeguretat !== undefined) out.marge_seguretat = data.MargeSeguretat
  if (data.Estat !== undefined) out.estat = data.Estat
  if (data.Notes !== undefined) out.notes = data.Notes
  return out
}

// ---- Fórmules ----

export function necessitatBase(unitatsPerAlumne: number, nreAlumnes: number): number {
  return unitatsPerAlumne * nreAlumnes
}

export function quantitatADemanar(necessitatBaseVal: number, margeSeguretat: number, estocAplicat: number): number {
  return Math.max(0, necessitatBaseVal + margeSeguretat - estocAplicat)
}

export function costEstimat(quantitat: number, preuUnitari: number): number {
  return Math.round(quantitat * preuUnitari * 100) / 100
}

export function suggeriEstocAplicat(
  estocDisponibleMaterial: number,
  comandesExistents: ComandaInfantil[],
  materialId: string,
  cursEscolar: string,
): number {
  const jaAssignat = comandesExistents
    .filter((c) => c.MaterialId === materialId && c.CursEscolar === cursEscolar)
    .reduce((sum, c) => sum + c.EstocAplicat, 0)
  return Math.max(0, estocDisponibleMaterial - jaAssignat)
}

export function nreAlumnesFromConfig(config: Record<string, string[]>, etapa: EtapaInfantil): number {
  return Number(config[`material-infantil.alumnes-${etapa.toLowerCase()}`]?.[0] ?? '0') || 0
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc -b` — ha de passar sense errors (aquests fitxers encara no els importa ningú, però han de ser vàlids TypeScript en si mateixos).
Run: `npx eslint src/modules/material-infantil supabase/schema.sql` (eslint ignorarà el `.sql`, és normal — verifica només els `.ts`).

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql src/modules/material-infantil/types.ts src/modules/material-infantil/materialInfantil.utils.ts
git commit -m "feat(material-infantil): fundació — schema.sql sincronitzat, tipus i utilitats del mòdul"
```

---

### Task 2: Permisos — camp a usuaris i helpers de permisos del mòdul

**Files:**
- Modify: `src/modules/usuaris/types.ts`
- Modify: `src/store/usuarisStore.ts`
- Create: `src/modules/material-infantil/permisos.ts`

**Interfaces:**
- Consumes: `Usuari`, `Rol` de `src/modules/usuaris/types.ts` (ja existent).
- Produces: `Usuari.PotGestionarMaterial: boolean`; `useUsuarisStore().updatePotGestionarMaterial(usuari, valor)`; `useUsuarisStore().crear(email, nom, rol, etapa?, potGestionarMaterial?)` (signatura ampliada); `potGestionarMaterialInfantil(rol, flag): boolean` i `potVeureMaterialInfantil(usuariActual, rol, config): boolean` a `permisos.ts` — Task 9 en depèn per als guards de ruta i menú.

- [ ] **Step 1: Afegir el camp a `Usuari`**

A `src/modules/usuaris/types.ts`, dins la interface `Usuari` (actualment té `id, Email, Nom, Rol, Etapa, Data_alta`), afegeix una línia nova:

```typescript
export interface Usuari {
  id: string
  Email: string
  Nom: string
  Rol: Rol
  Etapa: EtapaSubstitucio | null
  PotGestionarMaterial: boolean
  Data_alta: string
}
```

- [ ] **Step 2: Actualitzar `src/store/usuarisStore.ts`**

A la interface `UsuariRow`, afegeix `pot_gestionar_material: boolean` (després de `etapa: string | null`).

A `rowToUsuari`, afegeix `PotGestionarMaterial: row.pot_gestionar_material ?? false,` (després de `Etapa: parseEtapa(row.etapa),`).

A la interface `UsuarisState`, canvia la signatura de `crear` i afegeix la nova acció:

```typescript
  crear: (email: string, nom: string, rol: Rol, etapa?: EtapaSubstitucio | null, potGestionarMaterial?: boolean) => Promise<void>
  updateRol: (usuari: Usuari, nouRol: Rol) => Promise<void>
  updateEtapa: (usuari: Usuari, novaEtapa: EtapaSubstitucio | null) => Promise<void>
  updatePotGestionarMaterial: (usuari: Usuari, valor: boolean) => Promise<void>
```

A la implementació de `crear`, canvia la signatura i el cos:

```typescript
  async crear(email, nom, rol, etapa = null, potGestionarMaterial = false) {
    const emailNorm = email.trim().toLowerCase()
    let row: UsuariRow
    try {
      row = await insertRow<UsuariRow>(TABLE, {
        email: emailNorm, nom: nom.trim(), rol, etapa, pot_gestionar_material: potGestionarMaterial,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('duplicate key') || msg.includes('unique')) {
        throw new Error('Aquest email ja té un usuari registrat.', { cause: err })
      }
      throw err
    }
    set((s) => ({ usuaris: [...s.usuaris, rowToUsuari(row)].sort((a, b) => a.Email.localeCompare(b.Email)) }))
  },
```

Afegeix una nova acció, just després de `updateEtapa`:

```typescript
  async updatePotGestionarMaterial(usuari, valor) {
    await updateRowById(TABLE, usuari.id, { pot_gestionar_material: valor })
    set((s) => ({
      usuaris: s.usuaris.map((u) => (u.id === usuari.id ? { ...u, PotGestionarMaterial: valor } : u)),
    }))
  },
```

- [ ] **Step 3: Crear `src/modules/material-infantil/permisos.ts`**

```typescript
import type { Rol, Usuari } from '../usuaris/types'
import { canAccessModul } from '../../store/configStore'

export function potGestionarMaterialInfantil(rol: Rol | null, potGestionarMaterialFlag: boolean): boolean {
  return rol === 'coordinador' || rol === 'direccio' || rol === 'titular' || potGestionarMaterialFlag
}

export function potVeureMaterialInfantil(
  usuariActual: Usuari | null,
  rol: Rol | null,
  config: Record<string, string[]>,
): boolean {
  if (rol === 'coordinador') return true
  if (usuariActual?.PotGestionarMaterial) return true
  return canAccessModul(config, 'material-infantil', rol)
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc -b` — atenció especial: qualsevol lloc que construeixi un objecte `Usuari` a mà (no via `rowToUsuari`) donarà error de camp que falta; no n'hi hauria d'haver cap fora de `usuarisStore.ts`, però comprova l'error de `tsc` si en surt algun.
Run: `npx eslint src/modules/usuaris/types.ts src/store/usuarisStore.ts src/modules/material-infantil/permisos.ts`

- [ ] **Step 5: Commit**

```bash
git add src/modules/usuaris/types.ts src/store/usuarisStore.ts src/modules/material-infantil/permisos.ts
git commit -m "feat(material-infantil): camp pot_gestionar_material i helpers de permisos del mòdul"
```

---

### Task 3: Configuració global — checkbox d'usuari, visibilitat i claus de config del curs

**Files:**
- Modify: `src/store/configStore.ts`
- Modify: `src/modules/configuracio/ConfiguracioPage.tsx`

**Interfaces:**
- Consumes: `usuarisStore().updatePotGestionarMaterial` i `crear(...)` (Task 2).
- Produces: `MODULS_VISIBILITAT` inclou `'material-infantil'`; `CONFIG_DEFAULTS['visibilitat.material-infantil']` i les 6 claus `material-infantil.*` — Task 7/8/9 en depenen per llegir `config['material-infantil.curs-actiu']` etc.

- [ ] **Step 1: `src/store/configStore.ts` — afegir mòdul i claus per defecte**

A `MODULS_VISIBILITAT`, afegeix una entrada nova (mantenint l'ordre alfabètic no és necessari, segueix l'ordre existent i afegeix-la al final de l'array):

```typescript
export const MODULS_VISIBILITAT = [
  { key: 'incidencies',  label: 'Incidències' },
  { key: 'inventari',    label: 'Inventari' },
  { key: 'material',     label: 'Material i Stock' },
  { key: 'prestecs',     label: 'Préstecs' },
  { key: 'reserves',     label: 'Reserves' },
  { key: 'substitucions', label: 'Substitucions' },
  { key: 'coneixement',  label: 'Base de Coneixement' },
  { key: 'pla-accio',    label: "Pla d'Acció" },
  { key: 'manteniment',  label: 'Manteniment' },
  { key: 'material-infantil', label: 'Material Infantil' },
] as const
```

A `CONFIG_DEFAULTS`, afegeix (a qualsevol punt del bloc `visibilitat.*` per a la clau de visibilitat, i com a bloc nou per a les claus de configuració del curs — nota que aquesta llista NO inclou `professorat`/`convidat` per defecte, a diferència de la resta de mòduls: aquest és un mòdul sensible per pressupost i el checkbox `PotGestionarMaterial` és el mecanisme pensat per estendre l'accés puntual, no la visibilitat de rol):

```typescript
  'visibilitat.material-infantil': ['direccio', 'titular', 'cap_estudis'],
```

(afegeix aquesta línia al bloc `visibilitat.*` existent, seguint el mateix `Record<string, string[]>`)

I afegeix un bloc nou, per exemple després de `'substitucions.franges.GM'`:

```typescript
  'material-infantil.curs-actiu': ['2026-2027'],
  'material-infantil.alumnes-i3': ['0'],
  'material-infantil.alumnes-i4': ['0'],
  'material-infantil.alumnes-i5': ['0'],
  'material-infantil.marge-seguretat-pct': ['0'],
  'material-infantil.pressupost-objectiu': ['0'],
```

- [ ] **Step 2: `ConfiguracioPage.tsx` — checkbox a `UsuariRow`**

Importa `EtapaSubstitucio` ja s'importa; no cal cap import nou per aquest step (el store ja exposa `updatePotGestionarMaterial`).

Dins `UsuariRow` (busca `const updateEtapa = useUsuarisStore((s) => s.updateEtapa)`), afegeix just a sota:

```typescript
  const updatePotGestionarMaterial = useUsuarisStore((s) => s.updatePotGestionarMaterial)
  const [savingPotGestionar, setSavingPotGestionar] = useState(false)
```

Afegeix una funció nova, al costat de `handleCanviarEtapa`:

```typescript
  async function handleTogglePotGestionarMaterial() {
    setSavingPotGestionar(true)
    try {
      await updatePotGestionarMaterial(usuari, !usuari.PotGestionarMaterial)
    } finally {
      setSavingPotGestionar(false)
    }
  }
```

Al JSX de `UsuariRow`, just abans del `<select>` d'Etapa que ja existeix (el que té `value={usuari.Etapa ?? ''}`), afegeix:

```tsx
      <label
        className="shrink-0 flex items-center gap-1 text-[11px] text-gray-500"
        title="Pot gestionar el mòdul Material Infantil"
      >
        <input
          type="checkbox"
          checked={usuari.PotGestionarMaterial}
          onChange={handleTogglePotGestionarMaterial}
          disabled={savingPotGestionar}
          className="rounded border-gray-300 text-primary focus:ring-primary/30"
        />
        Material
      </label>
```

- [ ] **Step 3: `ConfiguracioPage.tsx` — checkbox a `AfegirUsuariForm`**

Dins `AfegirUsuariForm`, on hi ha `const [etapa, setEtapa] = useState<EtapaSubstitucio | ''>('')`, afegeix a sota:

```typescript
  const [potGestionarMaterial, setPotGestionarMaterial] = useState(false)
```

A `tancar()`, afegeix `setPotGestionarMaterial(false)` (al costat de `setEtapa('')`).

A `handleAfegir()`, canvia la crida a `crear`:

```typescript
      await crear(trimmed, nom.trim(), rol, etapa === '' ? null : etapa, potGestionarMaterial)
```

Al JSX, just després del `<select>` d'Etapa (`{ETAPES_USUARI.map((e) => ...)}`), afegeix:

```tsx
      <label className="flex items-center gap-1.5 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={potGestionarMaterial}
          onChange={(e) => setPotGestionarMaterial(e.target.checked)}
          className="rounded border-gray-300 text-primary focus:ring-primary/30"
        />
        Pot gestionar Material Infantil
      </label>
```

- [ ] **Step 4: Verificar**

Run: `npx tsc -b`
Run: `npx eslint src/store/configStore.ts src/modules/configuracio/ConfiguracioPage.tsx`
Manual: obre `npm run dev`, entra a Configuració com a coordinador, comprova que apareix la nova columna "Material Infantil" a la taula de Visibilitat de mòduls, i que el checkbox "Material" apareix a cada fila d'usuari i es pot marcar/desmarcar sense error.

- [ ] **Step 5: Commit**

```bash
git add src/store/configStore.ts src/modules/configuracio/ConfiguracioPage.tsx
git commit -m "feat(material-infantil): checkbox d'usuari, visibilitat de mòdul i claus de configuració del curs"
```

---

### Task 4: Proveïdors — store + formulari + pestanya

**Files:**
- Create: `src/modules/material-infantil/useProveidorsInfantil.ts`
- Create: `src/modules/material-infantil/ProveidorInfantilForm.tsx`
- Create: `src/modules/material-infantil/ProveidorsInfantilTab.tsx`

**Interfaces:**
- Consumes: `TABLE_PROVEIDORS, rowToProveidor, proveidorToInsert, proveidorToUpdate, ProveidorInfantilRow` de `materialInfantil.utils.ts` (Task 1); `ProveidorInfantil, ProveidorInfantilFormData` de `types.ts` (Task 1).
- Produces: `useProveidorsInfantil()` (store amb `proveidors, loading, error, load, crear, editar, eliminar`) — Task 5 el consumeix (selector de proveïdor al formulari de materials).

- [ ] **Step 1: Crear `src/modules/material-infantil/useProveidorsInfantil.ts`**

```typescript
import { create } from 'zustand'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import type { ProveidorInfantil, ProveidorInfantilFormData } from './types'
import {
  TABLE_PROVEIDORS, rowToProveidor, proveidorToInsert, proveidorToUpdate, type ProveidorInfantilRow,
} from './materialInfantil.utils'

interface ProveidorsInfantilState {
  proveidors: ProveidorInfantil[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  crear: (data: ProveidorInfantilFormData) => Promise<void>
  editar: (p: ProveidorInfantil, data: ProveidorInfantilFormData) => Promise<void>
  eliminar: (p: ProveidorInfantil) => Promise<void>
}

export const useProveidorsInfantil = create<ProveidorsInfantilState>((set, get) => ({
  proveidors: [],
  loading: false,
  error: null,

  async load() {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const rows = await getAll<ProveidorInfantilRow>(TABLE_PROVEIDORS, 'nom')
      set({ proveidors: rows.map(rowToProveidor) })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant proveïdors' })
    } finally {
      set({ loading: false })
    }
  },

  async crear(data) {
    const row = await insertRow<ProveidorInfantilRow>(TABLE_PROVEIDORS, proveidorToInsert(data))
    set((s) => ({ proveidors: [...s.proveidors, rowToProveidor(row)] }))
  },

  async editar(p, data) {
    const row = await updateRowById<ProveidorInfantilRow>(TABLE_PROVEIDORS, p.id, proveidorToUpdate(data))
    const updated = rowToProveidor(row)
    set((s) => ({ proveidors: s.proveidors.map((x) => (x.id === p.id ? updated : x)) }))
  },

  async eliminar(p) {
    await deleteRowById(TABLE_PROVEIDORS, p.id)
    set((s) => ({ proveidors: s.proveidors.filter((x) => x.id !== p.id) }))
  },
}))
```

- [ ] **Step 2: Crear `src/modules/material-infantil/ProveidorInfantilForm.tsx`**

```tsx
import { useState } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'
import type { ProveidorInfantilFormData } from './types'

type Errors = Partial<Record<keyof ProveidorInfantilFormData, string>>

interface Props {
  onClose: () => void
  onGuardar: (data: ProveidorInfantilFormData) => Promise<void>
  inicial?: ProveidorInfantilFormData
}

export function ProveidorInfantilForm({ onClose, onGuardar, inicial }: Props) {
  const [form, setForm] = useState<ProveidorInfantilFormData>({
    Nom: inicial?.Nom ?? '',
    Contacte: inicial?.Contacte ?? '',
    Email: inicial?.Email ?? '',
    Telefon: inicial?.Telefon ?? '',
    Web: inicial?.Web ?? '',
    TerminiLliurament: inicial?.TerminiLliurament ?? '',
    Notes: inicial?.Notes ?? '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  function setField<K extends keyof ProveidorInfantilFormData>(key: K, value: ProveidorInfantilFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const e: Errors = {}
    if (!form.Nom.trim()) e.Nom = 'El nom és obligatori.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await onGuardar(form)
      onClose()
    } catch (err) {
      setErrors({ Nom: err instanceof Error ? err.message : 'Error en guardar.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-text-main">{inicial ? 'Editar proveïdor' : 'Nou proveïdor'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Nom *</label>
            <input
              type="text"
              value={form.Nom}
              onChange={(e) => setField('Nom', e.target.value)}
              autoFocus
              className={`input ${errors.Nom ? 'border-red-400' : ''}`}
            />
            {errors.Nom && (
              <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12} /> {errors.Nom}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Contacte</label>
              <input type="text" value={form.Contacte} onChange={(e) => setField('Contacte', e.target.value)} className="input" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Telèfon</label>
              <input type="text" value={form.Telefon} onChange={(e) => setField('Telefon', e.target.value)} className="input" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Email</label>
            <input type="email" value={form.Email} onChange={(e) => setField('Email', e.target.value)} className="input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Web</label>
              <input type="text" value={form.Web} onChange={(e) => setField('Web', e.target.value)} className="input" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Termini lliurament</label>
              <input
                type="text"
                value={form.TerminiLliurament}
                onChange={(e) => setField('TerminiLliurament', e.target.value)}
                placeholder="Ex: 2-5 dies"
                className="input"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Notes</label>
            <textarea value={form.Notes} onChange={(e) => setField('Notes', e.target.value)} rows={2} className="input resize-none" />
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel·la
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#861414' }}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {inicial ? 'Desar canvis' : 'Afegir proveïdor'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Crear `src/modules/material-infantil/ProveidorsInfantilTab.tsx`**

```tsx
import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Trash2, Loader2 } from 'lucide-react'
import { useProveidorsInfantil } from './useProveidorsInfantil'
import { ProveidorInfantilForm } from './ProveidorInfantilForm'
import type { ProveidorInfantil } from './types'

interface Props {
  potGestionar: boolean
}

export function ProveidorsInfantilTab({ potGestionar }: Props) {
  const { proveidors, loading, error, load, crear, editar, eliminar } = useProveidorsInfantil()
  const [cerca, setCerca] = useState('')
  const [formObert, setFormObert] = useState(false)
  const [editant, setEditant] = useState<ProveidorInfantil | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null)
  const [eliminant, setEliminant] = useState(false)

  useEffect(() => { load() }, [load])

  const filtrats = useMemo(() => {
    const q = cerca.toLowerCase()
    if (!q) return proveidors
    return proveidors.filter((p) => `${p.Nom} ${p.Contacte} ${p.Email}`.toLowerCase().includes(q))
  }, [proveidors, cerca])

  async function handleEliminar(p: ProveidorInfantil) {
    setEliminant(true)
    try {
      await eliminar(p)
      setConfirmEliminar(null)
    } finally {
      setEliminant(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cercar proveïdor..."
            className="input pl-8 text-sm w-full"
          />
        </div>
        {potGestionar && (
          <button
            onClick={() => setFormObert(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
            style={{ backgroundColor: '#861414' }}
          >
            <Plus size={14} /> Nou proveïdor
          </button>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        {!loading && filtrats.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            {proveidors.length === 0 ? 'Encara no hi ha proveïdors registrats.' : 'Cap proveïdor coincideix amb la cerca.'}
          </p>
        )}
        <div className="space-y-2">
          {filtrats.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg p-3">
              <div
                className={`min-w-0 flex-1 ${potGestionar ? 'cursor-pointer' : ''}`}
                onClick={() => potGestionar && setEditant(p)}
              >
                <p className="text-sm font-medium text-text-main">{p.Nom}</p>
                <p className="text-xs text-gray-400 truncate">
                  {[p.Contacte, p.Email, p.Telefon, p.TerminiLliurament].filter(Boolean).join(' · ') || 'Sense dades de contacte'}
                </p>
              </div>
              {potGestionar && (
                confirmEliminar === p.id ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleEliminar(p)}
                      disabled={eliminant}
                      className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded disabled:opacity-60"
                    >
                      {eliminant ? <Loader2 size={12} className="animate-spin" /> : 'Sí'}
                    </button>
                    <button
                      onClick={() => setConfirmEliminar(null)}
                      disabled={eliminant}
                      className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded disabled:opacity-60"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmEliminar(p.id)} className="text-gray-400 hover:text-red-600 shrink-0">
                    <Trash2 size={14} />
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {formObert && (
        <ProveidorInfantilForm onClose={() => setFormObert(false)} onGuardar={crear} />
      )}
      {editant && (
        <ProveidorInfantilForm
          inicial={{
            Nom: editant.Nom, Contacte: editant.Contacte, Email: editant.Email,
            Telefon: editant.Telefon, Web: editant.Web, TerminiLliurament: editant.TerminiLliurament, Notes: editant.Notes,
          }}
          onClose={() => setEditant(null)}
          onGuardar={(data) => editar(editant, data)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc -b`
Run: `npx eslint src/modules/material-infantil`

- [ ] **Step 5: Commit**

```bash
git add src/modules/material-infantil/useProveidorsInfantil.ts src/modules/material-infantil/ProveidorInfantilForm.tsx src/modules/material-infantil/ProveidorsInfantilTab.tsx
git commit -m "feat(material-infantil): store, formulari i pestanya de Proveïdors"
```

---

### Task 5: Materials (Catàleg) — store + formulari + pestanya

**Files:**
- Create: `src/modules/material-infantil/useMaterialsInfantil.ts`
- Create: `src/modules/material-infantil/MaterialInfantilForm.tsx`
- Create: `src/modules/material-infantil/CatalegInfantilTab.tsx`

**Interfaces:**
- Consumes: `TABLE_MATERIALS, rowToMaterial, materialToInsert, materialToUpdate, estocDisponible, MaterialInfantilRow` (Task 1); `useProveidorsInfantil()` (Task 4) per al selector de proveïdor.
- Produces: `useMaterialsInfantil()` (store amb `materials, loading, error, load, crear, editar, eliminar`) — Task 6/7/8 en depenen (necessitat base, estoc, catàleg per a les comandes).

- [ ] **Step 1: Crear `src/modules/material-infantil/useMaterialsInfantil.ts`**

```typescript
import { create } from 'zustand'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import { useAuthStore } from '../../store/authStore'
import type { MaterialInfantil, MaterialInfantilFormData } from './types'
import {
  TABLE_MATERIALS, rowToMaterial, materialToInsert, materialToUpdate, type MaterialInfantilRow,
} from './materialInfantil.utils'

interface MaterialsInfantilState {
  materials: MaterialInfantil[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  crear: (data: MaterialInfantilFormData) => Promise<void>
  editar: (m: MaterialInfantil, data: MaterialInfantilFormData) => Promise<void>
  eliminar: (m: MaterialInfantil) => Promise<void>
}

export const useMaterialsInfantil = create<MaterialsInfantilState>((set, get) => ({
  materials: [],
  loading: false,
  error: null,

  async load() {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const rows = await getAll<MaterialInfantilRow>(TABLE_MATERIALS, 'nom')
      set({ materials: rows.map(rowToMaterial) })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant materials' })
    } finally {
      set({ loading: false })
    }
  },

  async crear(data) {
    const email = (useAuthStore.getState().user?.email ?? '').toLowerCase()
    const row = await insertRow<MaterialInfantilRow>(TABLE_MATERIALS, materialToInsert({ ...data, Creat_per: email }))
    set((s) => ({ materials: [...s.materials, rowToMaterial(row)] }))
  },

  async editar(m, data) {
    const row = await updateRowById<MaterialInfantilRow>(TABLE_MATERIALS, m.id, materialToUpdate(data))
    const updated = rowToMaterial(row)
    set((s) => ({ materials: s.materials.map((x) => (x.id === m.id ? updated : x)) }))
  },

  async eliminar(m) {
    await deleteRowById(TABLE_MATERIALS, m.id)
    set((s) => ({ materials: s.materials.filter((x) => x.id !== m.id) }))
  },
}))
```

- [ ] **Step 2: Crear `src/modules/material-infantil/MaterialInfantilForm.tsx`**

```tsx
import { useState } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'
import type { MaterialInfantilFormData, ProveidorInfantil } from './types'
import { CATEGORIES_MATERIAL_INFANTIL, UNITATS_MATERIAL_INFANTIL, COMANDA_HABITUAL_VALORS } from './types'

type Errors = Partial<Record<keyof MaterialInfantilFormData, string>>

interface Props {
  proveidors: ProveidorInfantil[]
  onClose: () => void
  onGuardar: (data: MaterialInfantilFormData) => Promise<void>
  inicial?: MaterialInfantilFormData
}

export function MaterialInfantilForm({ proveidors, onClose, onGuardar, inicial }: Props) {
  const [form, setForm] = useState<MaterialInfantilFormData>({
    Nom: inicial?.Nom ?? '',
    Categoria: inicial?.Categoria ?? 'Altres',
    Unitat: inicial?.Unitat ?? 'unitat',
    ProveidorId: inicial?.ProveidorId ?? null,
    PreuUnitari: inicial?.PreuUnitari ?? 0,
    UnitatsPerAlumne: inicial?.UnitatsPerAlumne ?? 1,
    ComandaHabitual: inicial?.ComandaHabitual ?? 'Sí',
    RecompteManual: inicial?.RecompteManual ?? 0,
    EntradesRebudes: inicial?.EntradesRebudes ?? 0,
    ConsumManual: inicial?.ConsumManual ?? 0,
    Notes: inicial?.Notes ?? '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  function setField<K extends keyof MaterialInfantilFormData>(key: K, value: MaterialInfantilFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const e: Errors = {}
    if (!form.Nom.trim()) e.Nom = 'El nom és obligatori.'
    if (form.PreuUnitari < 0) e.PreuUnitari = 'El preu no pot ser negatiu.'
    if (form.UnitatsPerAlumne < 0) e.UnitatsPerAlumne = 'No pot ser negatiu.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await onGuardar(form)
      onClose()
    } catch (err) {
      setErrors({ Nom: err instanceof Error ? err.message : 'Error en guardar.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-text-main">{inicial ? 'Editar material' : 'Nou material'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Nom *</label>
            <input
              type="text"
              value={form.Nom}
              onChange={(e) => setField('Nom', e.target.value)}
              autoFocus
              className={`input ${errors.Nom ? 'border-red-400' : ''}`}
            />
            {errors.Nom && (
              <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12} /> {errors.Nom}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Categoria</label>
              <select
                value={form.Categoria}
                onChange={(e) => setField('Categoria', e.target.value as MaterialInfantilFormData['Categoria'])}
                className="input"
              >
                {CATEGORIES_MATERIAL_INFANTIL.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Unitat</label>
              <select
                value={form.Unitat}
                onChange={(e) => setField('Unitat', e.target.value as MaterialInfantilFormData['Unitat'])}
                className="input"
              >
                {UNITATS_MATERIAL_INFANTIL.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Proveïdor preferent</label>
            <select
              value={form.ProveidorId ?? ''}
              onChange={(e) => setField('ProveidorId', e.target.value || null)}
              className="input"
            >
              <option value="">Sense proveïdor</option>
              {proveidors.map((p) => <option key={p.id} value={p.id}>{p.Nom}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Preu unitari (€)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.PreuUnitari}
                onChange={(e) => setField('PreuUnitari', Number(e.target.value))}
                className={`input ${errors.PreuUnitari ? 'border-red-400' : ''}`}
              />
              {errors.PreuUnitari && <p className="text-xs text-red-600">{errors.PreuUnitari}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Unitats / alumne</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.UnitatsPerAlumne}
                onChange={(e) => setField('UnitatsPerAlumne', Number(e.target.value))}
                className={`input ${errors.UnitatsPerAlumne ? 'border-red-400' : ''}`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Comanda habitual</label>
            <select
              value={form.ComandaHabitual}
              onChange={(e) => setField('ComandaHabitual', e.target.value as MaterialInfantilFormData['ComandaHabitual'])}
              className="input"
            >
              {COMANDA_HABITUAL_VALORS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Estoc</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500">Recompte manual</label>
                <input
                  type="number"
                  min={0}
                  value={form.RecompteManual}
                  onChange={(e) => setField('RecompteManual', Number(e.target.value))}
                  className="input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500">Entrades rebudes</label>
                <input
                  type="number"
                  min={0}
                  value={form.EntradesRebudes}
                  onChange={(e) => setField('EntradesRebudes', Number(e.target.value))}
                  className="input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500">Consum manual</label>
                <input
                  type="number"
                  min={0}
                  value={form.ConsumManual}
                  onChange={(e) => setField('ConsumManual', Number(e.target.value))}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Notes</label>
            <textarea value={form.Notes} onChange={(e) => setField('Notes', e.target.value)} rows={2} className="input resize-none" />
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel·la
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#861414' }}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {inicial ? 'Desar canvis' : 'Afegir material'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Crear `src/modules/material-infantil/CatalegInfantilTab.tsx`**

```tsx
import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { useMaterialsInfantil } from './useMaterialsInfantil'
import { useProveidorsInfantil } from './useProveidorsInfantil'
import { MaterialInfantilForm } from './MaterialInfantilForm'
import { estocDisponible } from './materialInfantil.utils'
import type { MaterialInfantil } from './types'

interface Props {
  potGestionar: boolean
}

export function CatalegInfantilTab({ potGestionar }: Props) {
  const { materials, loading, error, load, crear, editar, eliminar } = useMaterialsInfantil()
  const { proveidors, load: loadProveidors } = useProveidorsInfantil()
  const [cerca, setCerca] = useState('')
  const [formObert, setFormObert] = useState(false)
  const [editant, setEditant] = useState<MaterialInfantil | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null)
  const [eliminant, setEliminant] = useState(false)

  useEffect(() => { load(); loadProveidors() }, [load, loadProveidors])

  const filtrats = useMemo(() => {
    const q = cerca.toLowerCase()
    return materials
      .filter((m) => !q || `${m.Codi} ${m.Nom} ${m.Categoria}`.toLowerCase().includes(q))
      .sort((a, b) => a.Nom.localeCompare(b.Nom))
  }, [materials, cerca])

  async function handleEliminar(m: MaterialInfantil) {
    setEliminant(true)
    try {
      await eliminar(m)
      setConfirmEliminar(null)
    } finally {
      setEliminant(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cercar material..."
            className="input pl-8 text-sm w-full"
          />
        </div>
        {potGestionar && (
          <button
            onClick={() => setFormObert(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
            style={{ backgroundColor: '#861414' }}
          >
            <Plus size={14} /> Nou material
          </button>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Codi</th>
              <th className="px-3 py-2.5 font-medium">Material</th>
              <th className="px-3 py-2.5 font-medium">Categoria</th>
              <th className="px-3 py-2.5 font-medium text-right">Preu</th>
              <th className="px-3 py-2.5 font-medium text-right">Estoc disponible</th>
              {potGestionar && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && filtrats.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  {materials.length === 0 ? 'Encara no hi ha materials registrats.' : 'Cap material coincideix amb la cerca.'}
                </td>
              </tr>
            )}
            {filtrats.map((m) => {
              const estoc = estocDisponible(m)
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td
                    className={`px-3 py-2.5 text-primary font-semibold ${potGestionar ? 'cursor-pointer' : ''}`}
                    onClick={() => potGestionar && setEditant(m)}
                  >
                    {m.Codi}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-text-main ${potGestionar ? 'cursor-pointer' : ''}`}
                    onClick={() => potGestionar && setEditant(m)}
                  >
                    {m.Nom}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{m.Categoria}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{m.PreuUnitari.toFixed(2)}€</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`font-medium ${estoc <= 0 ? 'text-red-600' : 'text-text-main'}`}>
                      {estoc <= 0 && <AlertTriangle size={12} className="inline mr-1 -mt-0.5" />}
                      {estoc} {m.Unitat}
                    </span>
                  </td>
                  {potGestionar && (
                    <td className="px-3 py-2.5 text-right">
                      {confirmEliminar === m.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEliminar(m)}
                            disabled={eliminant}
                            className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded disabled:opacity-60"
                          >
                            {eliminant ? <Loader2 size={12} className="animate-spin" /> : 'Sí'}
                          </button>
                          <button
                            onClick={() => setConfirmEliminar(null)}
                            disabled={eliminant}
                            className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded disabled:opacity-60"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmEliminar(m.id)} className="text-gray-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {formObert && (
        <MaterialInfantilForm proveidors={proveidors} onClose={() => setFormObert(false)} onGuardar={crear} />
      )}
      {editant && (
        <MaterialInfantilForm
          proveidors={proveidors}
          inicial={{
            Nom: editant.Nom, Categoria: editant.Categoria, Unitat: editant.Unitat, ProveidorId: editant.ProveidorId,
            PreuUnitari: editant.PreuUnitari, UnitatsPerAlumne: editant.UnitatsPerAlumne, ComandaHabitual: editant.ComandaHabitual,
            RecompteManual: editant.RecompteManual, EntradesRebudes: editant.EntradesRebudes, ConsumManual: editant.ConsumManual,
            Notes: editant.Notes,
          }}
          onClose={() => setEditant(null)}
          onGuardar={(data) => editar(editant, data)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc -b`
Run: `npx eslint src/modules/material-infantil`

- [ ] **Step 5: Commit**

```bash
git add src/modules/material-infantil/useMaterialsInfantil.ts src/modules/material-infantil/MaterialInfantilForm.tsx src/modules/material-infantil/CatalegInfantilTab.tsx
git commit -m "feat(material-infantil): store, formulari i pestanya del Catàleg de materials"
```

---

### Task 6: Comandes — store + formulari (amb suggeriment d'estoc) + pestanya

**Files:**
- Create: `src/modules/material-infantil/useComandesInfantil.ts`
- Create: `src/modules/material-infantil/ComandaInfantilForm.tsx`
- Create: `src/modules/material-infantil/ComandesInfantilTab.tsx`

**Interfaces:**
- Consumes: `TABLE_COMANDES, rowToComanda, comandaToInsert, comandaToUpdate, necessitatBase, quantitatADemanar, costEstimat, suggeriEstocAplicat, estocDisponible, ComandaInfantilRow` (Task 1); `useMaterialsInfantil()` (Task 5); `useConfigStore` (llegeix `material-infantil.alumnes-i3/i4/i5` i `material-infantil.marge-seguretat-pct`, Task 3).
- Produces: `useComandesInfantil()` (store amb `comandes, loading, error, load, crear, eliminar`) — Task 7/8 en depenen.

- [ ] **Step 1: Crear `src/modules/material-infantil/useComandesInfantil.ts`**

```typescript
import { create } from 'zustand'
import { getAll, insertRow, deleteRowById } from '../../services/db'
import { useAuthStore } from '../../store/authStore'
import type { ComandaInfantil, ComandaInfantilFormData } from './types'
import {
  TABLE_COMANDES, rowToComanda, comandaToInsert, type ComandaInfantilRow,
} from './materialInfantil.utils'

interface ComandesInfantilState {
  comandes: ComandaInfantil[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  crear: (data: ComandaInfantilFormData) => Promise<void>
  eliminar: (c: ComandaInfantil) => Promise<void>
}

export const useComandesInfantil = create<ComandesInfantilState>((set, get) => ({
  comandes: [],
  loading: false,
  error: null,

  async load() {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const rows = await getAll<ComandaInfantilRow>(TABLE_COMANDES, 'curs_escolar')
      set({ comandes: rows.map(rowToComanda) })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error carregant comandes' })
    } finally {
      set({ loading: false })
    }
  },

  async crear(data) {
    const email = (useAuthStore.getState().user?.email ?? '').toLowerCase()
    const row = await insertRow<ComandaInfantilRow>(TABLE_COMANDES, comandaToInsert({ ...data, Creat_per: email }))
    set((s) => ({ comandes: [...s.comandes, rowToComanda(row)] }))
  },

  async eliminar(c) {
    await deleteRowById(TABLE_COMANDES, c.id)
    set((s) => ({ comandes: s.comandes.filter((x) => x.id !== c.id) }))
  },
}))
```

Nota: no s'inclou `actualitzar` en aquest store — el v1 del formulari només crea i elimina línies (com marca l'spec: "afegir i eliminar"). Si en el futur cal editar una línia existent (canviar estat, reajustar estoc_aplicat), és una ampliació petita d'aquest store seguint el mateix patró que `editar` a `useMaterialsInfantil`.

- [ ] **Step 2: Crear `src/modules/material-infantil/ComandaInfantilForm.tsx`**

```tsx
import { useState, useMemo } from 'react'
import { X, Loader2 } from 'lucide-react'
import type {
  ComandaInfantilFormData, EtapaInfantil, EstatComandaInfantil, MaterialInfantil, ComandaInfantil,
} from './types'
import { ESTATS_COMANDA_INFANTIL } from './types'
import { estocDisponible, necessitatBase, suggeriEstocAplicat, nreAlumnesFromConfig } from './materialInfantil.utils'
import { useConfigStore } from '../../store/configStore'

interface Props {
  etapa: EtapaInfantil
  cursEscolar: string
  materials: MaterialInfantil[]
  comandesExistents: ComandaInfantil[]
  onDesar: (data: ComandaInfantilFormData) => Promise<void>
  onCancel: () => void
}

export function ComandaInfantilForm({ etapa, cursEscolar, materials, comandesExistents, onDesar, onCancel }: Props) {
  const config = useConfigStore((s) => s.config)
  const nAlumnes = nreAlumnesFromConfig(config, etapa)
  const margePct = Number(config['material-infantil.marge-seguretat-pct']?.[0] ?? '0') || 0

  const materialsDisponibles = useMemo(() => {
    const jaUsats = new Set(
      comandesExistents.filter((c) => c.CursEscolar === cursEscolar && c.Etapa === etapa).map((c) => c.MaterialId),
    )
    return materials.filter((m) => !jaUsats.has(m.id))
  }, [materials, comandesExistents, cursEscolar, etapa])

  const [materialId, setMaterialId] = useState(materialsDisponibles[0]?.id ?? '')
  const material = materials.find((m) => m.id === materialId) ?? null

  function suggerits(m: MaterialInfantil | null) {
    const estoc = m ? suggeriEstocAplicat(estocDisponible(m), comandesExistents, m.id, cursEscolar) : 0
    const marge = m ? Math.round(necessitatBase(m.UnitatsPerAlumne, nAlumnes) * (margePct / 100)) : 0
    return { estoc, marge }
  }

  const inicials = suggerits(material)
  const [estocAplicat, setEstocAplicat] = useState(inicials.estoc)
  const [margeSeguretat, setMargeSeguretat] = useState(inicials.marge)
  const [estat, setEstat] = useState<EstatComandaInfantil>('Pendent')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleMaterialChange(id: string) {
    setMaterialId(id)
    const m = materials.find((x) => x.id === id) ?? null
    const s = suggerits(m)
    setEstocAplicat(s.estoc)
    setMargeSeguretat(s.marge)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!materialId) { setError('Cal seleccionar un material.'); return }
    setError('')
    setSaving(true)
    try {
      await onDesar({
        CursEscolar: cursEscolar,
        Etapa: etapa,
        MaterialId: materialId,
        EstocAplicat: estocAplicat,
        MargeSeguretat: margeSeguretat,
        Estat: estat,
        Notes: notes,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desant la línia')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-text-main">Afegeix línia — {etapa} · {cursEscolar}</h2>
          <button
            onClick={() => { if (!saving) onCancel() }}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Material *</label>
            {materialsDisponibles.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Tots els materials del catàleg ja tenen línia per {etapa} al curs {cursEscolar}.
              </p>
            ) : (
              <select value={materialId} onChange={(e) => handleMaterialChange(e.target.value)} className="input">
                {materialsDisponibles.map((m) => (
                  <option key={m.id} value={m.id}>{m.Nom}</option>
                ))}
              </select>
            )}
          </div>

          {material && (
            <p className="text-xs text-gray-500">
              Necessitat base: <span className="font-semibold text-text-main">{necessitatBase(material.UnitatsPerAlumne, nAlumnes)}</span>
              {' '}({material.UnitatsPerAlumne} ud./alumne × {nAlumnes} alumnes) · Estoc disponible:{' '}
              <span className="font-semibold text-text-main">{estocDisponible(material)}</span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Estoc aplicat</label>
              <input
                type="number"
                min={0}
                value={estocAplicat}
                onChange={(e) => setEstocAplicat(Number(e.target.value))}
                className="input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Marge seguretat</label>
              <input
                type="number"
                min={0}
                value={margeSeguretat}
                onChange={(e) => setMargeSeguretat(Number(e.target.value))}
                className="input"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Estat</label>
            <select value={estat} onChange={(e) => setEstat(e.target.value as EstatComandaInfantil)} className="input">
              {ESTATS_COMANDA_INFANTIL.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input resize-none" />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel·la
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || materialsDisponibles.length === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#861414' }}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Afegeix línia
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Crear `src/modules/material-infantil/ComandesInfantilTab.tsx`**

```tsx
import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { useComandesInfantil } from './useComandesInfantil'
import { useMaterialsInfantil } from './useMaterialsInfantil'
import { useConfigStore } from '../../store/configStore'
import { ETAPES_INFANTIL } from './types'
import type { ComandaInfantil, EtapaInfantil } from './types'
import { necessitatBase, quantitatADemanar, costEstimat, nreAlumnesFromConfig } from './materialInfantil.utils'
import { ComandaInfantilForm } from './ComandaInfantilForm'

interface Props {
  potGestionar: boolean
}

export function ComandesInfantilTab({ potGestionar }: Props) {
  const { comandes, loading, error, load, crear, eliminar } = useComandesInfantil()
  const { materials, load: loadMaterials } = useMaterialsInfantil()
  const config = useConfigStore((s) => s.config)
  const cursActiu = config['material-infantil.curs-actiu']?.[0] ?? '2026-2027'
  const [etapa, setEtapa] = useState<EtapaInfantil>('I3')
  const [formObert, setFormObert] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null)
  const [eliminant, setEliminant] = useState(false)

  useEffect(() => { load(); loadMaterials() }, [load, loadMaterials])

  const nAlumnes = nreAlumnesFromConfig(config, etapa)

  const linies = useMemo(() => {
    return comandes
      .filter((c) => c.CursEscolar === cursActiu && c.Etapa === etapa)
      .map((c) => {
        const material = materials.find((m) => m.id === c.MaterialId)
        const nb = material ? necessitatBase(material.UnitatsPerAlumne, nAlumnes) : 0
        const quantitat = quantitatADemanar(nb, c.MargeSeguretat, c.EstocAplicat)
        const cost = material ? costEstimat(quantitat, material.PreuUnitari) : 0
        return { comanda: c, material, necessitatBase: nb, quantitat, cost }
      })
      .sort((a, b) => (a.material?.Nom ?? '').localeCompare(b.material?.Nom ?? ''))
  }, [comandes, materials, cursActiu, etapa, nAlumnes])

  const totalCost = linies.reduce((s, l) => s + l.cost, 0)

  async function handleEliminar(c: ComandaInfantil) {
    setEliminant(true)
    try {
      await eliminar(c)
      setConfirmEliminar(null)
    } finally {
      setEliminant(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {ETAPES_INFANTIL.map((e) => (
              <button
                key={e}
                onClick={() => setEtapa(e)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  etapa === e ? 'bg-white text-text-main shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">Curs {cursActiu} · {nAlumnes} alumnes</span>
        </div>
        {potGestionar && (
          <button
            onClick={() => setFormObert(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
            style={{ backgroundColor: '#861414' }}
          >
            <Plus size={14} /> Afegeix línia
          </button>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Material</th>
              <th className="px-3 py-2.5 font-medium text-right">Necessitat</th>
              <th className="px-3 py-2.5 font-medium text-right">Estoc aplicat</th>
              <th className="px-3 py-2.5 font-medium text-right">Marge</th>
              <th className="px-3 py-2.5 font-medium text-right">A demanar</th>
              <th className="px-3 py-2.5 font-medium text-right">Cost</th>
              <th className="px-3 py-2.5 font-medium">Estat</th>
              {potGestionar && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && linies.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  Encara no hi ha línies per {etapa} al curs {cursActiu}.
                </td>
              </tr>
            )}
            {linies.map(({ comanda, material, necessitatBase: nb, quantitat, cost }) => (
              <tr key={comanda.id}>
                <td className="px-3 py-2.5 text-text-main">{material?.Nom ?? '(material eliminat)'}</td>
                <td className="px-3 py-2.5 text-right text-gray-600">{nb}</td>
                <td className="px-3 py-2.5 text-right text-gray-600">{comanda.EstocAplicat}</td>
                <td className="px-3 py-2.5 text-right text-gray-600">{comanda.MargeSeguretat}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-text-main">{quantitat}</td>
                <td className="px-3 py-2.5 text-right text-gray-600">{cost.toFixed(2)}€</td>
                <td className="px-3 py-2.5 text-gray-600">{comanda.Estat}</td>
                {potGestionar && (
                  <td className="px-3 py-2.5 text-right">
                    {confirmEliminar === comanda.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEliminar(comanda)}
                          disabled={eliminant}
                          className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded disabled:opacity-60"
                        >
                          {eliminant ? <Loader2 size={12} className="animate-spin" /> : 'Sí'}
                        </button>
                        <button
                          onClick={() => setConfirmEliminar(null)}
                          disabled={eliminant}
                          className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded disabled:opacity-60"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmEliminar(comanda.id)} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {linies.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-200">
                <td colSpan={5} className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">Total</td>
                <td className="px-3 py-2.5 text-right font-bold text-text-main">{totalCost.toFixed(2)}€</td>
                <td colSpan={potGestionar ? 2 : 1} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {formObert && (
        <ComandaInfantilForm
          etapa={etapa}
          cursEscolar={cursActiu}
          materials={materials}
          comandesExistents={comandes}
          onDesar={async (data) => { await crear(data); setFormObert(false) }}
          onCancel={() => setFormObert(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc -b`
Run: `npx eslint src/modules/material-infantil`

- [ ] **Step 5: Commit**

```bash
git add src/modules/material-infantil/useComandesInfantil.ts src/modules/material-infantil/ComandaInfantilForm.tsx src/modules/material-infantil/ComandesInfantilTab.tsx
git commit -m "feat(material-infantil): store, formulari i pestanya de Comandes per etapa"
```

---

### Task 7: Consolidat + Configuració del curs

**Files:**
- Create: `src/modules/material-infantil/ConsolidatInfantilTab.tsx`
- Create: `src/modules/material-infantil/ConfiguracioCursInfantilTab.tsx`

**Interfaces:**
- Consumes: `useComandesInfantil()` (Task 6), `useMaterialsInfantil()` (Task 5), `useConfigStore` (Task 3), `necessitatBase/quantitatADemanar/costEstimat` (Task 1).
- Produces: `ConsolidatInfantilTab`, `ConfiguracioCursInfantilTab` — Task 9 els renderitza.

- [ ] **Step 1: Crear `src/modules/material-infantil/ConsolidatInfantilTab.tsx`**

```tsx
import { useEffect, useMemo } from 'react'
import { useComandesInfantil } from './useComandesInfantil'
import { useMaterialsInfantil } from './useMaterialsInfantil'
import { useConfigStore } from '../../store/configStore'
import { ETAPES_INFANTIL } from './types'
import { necessitatBase, quantitatADemanar, costEstimat, nreAlumnesFromConfig } from './materialInfantil.utils'

export function ConsolidatInfantilTab() {
  const { comandes, loading, error, load } = useComandesInfantil()
  const { materials, load: loadMaterials } = useMaterialsInfantil()
  const config = useConfigStore((s) => s.config)
  const cursActiu = config['material-infantil.curs-actiu']?.[0] ?? '2026-2027'

  useEffect(() => { load(); loadMaterials() }, [load, loadMaterials])

  const linies = useMemo(() => {
    return comandes
      .filter((c) => c.CursEscolar === cursActiu)
      .map((c) => {
        const material = materials.find((m) => m.id === c.MaterialId)
        const nAlumnes = nreAlumnesFromConfig(config, c.Etapa)
        const nb = material ? necessitatBase(material.UnitatsPerAlumne, nAlumnes) : 0
        const quantitat = quantitatADemanar(nb, c.MargeSeguretat, c.EstocAplicat)
        const cost = material ? costEstimat(quantitat, material.PreuUnitari) : 0
        return { comanda: c, material, quantitat, cost }
      })
      .sort((a, b) => a.comanda.Etapa.localeCompare(b.comanda.Etapa) || (a.material?.Nom ?? '').localeCompare(b.material?.Nom ?? ''))
  }, [comandes, materials, config, cursActiu])

  const totalsPerEtapa = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of ETAPES_INFANTIL) map.set(e, 0)
    for (const l of linies) map.set(l.comanda.Etapa, (map.get(l.comanda.Etapa) ?? 0) + l.cost)
    return map
  }, [linies])

  const totalGeneral = linies.reduce((s, l) => s + l.cost, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200">
        <p className="text-sm text-gray-500">
          Consolidat del curs <span className="font-semibold text-text-main">{cursActiu}</span> —{' '}
          {ETAPES_INFANTIL.map((e) => `${e}: ${(totalsPerEtapa.get(e) ?? 0).toFixed(2)}€`).join(' · ')}
        </p>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Etapa</th>
              <th className="px-3 py-2.5 font-medium">Material</th>
              <th className="px-3 py-2.5 font-medium">Categoria</th>
              <th className="px-3 py-2.5 font-medium text-right">Quantitat a demanar</th>
              <th className="px-3 py-2.5 font-medium text-right">Cost</th>
              <th className="px-3 py-2.5 font-medium">Estat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && linies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  Encara no hi ha línies de comanda pel curs {cursActiu}.
                </td>
              </tr>
            )}
            {linies.map(({ comanda, material, quantitat, cost }) => (
              <tr key={comanda.id}>
                <td className="px-3 py-2.5 font-medium text-text-main">{comanda.Etapa}</td>
                <td className="px-3 py-2.5 text-text-main">{material?.Nom ?? '(material eliminat)'}</td>
                <td className="px-3 py-2.5 text-gray-600">{material?.Categoria ?? '—'}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-text-main">{quantitat}</td>
                <td className="px-3 py-2.5 text-right text-gray-600">{cost.toFixed(2)}€</td>
                <td className="px-3 py-2.5 text-gray-600">{comanda.Estat}</td>
              </tr>
            ))}
          </tbody>
          {linies.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-200">
                <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">Total general</td>
                <td className="px-3 py-2.5 text-right font-bold text-text-main">{totalGeneral.toFixed(2)}€</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear `src/modules/material-infantil/ConfiguracioCursInfantilTab.tsx`**

```tsx
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useConfigStore } from '../../store/configStore'

interface CampConfig { clau: string; label: string; type: 'text' | 'number' }

const CAMPS: CampConfig[] = [
  { clau: 'material-infantil.curs-actiu', label: 'Curs escolar actiu', type: 'text' },
  { clau: 'material-infantil.alumnes-i3', label: 'Alumnes I3', type: 'number' },
  { clau: 'material-infantil.alumnes-i4', label: 'Alumnes I4', type: 'number' },
  { clau: 'material-infantil.alumnes-i5', label: 'Alumnes I5', type: 'number' },
  { clau: 'material-infantil.marge-seguretat-pct', label: 'Marge de seguretat (%)', type: 'number' },
  { clau: 'material-infantil.pressupost-objectiu', label: 'Pressupost objectiu (€)', type: 'number' },
]

interface Props {
  potGestionar: boolean
}

export function ConfiguracioCursInfantilTab({ potGestionar }: Props) {
  const config = useConfigStore((s) => s.config)
  const update = useConfigStore((s) => s.update)
  const [valors, setValors] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPS.map((c) => [c.clau, config[c.clau]?.[0] ?? ''])),
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function handleDesar(clau: string) {
    setSaving(clau)
    try {
      await update(clau, [valors[clau]])
      setSaved(clau)
      setTimeout(() => setSaved(null), 1500)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-6">
      <div className="max-w-md space-y-4">
        {CAMPS.map(({ clau, label, type }) => (
          <div key={clau} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">{label}</label>
            <div className="flex gap-2">
              <input
                type={type}
                value={valors[clau]}
                disabled={!potGestionar}
                onChange={(e) => setValors((v) => ({ ...v, [clau]: e.target.value }))}
                className="input text-sm flex-1 disabled:bg-gray-50 disabled:text-gray-500"
              />
              {potGestionar && (
                <button
                  onClick={() => handleDesar(clau)}
                  disabled={saving === clau}
                  className="px-3 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                  style={{ backgroundColor: '#861414' }}
                >
                  {saving === clau ? <Loader2 size={12} className="animate-spin" /> : saved === clau ? '✓' : 'Desar'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc -b`
Run: `npx eslint src/modules/material-infantil`

- [ ] **Step 4: Commit**

```bash
git add src/modules/material-infantil/ConsolidatInfantilTab.tsx src/modules/material-infantil/ConfiguracioCursInfantilTab.tsx
git commit -m "feat(material-infantil): pestanyes de Consolidat i Configuració del curs"
```

---

### Task 8: Dashboard

**Files:**
- Create: `src/modules/material-infantil/DashboardInfantilTab.tsx`

**Interfaces:**
- Consumes: `useComandesInfantil()` (Task 6), `useMaterialsInfantil()` (Task 5), `useConfigStore` (Task 3), fórmules de `materialInfantil.utils.ts` (Task 1). Llibreria `recharts` (ja al `package.json`, usada a `SubstitucionsPage.tsx`).
- Produces: `DashboardInfantilTab` — Task 9 el renderitza.

- [ ] **Step 1: Crear `src/modules/material-infantil/DashboardInfantilTab.tsx`**

```tsx
import { useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useComandesInfantil } from './useComandesInfantil'
import { useMaterialsInfantil } from './useMaterialsInfantil'
import { useConfigStore } from '../../store/configStore'
import { necessitatBase, quantitatADemanar, costEstimat, nreAlumnesFromConfig } from './materialInfantil.utils'

const COLOR = '#861414'

export function DashboardInfantilTab() {
  const { comandes, load } = useComandesInfantil()
  const { materials, load: loadMaterials } = useMaterialsInfantil()
  const config = useConfigStore((s) => s.config)
  const cursActiu = config['material-infantil.curs-actiu']?.[0] ?? '2026-2027'
  const pressupost = Number(config['material-infantil.pressupost-objectiu']?.[0] ?? '0') || 0

  useEffect(() => { load(); loadMaterials() }, [load, loadMaterials])

  function calculaCost(c: (typeof comandes)[number]) {
    const material = materials.find((m) => m.id === c.MaterialId)
    const nAlumnes = nreAlumnesFromConfig(config, c.Etapa)
    const nb = material ? necessitatBase(material.UnitatsPerAlumne, nAlumnes) : 0
    const quantitat = quantitatADemanar(nb, c.MargeSeguretat, c.EstocAplicat)
    return { material, cost: material ? costEstimat(quantitat, material.PreuUnitari) : 0 }
  }

  const liniesCursActiu = useMemo(
    () => comandes.filter((c) => c.CursEscolar === cursActiu).map((c) => ({ comanda: c, ...calculaCost(c) })),
    [comandes, materials, config, cursActiu],
  )

  const costTotal = liniesCursActiu.reduce((s, l) => s + l.cost, 0)
  const pctPressupost = pressupost > 0 ? (costTotal / pressupost) * 100 : 0
  const pendents = liniesCursActiu.filter((l) => l.comanda.Estat === 'Pendent').length

  const perCategoria = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of liniesCursActiu) {
      const cat = l.material?.Categoria ?? 'Altres'
      map.set(cat, (map.get(cat) ?? 0) + l.cost)
    }
    return Array.from(map.entries())
      .map(([categoria, cost]) => ({ categoria, cost: Math.round(cost * 100) / 100 }))
      .filter((c) => c.cost > 0)
      .sort((a, b) => b.cost - a.cost)
  }, [liniesCursActiu])

  const resumHistoric = useMemo(() => {
    const map = new Map<string, { cost: number; linies: number }>()
    for (const c of comandes) {
      const { cost } = calculaCost(c)
      const prev = map.get(c.CursEscolar) ?? { cost: 0, linies: 0 }
      map.set(c.CursEscolar, { cost: prev.cost + cost, linies: prev.linies + 1 })
    }
    return Array.from(map.entries())
      .map(([curs, v]) => ({ curs, cost: Math.round(v.cost * 100) / 100, linies: v.linies }))
      .sort((a, b) => b.curs.localeCompare(a.curs))
  }, [comandes, materials, config])

  return (
    <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">Cost estimat (curs {cursActiu})</p>
          <p className="text-2xl font-bold text-text-main">{costTotal.toFixed(2)}€</p>
          {pressupost > 0 && (
            <p className={`text-xs mt-1 ${pctPressupost > 100 ? 'text-red-600' : 'text-gray-400'}`}>
              {pctPressupost.toFixed(0)}% del pressupost ({pressupost.toFixed(2)}€)
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">Línies pendents</p>
          <p className="text-2xl font-bold text-text-main">{pendents}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">Línies totals (curs actiu)</p>
          <p className="text-2xl font-bold text-text-main">{liniesCursActiu.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cost per categoria</p>
        {perCategoria.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sense dades encara.</p>
        ) : (
          <div style={{ width: '100%', height: Math.max(160, perCategoria.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perCategoria} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="categoria"
                  width={120}
                  tick={{ fontSize: 12, fill: '#374151' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [`${value}€`, 'Cost']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="cost" fill={COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4">Resum per curs escolar</p>
        <table className="w-full text-sm mt-2">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Curs</th>
              <th className="px-4 py-2.5 font-medium text-right">Línies</th>
              <th className="px-4 py-2.5 font-medium text-right">Cost total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {resumHistoric.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Sense dades encara.</td></tr>
            )}
            {resumHistoric.map((r) => (
              <tr key={r.curs}>
                <td className="px-4 py-2.5 text-text-main">{r.curs}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{r.linies}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-text-main">{r.cost.toFixed(2)}€</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc -b`
Run: `npx eslint src/modules/material-infantil/DashboardInfantilTab.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/modules/material-infantil/DashboardInfantilTab.tsx
git commit -m "feat(material-infantil): pestanya de Dashboard amb gràfic i resum històric"
```

---

### Task 9: Integració — pàgina principal, ruta amb guard i navegació

**Files:**
- Create: `src/modules/material-infantil/MaterialInfantilPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Layout.tsx`

**Interfaces:**
- Consumes: totes les Tabs (Tasks 4-8), `potGestionarMaterialInfantil`/`potVeureMaterialInfantil` (Task 2), `Usuari.PotGestionarMaterial` (Task 2).

- [ ] **Step 1: Crear `src/modules/material-infantil/MaterialInfantilPage.tsx`**

```tsx
import { useState } from 'react'
import { Boxes, ClipboardList, Layers, Truck, BarChart2, Settings } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUsuarisStore } from '../../store/usuarisStore'
import { useConfigStore } from '../../store/configStore'
import { potGestionarMaterialInfantil, potVeureMaterialInfantil } from './permisos'
import { CatalegInfantilTab } from './CatalegInfantilTab'
import { ComandesInfantilTab } from './ComandesInfantilTab'
import { ConsolidatInfantilTab } from './ConsolidatInfantilTab'
import { ProveidorsInfantilTab } from './ProveidorsInfantilTab'
import { DashboardInfantilTab } from './DashboardInfantilTab'
import { ConfiguracioCursInfantilTab } from './ConfiguracioCursInfantilTab'

type Tab = 'cataleg' | 'comandes' | 'consolidat' | 'proveidors' | 'dashboard' | 'configuracio'

const TABS: [Tab, string, React.ElementType][] = [
  ['cataleg', 'Catàleg', Boxes],
  ['comandes', 'Comandes', ClipboardList],
  ['consolidat', 'Consolidat', Layers],
  ['proveidors', 'Proveïdors', Truck],
  ['dashboard', 'Dashboard', BarChart2],
  ['configuracio', 'Configuració', Settings],
]

export function MaterialInfantilPage() {
  const [tab, setTab] = useState<Tab>('cataleg')
  const rol = useUsuarisStore((s) => s.rol)
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const email = useAuthStore((s) => s.user?.email)
  const config = useConfigStore((s) => s.config)

  const usuariActual = usuaris.find((u) => u.Email.toLowerCase() === (email ?? '').toLowerCase()) ?? null
  const potVeure = potVeureMaterialInfantil(usuariActual, rol, config)
  const potGestionar = potGestionarMaterialInfantil(rol, usuariActual?.PotGestionarMaterial ?? false)

  if (!potVeure) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        No tens accés a aquest mòdul.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-text-main mb-3">Material Infantil</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
          {TABS.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === key ? 'bg-white text-text-main shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'cataleg' && <CatalegInfantilTab potGestionar={potGestionar} />}
        {tab === 'comandes' && <ComandesInfantilTab potGestionar={potGestionar} />}
        {tab === 'consolidat' && <ConsolidatInfantilTab />}
        {tab === 'proveidors' && <ProveidorsInfantilTab potGestionar={potGestionar} />}
        {tab === 'dashboard' && <DashboardInfantilTab />}
        {tab === 'configuracio' && <ConfiguracioCursInfantilTab potGestionar={potGestionar} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Modificar `src/App.tsx`**

Afegeix als imports (al costat dels imports de `ConfiguracioPage`/`useConfigStore`):

```typescript
import { MaterialInfantilPage } from './modules/material-infantil/MaterialInfantilPage'
import { potVeureMaterialInfantil } from './modules/material-infantil/permisos'
```

Afegeix un nou guard, just després de `CoordinadorGuard` (abans de `function AppRoutes()`):

```tsx
function MaterialInfantilGuard({ children }: { children: ReactNode }) {
  const rol = useUsuarisStore((s) => s.rol)
  const config = useConfigStore((s) => s.config)
  const email = useAuthStore((s) => s.user?.email)
  const usuaris = useUsuarisStore((s) => s.usuaris)
  if (rol === null) return <>{children}</>
  const usuariActual = usuaris.find((u) => u.Email.toLowerCase() === (email ?? '').toLowerCase()) ?? null
  if (!potVeureMaterialInfantil(usuariActual, rol, config)) return <Navigate to="/" replace />
  return <>{children}</>
}
```

Afegeix la ruta nova, al bloc de `<Routes>` (al costat de la resta de `<Route path="/..." element={<VisibilitatGuard ...>}` — pot anar just abans de la ruta `/configuracio`):

```tsx
                <Route
                  path="/material-infantil"
                  element={<MaterialInfantilGuard><MaterialInfantilPage /></MaterialInfantilGuard>}
                />
```

- [ ] **Step 3: Modificar `src/components/Layout.tsx`**

Afegeix `Boxes` a l'import de `lucide-react` (a la llista existent que ja té `LayoutDashboard, AlertTriangle, Package, ...`).

Afegeix una entrada nova a `NAV_ITEMS`, al final de l'array:

```typescript
  { to: '/material-infantil', label: 'Material Infantil', icon: Boxes, visKey: 'material-infantil' },
```

Dins el component `Layout`, on ja hi ha `const rol = useUsuarisStore((s) => s.rol)`, afegeix a sota:

```typescript
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const usuariActual = usuaris.find((u) => u.Email.toLowerCase() === (user?.email ?? '').toLowerCase()) ?? null
```

Canvia el càlcul d'`itemsVisibles` (actualment `NAV_ITEMS.filter(({ visKey }) => visKey === null || rol === null || canAccessModul(config, visKey, rol))`) per:

```typescript
  const itemsVisibles = NAV_ITEMS.filter(({ visKey }) => {
    if (visKey === null || rol === null) return true
    if (visKey === 'material-infantil' && usuariActual?.PotGestionarMaterial) return true
    return canAccessModul(config, visKey, rol)
  })
```

- [ ] **Step 4: Verificar**

Run: `npx tsc -b`
Run: `npx eslint src/modules/material-infantil src/App.tsx src/components/Layout.tsx`
Run: `npm run build`

Manual (amb `npm run dev`):
1. Com a coordinador: comprova que "Material Infantil" apareix al menú, entra i navega per les 6 pestanyes.
2. Afegeix un proveïdor, un material (amb aquell proveïdor), i una línia de comanda per I3 — comprova que la quantitat a demanar i el cost es calculen bé, i que Consolidat i Dashboard ho reflecteixen.
3. Ves a Configuració → treu "Material Infantil" de la visibilitat per `professorat`, i a un usuari amb rol `professorat` marca'l checkbox "Pot gestionar Material Infantil" — verifica que aquell usuari veu el mòdul (encara que el seu rol no hi tingui visibilitat) i pot gestionar-hi, mentre que un altre `professorat` sense el checkbox no el veu.
4. Com a `direccio` o `titular` sense el checkbox: verifica que poden gestionar igualment (afegir/eliminar) sense necessitar el checkbox.
5. Com a `cap_estudis` sense el checkbox: verifica que si té visibilitat, veu el mòdul en mode només lectura (sense botons d'afegir/eliminar).

- [ ] **Step 5: Commit**

```bash
git add src/modules/material-infantil/MaterialInfantilPage.tsx src/App.tsx src/components/Layout.tsx
git commit -m "feat(material-infantil): integració — pàgina principal, ruta amb guard i navegació"
```
