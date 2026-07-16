export type EstatManteniment = 'Pendent' | 'En gestió' | 'Resolt' | 'Cancel·lat'
export type CategoriaManteniment =
  | 'Persianes/Stores'
  | 'Portes/Finestres'
  | 'Mobiliari'
  | 'Electricitat'
  | 'Fontaneria'
  | 'Pintura'
  | 'Altres'
export type PrioritatManteniment = 'Urgent' | 'Normal' | 'Baixa'

export interface Manteniment {
  ID: string
  Titol: string
  Categoria: CategoriaManteniment
  Localitzacio: string
  Descripcio: string
  Prioritat: PrioritatManteniment
  Estat: EstatManteniment
  Reporter: string
  Data_report: string
  Data_resolucio: string
  Notes: string
  Creat_el: string
  _rowIndex: number
}

export interface MantenimentFormData {
  Titol: string
  Categoria: CategoriaManteniment
  Localitzacio: string
  Descripcio: string
  Prioritat: PrioritatManteniment
  Notes: string
}
