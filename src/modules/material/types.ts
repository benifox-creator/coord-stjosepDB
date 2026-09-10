// Llista editable des de Configuració (clau 'material.categories'), no un
// conjunt fix — per això és `string` i no un union de literals.
export type CategoriaMaterial = string

export interface ItemMaterial {
  id: string
  ID: string                  // MAT-001, MAT-002...
  Nom: string
  Categoria: CategoriaMaterial
  Descripció: string
  Quantitat_total: number
  Quantitat_disponible: number
  Ubicació: string
  Notes: string
}

export type MaterialFormData = Omit<ItemMaterial, 'id' | 'ID' | 'Quantitat_disponible'>

export interface MaterialPrestat {
  ID: string
  Nom: string
  Quantitat: number
}
