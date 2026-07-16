import { useCallback, useEffect, useState } from 'react'
import { getRows, appendRow, updateRow, deleteRow } from '../../services/sheets'
import { useAuthStore } from '../../store/authStore'
import { useConfigStore } from '../../store/configStore'
import {
  SHEET_MANTENIMENT, HEADERS_MANTENIMENT, ensureHeadersManteniment,
  generateMantenimentId, formatDateTimeISO,
} from './manteniment.utils'
import type { Manteniment, MantenimentFormData, EstatManteniment } from './types'

function rowToManteniment(row: Record<string, string>, index: number): Manteniment {
  return {
    ID: row['ID'] ?? '',
    Titol: row['Titol'] ?? '',
    Categoria: (row['Categoria'] as Manteniment['Categoria']) || 'Altres',
    Localitzacio: row['Localitzacio'] ?? '',
    Descripcio: row['Descripcio'] ?? '',
    Prioritat: (row['Prioritat'] as Manteniment['Prioritat']) || 'Normal',
    Estat: (row['Estat'] as EstatManteniment) || 'Pendent',
    Reporter: row['Reporter'] ?? '',
    Data_report: row['Data_report'] ?? '',
    Data_resolucio: row['Data_resolucio'] ?? '',
    Notes: row['Notes'] ?? '',
    Creat_el: row['Creat_el'] ?? '',
    _rowIndex: index,
  }
}

function mantenimentToRow(m: Manteniment): Record<string, string> {
  return [...HEADERS_MANTENIMENT].reduce((acc, h) => {
    acc[h] = m[h as keyof Omit<Manteniment, '_rowIndex'>] ?? ''
    return acc
  }, {} as Record<string, string>)
}

async function enviarEmailDesperfecte(m: Manteniment, emailResponsable: string): Promise<void> {
  const { sendEmail } = await import('../../services/gmail')
  const cos = [
    `S'ha reportat un nou desperfecte al centre que requereix la teva atenció.`,
    ``,
    `ID: ${m.ID}`,
    `Títol: ${m.Titol}`,
    `Categoria: ${m.Categoria}`,
    `Localització: ${m.Localitzacio || '(no especificada)'}`,
    `Prioritat: ${m.Prioritat}`,
    `Reportat per: ${m.Reporter}`,
    `Data: ${m.Data_report}`,
    ``,
    `Descripció:`,
    m.Descripcio || '(sense descripció)',
    m.Notes ? `\nNotes: ${m.Notes}` : '',
  ].join('\n')

  await sendEmail({
    to: emailResponsable,
    subject: `[Manteniment ${m.Prioritat}] ${m.Titol}`,
    body: cos,
  })
}

export function useManteniment() {
  const [manteniments, setManteniments] = useState<Manteniment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await ensureHeadersManteniment()
      const rows = await getRows(SHEET_MANTENIMENT)
      setManteniments(rows.flatMap((r, i) => r['Eliminat'] === 'true' ? [] : [rowToManteniment(r, i)]))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: MantenimentFormData): Promise<void> {
    const reporter = useAuthStore.getState().user?.email ?? ''
    const avui = new Date().toISOString().slice(0, 10)
    const nou: Manteniment = {
      ID: generateMantenimentId(manteniments.map((m) => m.ID)),
      ...data,
      Estat: 'Pendent',
      Reporter: reporter,
      Data_report: avui,
      Data_resolucio: '',
      Creat_el: formatDateTimeISO(new Date()),
      _rowIndex: -1,
    }
    await appendRow(SHEET_MANTENIMENT, mantenimentToRow(nou))
    await fetchData()

    const emailResponsable = useConfigStore.getState().getValues('manteniment.email')[0]
    if (emailResponsable) {
      await enviarEmailDesperfecte(nou, emailResponsable).catch(() => undefined)
    }
  }

  async function editar(m: Manteniment, data: MantenimentFormData): Promise<void> {
    await updateRow(SHEET_MANTENIMENT, m._rowIndex, mantenimentToRow({ ...m, ...data }))
    await fetchData()
  }

  async function canviarEstat(m: Manteniment, estat: EstatManteniment): Promise<void> {
    const updated = {
      ...m,
      Estat: estat,
      Data_resolucio: estat === 'Resolt' && !m.Data_resolucio
        ? new Date().toISOString().slice(0, 10)
        : m.Data_resolucio,
    }
    await updateRow(SHEET_MANTENIMENT, m._rowIndex, mantenimentToRow(updated))
    await fetchData()
  }

  async function eliminar(m: Manteniment): Promise<void> {
    await deleteRow(SHEET_MANTENIMENT, m._rowIndex)
    await fetchData()
  }

  return { manteniments, loading, error, crear, editar, canviarEstat, eliminar, refetch: fetchData }
}
