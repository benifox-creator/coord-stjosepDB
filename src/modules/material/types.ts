export type CategoriaMaterial =
  | 'Cable'
  | 'Adaptador'
  | 'Àudio/Vídeo'
  | 'Perifèric'
  | 'Emmagatzematge'
  | 'Bateria/Carregador'
  | 'Projecció'
  | 'Altre'

export interface ItemMaterial {
  ID: string                  // MAT-001, MAT-002...
  Nom: string
  Categoria: CategoriaMaterial
  Descripció: string
  Quantitat_total: number
  Quantitat_disponible: number
  Ubicació: string
  Notes: string
  _rowIndex: number
}

export type MaterialFormData = Omit<ItemMaterial, 'ID' | 'Quantitat_disponible' | '_rowIndex'>

export interface MaterialPrestat {
  ID: string
  Nom: string
  Quantitat: number
}
