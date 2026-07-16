export type EstatProjecte = 'Actiu' | 'Completat' | 'Arxivat'
export type EstatTasca = 'Pendent' | 'En curs' | 'Completada' | 'Bloquejada'
export type PrioritatTasca = 'Alta' | 'Mitjana' | 'Baixa'

export interface Projecte {
  id: string
  ID: string
  Nom: string
  Descripcio: string
  Categoria: string
  Estat: EstatProjecte
  Responsable: string
  Data_inici: string
  Data_fi_prevista: string
  Creat_el: string
}

export type ProjecteFormData = Omit<Projecte, 'id' | 'ID' | 'Creat_el'>

export interface Tasca {
  id: string
  ID: string
  Projecte_ID: string
  Titol: string
  Descripcio: string
  Estat: EstatTasca
  Prioritat: PrioritatTasca
  Responsable: string
  Data_limit: string
  Creat_el: string
}

export type TascaFormData = Omit<Tasca, 'id' | 'ID' | 'Creat_el'>
