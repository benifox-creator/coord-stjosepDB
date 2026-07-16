import { useCallback, useEffect, useState } from 'react'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import { useAuthStore } from '../../store/authStore'
import { useConfigStore } from '../../store/configStore'
import type { Manteniment, MantenimentFormData, EstatManteniment } from './types'

const TABLE = 'manteniment'

interface MantenimentRow {
  id: string
  codi: string
  titol: string
  categoria: string
  localitzacio: string
  descripcio: string
  prioritat: string
  estat: string
  reporter: string
  data_report: string
  data_resolucio: string
  notes: string
  creat_el: string
}

function rowToManteniment(row: MantenimentRow): Manteniment {
  return {
    id: row.id,
    ID: row.codi,
    Titol: row.titol,
    Categoria: (row.categoria as Manteniment['Categoria']) || 'Altres',
    Localitzacio: row.localitzacio,
    Descripcio: row.descripcio,
    Prioritat: (row.prioritat as Manteniment['Prioritat']) || 'Normal',
    Estat: (row.estat as EstatManteniment) || 'Pendent',
    Reporter: row.reporter,
    Data_report: row.data_report,
    Data_resolucio: row.data_resolucio,
    Notes: row.notes,
    Creat_el: row.creat_el,
  }
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
      const rows = await getAll<MantenimentRow>(TABLE, 'creat_el')
      setManteniments(rows.map(rowToManteniment))
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
    const row = await insertRow<MantenimentRow>(TABLE, {
      titol: data.Titol, categoria: data.Categoria, localitzacio: data.Localitzacio,
      descripcio: data.Descripcio, prioritat: data.Prioritat,
      estat: 'Pendent', reporter, data_report: avui,
      notes: data.Notes,
    })
    await fetchData()

    const emailResponsable = useConfigStore.getState().getValues('manteniment.email')[0]
    if (emailResponsable) {
      await enviarEmailDesperfecte(rowToManteniment(row), emailResponsable).catch(() => undefined)
    }
  }

  async function editar(m: Manteniment, data: MantenimentFormData): Promise<void> {
    await updateRowById(TABLE, m.id, {
      titol: data.Titol, categoria: data.Categoria, localitzacio: data.Localitzacio,
      descripcio: data.Descripcio, prioritat: data.Prioritat, notes: data.Notes,
    })
    await fetchData()
  }

  async function canviarEstat(m: Manteniment, estat: EstatManteniment): Promise<void> {
    const dataResolucio = estat === 'Resolt' && !m.Data_resolucio
      ? new Date().toISOString().slice(0, 10)
      : m.Data_resolucio
    await updateRowById(TABLE, m.id, { estat, data_resolucio: dataResolucio })
    await fetchData()
  }

  async function eliminar(m: Manteniment): Promise<void> {
    await deleteRowById(TABLE, m.id)
    await fetchData()
  }

  return { manteniments, loading, error, crear, editar, canviarEstat, eliminar, refetch: fetchData }
}
