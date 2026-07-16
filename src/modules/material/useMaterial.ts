import { useCallback, useEffect, useState } from 'react'
import { getRows, appendRow, updateRow, deleteRow } from '../../services/sheets'
import {
  SHEET, HEADERS, ensureHeaders, generateId, rowToItem, itemToRow,
} from './material.utils'
import type { ItemMaterial, MaterialFormData } from './types'

export function useMaterial() {
  const [items, setItems] = useState<ItemMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await ensureHeaders()
      const rows = await getRows(SHEET)
      setItems(
        rows.flatMap((r, i) => r['Eliminat'] === 'true' ? [] : [rowToItem(r, i)])
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: MaterialFormData): Promise<void> {
    const existingIds = items.map((i) => i.ID)
    const nou: ItemMaterial = {
      ID: generateId(existingIds),
      ...data,
      Quantitat_disponible: data.Quantitat_total,
      _rowIndex: -1,
    }
    const row = HEADERS.reduce((acc, h) => {
      if (h === 'Quantitat_total') acc[h] = String(nou.Quantitat_total)
      else if (h === 'Quantitat_disponible') acc[h] = String(nou.Quantitat_disponible)
      else acc[h] = nou[h as keyof Omit<ItemMaterial, 'Quantitat_total' | 'Quantitat_disponible' | '_rowIndex'>] ?? ''
      return acc
    }, {} as Record<string, string>)
    await appendRow(SHEET, row)
    await fetchData()
  }

  async function editar(item: ItemMaterial, data: MaterialFormData): Promise<void> {
    const deltaTotal = data.Quantitat_total - item.Quantitat_total
    const nouDisponible = Math.max(0, item.Quantitat_disponible + deltaTotal)
    const updated: ItemMaterial = { ...item, ...data, Quantitat_disponible: nouDisponible }
    await updateRow(SHEET, item._rowIndex, itemToRow(updated))
    await fetchData()
  }

  async function editarNotes(item: ItemMaterial, notes: string): Promise<void> {
    const updated: ItemMaterial = { ...item, Notes: notes }
    await updateRow(SHEET, item._rowIndex, itemToRow(updated))
    await fetchData()
  }

  async function donarDeBaixa(item: ItemMaterial): Promise<void> {
    await deleteRow(SHEET, item._rowIndex)
    await fetchData()
  }

  return { items, loading, error, crear, editar, editarNotes, donarDeBaixa, refetch: fetchData }
}
