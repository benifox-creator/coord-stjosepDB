import { useCallback, useEffect, useState } from 'react'
import { getRows, appendRow, updateRow, deleteRow } from '../../services/sheets'
import { SHEET, HEADERS, ensureHeaders, generateId, formatDateTimeISO, formatDate } from './reserves.utils'
import { sendEmail } from '../../services/gmail'
import { useUsuarisStore, potEliminar } from '../../store/usuarisStore'
import { useAuthStore } from '../../store/authStore'
import type { Reserva, EstatReserva, ReservaFormData } from './types'

async function getCoordinadorEmails(): Promise<string[]> {
  const { usuaris } = useUsuarisStore.getState()
  if (usuaris.length > 0) {
    return usuaris.filter((u) => u.Rol === 'coordinador').map((u) => u.Email).filter(Boolean)
  }
  try {
    const rows = await getRows('Usuaris')
    return rows.filter((r) => r['Rol'] === 'coordinador').map((r) => r['Email']).filter(Boolean)
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

function rowToReserva(row: Record<string, string>, index: number): Reserva {
  return {
    ID: row['ID'] ?? '',
    Espai: row['Espai'] ?? '',
    Usuari: row['Usuari'] ?? '',
    Email: row['Email'] ?? '',
    Data: row['Data'] ?? '',
    Hora_inici: row['Hora_inici'] ?? '',
    Hora_fi: row['Hora_fi'] ?? '',
    Motiu: row['Motiu'] ?? '',
    Estat: (row['Estat'] as EstatReserva) || 'Pendent',
    Creat_el: row['Creat_el'] ?? '',
    _rowIndex: index,
  }
}

function reservaToRow(r: Reserva): Record<string, string> {
  return HEADERS.reduce((acc, h) => {
    acc[h] = r[h as keyof Omit<Reserva, '_rowIndex'>] ?? ''
    return acc
  }, {} as Record<string, string>)
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
      await ensureHeaders()
      const rows = await getRows(SHEET)
      setReserves(
        rows.flatMap((r, i) => r['Eliminat'] === 'true' ? [] : [rowToReserva(r, i)])
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: ReservaFormData): Promise<void> {
    const existingIds = reserves.map((r) => r.ID)
    const esCoordinador = potEliminar(rol)
    // Coordinator reservations are auto-confirmed; others need approval
    const estat = esCoordinador ? 'Confirmada' : 'Pendent'
    const nova: Reserva = {
      ID: generateId(existingIds),
      Espai: data.Espai,
      Usuari: data.Usuari || user?.displayName || '',
      Email: data.Email || user?.email || '',
      Data: data.Data,
      Hora_inici: data.Hora_inici,
      Hora_fi: data.Hora_fi,
      Motiu: data.Motiu,
      Estat: estat,
      Creat_el: formatDateTimeISO(new Date()),
      _rowIndex: -1,
    }
    await appendRow(SHEET, reservaToRow(nova))
    if (!esCoordinador) {
      // Fire-and-forget: don't block the UI if email fails
      notificarNovaReserva(nova).catch(console.error)
    }
    await fetchData()
  }

  async function editar(reserva: Reserva, data: ReservaFormData): Promise<void> {
    const updated: Reserva = { ...reserva, ...data }
    await updateRow(SHEET, reserva._rowIndex, reservaToRow(updated))
    await fetchData()
  }

  async function canviarEstat(reserva: Reserva, estat: EstatReserva): Promise<void> {
    const updated: Reserva = { ...reserva, Estat: estat }
    await updateRow(SHEET, reserva._rowIndex, reservaToRow(updated))
    await fetchData()
  }

  async function eliminar(reserva: Reserva): Promise<void> {
    await deleteRow(SHEET, reserva._rowIndex)
    await fetchData()
  }

  return { reserves, loading, error, crear, editar, canviarEstat, eliminar, refetch: fetchData }
}
