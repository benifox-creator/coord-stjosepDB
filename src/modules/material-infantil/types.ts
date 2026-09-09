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
