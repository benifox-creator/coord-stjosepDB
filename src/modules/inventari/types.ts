import type { EstatInventari } from './estats'

export type { EstatInventari }

// Llista editable des de Configuració (clau 'inventari.categories'), no un
// conjunt fix — per això és `string` i no un union de literals.
export type CategoriaInventari = string

export interface ItemInventari {
  id: string
  ID: string               // INV-001, INV-002...
  Nom: string
  Categoria: CategoriaInventari
  Marca: string
  Model: string
  'Núm_sèrie': string
  Ubicació: string         // codi del catàleg d'ubicacions; '' si no en té
  Estat: EstatInventari
  Accio: string            // acció pendent; '' si no n'hi ha cap
  SistemaOperatiu: string
  'Data_compra': string    // ISO date
  'Garantia_fins': string  // ISO date
  MAC_LAN: string
  MAC_WAN: string
  IP_LAN: string
  IP_WAN: string
  Notes: string
}

export type ItemInventariFormData = Omit<ItemInventari, 'id' | 'ID'>
