import { useCallback, useEffect, useState } from 'react'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import { formatDateTimeISO } from './pla-accio.utils'
import type { Tasca, TascaFormData, EstatTasca } from './types'

const TABLE = 'tasques'

interface TascaRow {
  id: string
  codi: string
  projecte_codi: string
  titol: string
  descripcio: string
  estat: string
  prioritat: string
  responsable: string
  data_limit: string
  creat_el: string
}

function rowToTasca(row: TascaRow): Tasca {
  return {
    id: row.id,
    ID: row.codi,
    Projecte_ID: row.projecte_codi,
    Titol: row.titol,
    Descripcio: row.descripcio,
    Estat: (row.estat as EstatTasca) || 'Pendent',
    Prioritat: (row.prioritat as Tasca['Prioritat']) || 'Mitjana',
    Responsable: row.responsable,
    Data_limit: row.data_limit,
    Creat_el: row.creat_el,
  }
}

function formToInsert(data: TascaFormData): Record<string, unknown> {
  return {
    projecte_codi: data.Projecte_ID, titol: data.Titol, descripcio: data.Descripcio,
    estat: data.Estat, prioritat: data.Prioritat, responsable: data.Responsable,
    data_limit: data.Data_limit,
  }
}

export function useTasques() {
  const [tasques, setTasques] = useState<Tasca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getAll<TascaRow>(TABLE, 'creat_el')
      setTasques(rows.map(rowToTasca))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: TascaFormData): Promise<void> {
    await insertRow(TABLE, { ...formToInsert(data), creat_el: formatDateTimeISO(new Date()) })
    await fetchData()
  }

  async function editar(tasca: Tasca, data: TascaFormData): Promise<void> {
    await updateRowById(TABLE, tasca.id, formToInsert(data))
    await fetchData()
  }

  async function canviarEstat(tasca: Tasca, estat: EstatTasca): Promise<void> {
    await updateRowById(TABLE, tasca.id, { estat })
    await fetchData()
  }

  async function eliminar(tasca: Tasca): Promise<void> {
    await deleteRowById(TABLE, tasca.id)
    await fetchData()
  }

  return { tasques, loading, error, crear, editar, canviarEstat, eliminar, refetch: fetchData }
}
