export type EstatReserva = 'Pendent' | 'Confirmada' | 'Cancel·lada'

export interface Reserva {
  ID: string
  Espai: string
  Usuari: string
  Email: string
  Data: string        // YYYY-MM-DD
  Hora_inici: string  // HH:mm
  Hora_fi: string     // HH:mm
  Motiu: string
  Estat: EstatReserva
  Creat_el: string    // ISO datetime
  _rowIndex: number
}

export type ReservaFormData = Omit<Reserva, 'ID' | 'Estat' | 'Creat_el' | '_rowIndex'>
