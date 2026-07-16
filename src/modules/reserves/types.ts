export type EstatReserva = 'Pendent' | 'Confirmada' | 'Cancel·lada'

export interface Reserva {
  id: string
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
}

export type ReservaFormData = Omit<Reserva, 'id' | 'ID' | 'Estat' | 'Creat_el'>
