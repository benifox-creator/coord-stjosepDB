import { useCallback, useEffect, useState } from 'react'
import { getRows, appendRow, updateRow, deleteRow } from '../../services/sheets'
import {
  SHEET_TASQUES, HEADERS_TASQUES, ensureHeadersTasques,
  generateTascaId, formatDateTimeISO,
} from './pla-accio.utils'
import type { Tasca, TascaFormData, EstatTasca } from './types'

function rowToTasca(row: Record<string, string>, index: number): Tasca {
  return {
    ID: row['ID'] ?? '',
    Projecte_ID: row['Projecte_ID'] ?? '',
    Titol: row['Titol'] ?? '',
    Descripcio: row['Descripcio'] ?? '',
    Estat: (row['Estat'] as EstatTasca) || 'Pendent',
    Prioritat: (row['Prioritat'] as Tasca['Prioritat']) || 'Mitjana',
    Responsable: row['Responsable'] ?? '',
    Data_limit: row['Data_limit'] ?? '',
    Creat_el: row['Creat_el'] ?? '',
    _rowIndex: index,
  }
}

function tascaToRow(t: Tasca): Record<string, string> {
  return [...HEADERS_TASQUES].reduce((acc, h) => {
    acc[h] = t[h as keyof Omit<Tasca, '_rowIndex'>] ?? ''
    return acc
  }, {} as Record<string, string>)
}

export function useTasques() {
  const [tasques, setTasques] = useState<Tasca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await ensureHeadersTasques()
      const rows = await getRows(SHEET_TASQUES)
      setTasques(rows.flatMap((r, i) => r['Eliminat'] === 'true' ? [] : [rowToTasca(r, i)]))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: TascaFormData): Promise<void> {
    const nova: Tasca = {
      ID: generateTascaId(tasques.map((t) => t.ID)),
      ...data,
      Creat_el: formatDateTimeISO(new Date()),
      _rowIndex: -1,
    }
    await appendRow(SHEET_TASQUES, tascaToRow(nova))
    await fetchData()
  }

  async function editar(tasca: Tasca, data: TascaFormData): Promise<void> {
    await updateRow(SHEET_TASQUES, tasca._rowIndex, tascaToRow({ ...tasca, ...data }))
    await fetchData()
  }

  async function canviarEstat(tasca: Tasca, estat: EstatTasca): Promise<void> {
    await updateRow(SHEET_TASQUES, tasca._rowIndex, tascaToRow({ ...tasca, Estat: estat }))
    await fetchData()
  }

  async function eliminar(tasca: Tasca): Promise<void> {
    await deleteRow(SHEET_TASQUES, tasca._rowIndex)
    await fetchData()
  }

  return { tasques, loading, error, crear, editar, canviarEstat, eliminar, refetch: fetchData }
}
