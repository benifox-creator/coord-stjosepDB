import { useCallback, useEffect, useState } from 'react'
import { getAll, insertRow, updateRowById, deleteRowById, supabase } from '../../services/db'
import { formatDateTimeISO, formatDate } from './reserves.utils'
import { sendEmail } from '../../services/gmail'
import { useUsuarisStore, potEliminar } from '../../store/usuarisStore'
import { useAuthStore } from '../../store/authStore'
import type { Reserva, EstatReserva, ReservaFormData } from './types'

const TABLE = 'reserves'

interface ReservaRow {
  id: string
  codi: string
  espai: string
  usuari: string
  email: string
  data: string
  hora_inici: string
  hora_fi: string
  motiu: string
  estat: string
  creat_el: string
}

function rowToReserva(row: ReservaRow): Reserva {
  return {
    id: row.id,
    ID: row.codi,
    Espai: row.espai,
    Usuari: row.usuari,
    Email: row.email,
    Data: row.data,
    Hora_inici: row.hora_inici,
    Hora_fi: row.hora_fi,
    Motiu: row.motiu,
    Estat: (row.estat as EstatReserva) || 'Pendent',
    Creat_el: row.creat_el,
  }
}

async function getCoordinadorEmails(): Promise<string[]> {
  const { usuaris } = useUsuarisStore.getState()
  if (usuaris.length > 0) {
    return usuaris.filter((u) => u.Rol === 'coordinador').map((u) => u.Email).filter(Boolean)
  }
  try {
    const { data, error } = await supabase.from('usuaris').select('email').eq('rol', 'coordinador')
    if (error) throw error
    return (data ?? []).map((r) => r.email).filter(Boolean)
  } catch {
    return []
  }
}

async function notificarNovaReserva(reserva: Reserva): Promise<void> {
  const coordinadors = await getCoordinadorEmails()
  if (coordinadors.length === 0) return
  const data = formatDate(reserva.Data)
  const subject = `[Reserva pendent] ${reserva.Espai} — ${data} ${reserva.Hora_inici}–${reserva.Hora_fi}`
  const body = [
    `S'ha rebut una nova sol·licitud de reserva que requereix confirmació.`,
    '',
    `Espai:        ${reserva.Espai}`,
    `Data:         ${data}`,
    `Hora:         ${reserva.Hora_inici} – ${reserva.Hora_fi}`,
    `Sol·licitant: ${reserva.Usuari}${reserva.Email ? ` (${reserva.Email})` : ''}`,
    `Motiu:        ${reserva.Motiu}`,
    '',
    `Accedeix a Coordinació Digital per confirmar o cancel·lar la reserva.`,
  ].join('\n')

  await Promise.allSettled(coordinadors.map((to) => sendEmail({ to, subject, body })))
}

export function useReserves() {
  const [reserves, setReserves] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const rol = useUsuarisStore((s) => s.rol)
  const user = useAuthStore((s) => s.user)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getAll<ReservaRow>(TABLE, 'data')
      setReserves(rows.map(rowToReserva))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: ReservaFormData): Promise<void> {
    const esCoordinador = potEliminar(rol)
    // Coordinator reservations are auto-confirmed; others need approval
    const estat = esCoordinador ? 'Confirmada' : 'Pendent'
    const usuari = data.Usuari || user?.displayName || ''
    const email = data.Email || user?.email || ''
    const row = await insertRow<ReservaRow>(TABLE, {
      espai: data.Espai, usuari, email, data: data.Data,
      hora_inici: data.Hora_inici, hora_fi: data.Hora_fi, motiu: data.Motiu,
      estat, creat_el: formatDateTimeISO(new Date()),
    })
    if (!esCoordinador) {
      // Fire-and-forget: don't block the UI if email fails
      notificarNovaReserva(rowToReserva(row)).catch(console.error)
    }
    await fetchData()
  }

  async function editar(reserva: Reserva, data: ReservaFormData): Promise<void> {
    await updateRowById(TABLE, reserva.id, {
      espai: data.Espai, usuari: data.Usuari, email: data.Email, data: data.Data,
      hora_inici: data.Hora_inici, hora_fi: data.Hora_fi, motiu: data.Motiu,
    })
    await fetchData()
  }

  async function canviarEstat(reserva: Reserva, estat: EstatReserva): Promise<void> {
    await updateRowById(TABLE, reserva.id, { estat })
    await fetchData()
  }

  async function eliminar(reserva: Reserva): Promise<void> {
    await deleteRowById(TABLE, reserva.id)
    await fetchData()
  }

  return { reserves, loading, error, crear, editar, canviarEstat, eliminar, refetch: fetchData }
}
