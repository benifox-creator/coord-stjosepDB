export type EstatProjecte = 'Actiu' | 'Completat' | 'Arxivat'
export type EstatTasca = 'Pendent' | 'En curs' | 'Completada' | 'Bloquejada'
export type PrioritatTasca = 'Alta' | 'Mitjana' | 'Baixa'

export interface Projecte {
  ID: string
  Nom: string
  Descripcio: string
  Categoria: string
  Estat: EstatProjecte
  Responsable: string
  Data_inici: string
  Data_fi_prevista: string
  Creat_el: string
  _rowIndex: number
}

export type ProjecteFormData = Omit<Projecte, 'ID' | 'Creat_el' | '_rowIndex'>

export interface Tasca {
  ID: string
  Projecte_ID: string
  Titol: string
  Descripcio: string
  Estat: EstatTasca
  Prioritat: PrioritatTasca
  Responsable: string
  Data_limit: string
  Creat_el: string
  _rowIndex: number
}

export type TascaFormData = Omit<Tasca, 'ID' | 'Creat_el' | '_rowIndex'>
