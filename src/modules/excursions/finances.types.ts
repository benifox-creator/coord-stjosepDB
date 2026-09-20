export interface Autocar {
  id: string
  Places: number
  Preu: number      // sense IVA
}

export interface Finances {
  PreuActivitat: number
  PreuActivitatTipus: 'per_alumne' | 'total'
  AmpaImport: number
  AmpaCobreixActivitat: boolean
  CostAcompanyants: number
  Autocars: Autocar[]
}

export const FINANCES_BUIDES: Finances = {
  PreuActivitat: 0, PreuActivitatTipus: 'per_alumne',
  AmpaImport: 0, AmpaCobreixActivitat: false, CostAcompanyants: 0, Autocars: [],
}
