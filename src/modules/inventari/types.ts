export type EstatInventari = 'Actiu' | 'En reparació' | 'De baixa' | 'En préstec'

export type CategoriaInventari =
  | 'Portàtil'
  | 'Ordinador'
  | 'Tauleta'
  | 'Projector'
  | 'Impressora'
  | 'Switch/Router'
  | 'Monitor'
  | 'Servidor'
  | 'Altre'

export interface ItemInventari {
  id: string
  ID: string               // INV-001, INV-002...
  Nom: string
  Categoria: CategoriaInventari
  Marca: string
  Model: string
  'Núm_sèrie': string
  Ubicació: string
  Estat: EstatInventari
  'Data_compra': string    // ISO date
  'Garantia_fins': string  // ISO date
  MAC_LAN: string
  MAC_WAN: string
  IP_LAN: string
  IP_WAN: string
  Notes: string
}

export type ItemInventariFormData = Omit<ItemInventari, 'id' | 'ID'>
