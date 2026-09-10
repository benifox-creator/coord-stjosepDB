export type EstatIncidencia = 'Oberta' | 'En curs' | 'Tancada'
export type PrioritatIncidencia = 'Alta' | 'Mitjana' | 'Baixa'
// Llista editable des de Configuració (clau 'incidencies.tipus'), no un
// conjunt fix — per això és `string` i no un union de literals.
export type TipusProblema = string

export interface Incidencia {
  id: string
  Ticket: string                 // INC-001, INC-002...
  'Marca de temps': string       // ISO datetime de creació
  Estat: EstatIncidencia
  Prioritat: PrioritatIncidencia
  Reporter: string               // email de l'usuari autenticat
  'Tipus de problema': TipusProblema
  Localització: string
  Dispositiu: string             // ID inventari o text lliure si "Altre"
  'Descripció detallada': string
  'Assignat a': string           // email, només editable pel coordinador
  'Data Resolució': string       // ISO date, s'omple en tancar
  'Dies Tasca Oberta': string    // calculat
  Comentaris: string
  Notificat: string              // 'false' | 'pending' | 'true'
}

// Dades que introdueix l'usuari al formulari
export type IncidenciaFormData = Pick<
  Incidencia,
  'Tipus de problema' | 'Localització' | 'Dispositiu' | 'Descripció detallada' | 'Prioritat'
> & {
  // Coordinador pot omplir aquests camps al crear
  'Assignat a'?: string
  Comentaris?: string
}
