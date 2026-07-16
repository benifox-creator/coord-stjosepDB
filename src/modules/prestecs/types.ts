export type EstatPrestec = 'Actiu' | 'Retornat' | 'Vençut'

export interface Prestec {
  id: string
  ID: string
  Dispositiu_ID: string
  Dispositiu_Nom: string
  Usuari: string
  Email: string
  Data_inici: string       // ISO date
  Data_fi_prevista: string // ISO date
  Data_fi_real: string     // ISO date, buit si encara actiu
  Material: string         // serialitzat: "MAT-001:2:Cable HDMI;MAT-003:1:Adaptador VGA"
  Estat: EstatPrestec
  Notes: string
}

export type PrestecFormData = Omit<Prestec, 'id' | 'ID' | 'Data_fi_real' | 'Estat'>
