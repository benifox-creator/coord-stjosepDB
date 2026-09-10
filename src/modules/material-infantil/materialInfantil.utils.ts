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
