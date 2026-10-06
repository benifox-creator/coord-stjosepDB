import { useCallback, useEffect, useState } from 'react'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import type { Ubicacio } from './ubicacions'

const TABLE = 'ubicacions'

interface UbicacioRow {
  id: string
  codi: string
  edifici: string
  planta: string
}

function rowToUbicacio(row: UbicacioRow): Ubicacio {
  return { id: row.id, Codi: row.codi, Edifici: row.edifici, Planta: row.planta }
}

function dadesToRow(d: Omit<Ubicacio, 'id'>): Record<string, unknown> {
  return { codi: d.Codi.trim(), edifici: d.Edifici.trim(), planta: d.Planta.trim() }
}

export function useUbicacions() {
  const [ubicacions, setUbicacions] = useState<Ubicacio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getAll<UbicacioRow>(TABLE, 'codi')
      setUbicacions(rows.map(rowToUbicacio))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  // External fetch: synchronous loading state prevents stale content during refresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [fetchData])

  async function crear(d: Omit<Ubicacio, 'id'>): Promise<void> {
    await insertRow(TABLE, dadesToRow(d))
    await fetchData()
  }

  async function editar(u: Ubicacio, d: Omit<Ubicacio, 'id'>): Promise<void> {
    await updateRowById(TABLE, u.id, dadesToRow(d))
    await fetchData()
  }

  async function eliminar(u: Ubicacio): Promise<void> {
    await deleteRowById(TABLE, u.id)
    await fetchData()
  }

  return { ubicacions, loading, error, crear, editar, eliminar, refetch: fetchData }
}
