import { useEffect, useState } from 'react'
import { getRows, type SheetRow } from '../services/sheets'

interface SheetsState {
  data: SheetRow[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useSheets(sheet: string): SheetsState {
  const [data, setData] = useState<SheetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getRows(sheet)
      .then((rows) => {
        if (!cancelled) setData(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error desconegut')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [sheet, tick])

  return { data, loading, error, refetch: () => setTick((t) => t + 1) }
}
