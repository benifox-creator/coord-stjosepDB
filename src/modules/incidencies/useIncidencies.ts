import { useCallback, useEffect, useState } from 'react'
import { getRows, appendRow, updateRow, deleteRow } from '../../services/sheets'
import { useAuthStore } from '../../store/authStore'
import { sendEmail } from '../../services/gmail'
import {
  SHEET, HEADERS, ensureHeaders,
  generateTicket, formatTimestamp, calcularDiesOberts, formatDate, formatDatetime,
} from './incidencies.utils'
import type { Incidencia, EstatIncidencia, IncidenciaFormData } from './types'

function buildEmailTancament(inc: Incidencia, dataResolucio: string, dies: string): string {
  const lines = [
    'Benvolgut/da,',
    '',
    `T'informem que la incidència ${inc.Ticket} ha estat resolta i tancada.`,
    '',
    '────────────────────────────',
    'DETALLS DE LA INCIDÈNCIA',
    '────────────────────────────',
    `Ticket:             ${inc.Ticket}`,
    `Tipus de problema:  ${inc['Tipus de problema']}`,
    `Localització:       ${inc.Localització}`,
  ]
  if (inc.Dispositiu) lines.push(`Dispositiu:         ${inc.Dispositiu}`)
  lines.push(
    `Data d'obertura:    ${formatDatetime(inc['Marca de temps'])}`,
    `Data de resolució:  ${formatDate(dataResolucio)}`,
    `Dies obert:         ${dies || '0'}`,
  )
  if (inc.Comentaris) {
    lines.push(
      '',
      '────────────────────────────',
      'RESOLUCIÓ / COMENTARIS',
      '────────────────────────────',
      inc.Comentaris,
    )
  }
  lines.push(
    '',
    'Si necessites més informació, posa\'t en contacte amb la Coordinació Digital.',
    '',
    'Gràcies,',
    'Coordinació Digital',
    'Col·legi Sant Josep Obrer',
  )
  return lines.join('\n')
}

function rowToIncidencia(row: Record<string, string>, index: number): Incidencia {
  return {
    Ticket: row['Ticket'] ?? '',
    'Marca de temps': row['Marca de temps'] ?? '',
    Estat: (row['Estat'] as Incidencia['Estat']) || 'Oberta',
    Prioritat: (row['Prioritat'] as Incidencia['Prioritat']) || 'Mitjana',
    Reporter: row['Reporter'] ?? '',
    'Tipus de problema': (row['Tipus de problema'] as Incidencia['Tipus de problema']) || 'Altre',
    Localització: row['Localització'] ?? '',
    Dispositiu: row['Dispositiu'] ?? '',
    'Descripció detallada': row['Descripció detallada'] ?? '',
    'Assignat a': row['Assignat a'] ?? '',
    'Data Resolució': row['Data Resolució'] ?? '',
    'Dies Tasca Oberta': row['Dies Tasca Oberta'] ?? '',
    Comentaris: row['Comentaris'] ?? '',
    Notificat: row['Notificat'] ?? 'false',
    _rowIndex: index,
  }
}

function incidenciaToRow(inc: Incidencia): Record<string, string> {
  return HEADERS.reduce((acc, h) => {
    acc[h] = inc[h as keyof Omit<Incidencia, '_rowIndex'>] ?? ''
    return acc
  }, {} as Record<string, string>)
}

export function useIncidencies() {
  const [incidencies, setIncidencies] = useState<Incidencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const user = useAuthStore((s) => s.user)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await ensureHeaders()
      const rows = await getRows(SHEET)
      setIncidencies(rows.flatMap((r, i) => r['Eliminat'] === 'true' ? [] : [rowToIncidencia(r, i)]))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: IncidenciaFormData): Promise<void> {
    const existingTickets = incidencies.map((i) => i.Ticket)
    const ara = new Date()
    const nova: Incidencia = {
      Ticket: generateTicket(existingTickets),
      'Marca de temps': formatTimestamp(ara),
      Estat: 'Oberta',
      Prioritat: data.Prioritat,
      Reporter: user?.email ?? '',
      'Tipus de problema': data['Tipus de problema'],
      Localització: data.Localització,
      Dispositiu: data.Dispositiu,
      'Descripció detallada': data['Descripció detallada'],
      'Assignat a': data['Assignat a'] ?? '',
      'Data Resolució': '',
      'Dies Tasca Oberta': '',
      Comentaris: data.Comentaris ?? '',
      Notificat: 'false',
      _rowIndex: -1,
    }
    await appendRow(SHEET, incidenciaToRow(nova))
    await fetchData()
  }

  async function canviarEstat(inc: Incidencia, nouEstat: EstatIncidencia): Promise<{ emailEnviat?: boolean }> {
    const ara = new Date()
    const dataResolucio = nouEstat === 'Tancada' ? formatTimestamp(ara) : inc['Data Resolució']
    const dies = nouEstat === 'Tancada'
      ? calcularDiesOberts(inc['Marca de temps'], dataResolucio)
      : inc['Dies Tasca Oberta']

    if (nouEstat !== 'Tancada') {
      const updated: Incidencia = { ...inc, Estat: nouEstat, 'Data Resolució': dataResolucio, 'Dies Tasca Oberta': dies }
      await updateRow(SHEET, inc._rowIndex, incidenciaToRow(updated))
      await fetchData()
      return {}
    }

    // Marca com a pendent i actualitza el full
    const base: Incidencia = { ...inc, Estat: 'Tancada', 'Data Resolució': dataResolucio, 'Dies Tasca Oberta': dies, Notificat: 'pending' }
    await updateRow(SHEET, inc._rowIndex, incidenciaToRow(base))

    // Intenta enviar email i actualitza Notificat
    let emailEnviat = false
    if (inc.Reporter) {
      try {
        await sendEmail({
          to: inc.Reporter,
          subject: `Incidència ${inc.Ticket} resolta — ${inc['Tipus de problema']}`,
          body: buildEmailTancament(inc, dataResolucio, dies),
        })
        emailEnviat = true
      } catch {
        // Notificat queda 'pending' per reintentar manualment
      }
      const final: Incidencia = { ...base, Notificat: emailEnviat ? 'true' : 'pending' }
      await updateRow(SHEET, inc._rowIndex, incidenciaToRow(final))
    }

    await fetchData()
    return { emailEnviat }
  }

  async function assignar(inc: Incidencia, assignat: string): Promise<void> {
    const updated: Incidencia = { ...inc, 'Assignat a': assignat }
    await updateRow(SHEET, inc._rowIndex, incidenciaToRow(updated))
    await fetchData()
  }

  async function editarComentaris(inc: Incidencia, comentaris: string): Promise<void> {
    const updated: Incidencia = { ...inc, Comentaris: comentaris }
    await updateRow(SHEET, inc._rowIndex, incidenciaToRow(updated))
    await fetchData()
  }

  async function eliminar(inc: Incidencia): Promise<void> {
    await deleteRow(SHEET, inc._rowIndex)
    await fetchData()
  }

  return { incidencies, loading, error, crear, canviarEstat, assignar, editarComentaris, eliminar, refetch: fetchData }

}
