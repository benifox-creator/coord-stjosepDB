import { useCallback, useEffect, useState } from 'react'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import type { ItemMaterial, MaterialFormData, CategoriaMaterial } from './types'

const TABLE = 'material'

interface MaterialRow {
  id: string
  codi: string
  nom: string
  categoria: string
  descripcio: string
  quantitat_total: number
  quantitat_disponible: number
  ubicacio: string
  notes: string
}

function rowToItem(row: MaterialRow): ItemMaterial {
  return {
    id: row.id,
    ID: row.codi,
    Nom: row.nom,
    Categoria: (row.categoria as CategoriaMaterial) || 'Altre',
    Descripció: row.descripcio,
    Quantitat_total: row.quantitat_total,
    Quantitat_disponible: row.quantitat_disponible,
    Ubicació: row.ubicacio,
    Notes: row.notes,
  }
}

export function useMaterial() {
  const [items, setItems] = useState<ItemMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getAll<MaterialRow>(TABLE, 'codi')
      setItems(rows.map(rowToItem))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: MaterialFormData): Promise<void> {
    await insertRow(TABLE, {
      nom: data.Nom, categoria: data.Categoria, descripcio: data.Descripció,
      quantitat_total: data.Quantitat_total, quantitat_disponible: data.Quantitat_total,
      ubicacio: data.Ubicació, notes: data.Notes,
    })
    await fetchData()
  }

  async function editar(item: ItemMaterial, data: MaterialFormData): Promise<void> {
    const deltaTotal = data.Quantitat_total - item.Quantitat_total
    const nouDisponible = Math.max(0, item.Quantitat_disponible + deltaTotal)
    await updateRowById(TABLE, item.id, {
      nom: data.Nom, categoria: data.Categoria, descripcio: data.Descripció,
      quantitat_total: data.Quantitat_total, quantitat_disponible: nouDisponible,
      ubicacio: data.Ubicació, notes: data.Notes,
    })
    await fetchData()
  }

  async function editarNotes(item: ItemMaterial, notes: string): Promise<void> {
    await updateRowById(TABLE, item.id, { notes })
    await fetchData()
  }

  async function donarDeBaixa(item: ItemMaterial): Promise<void> {
    await deleteRowById(TABLE, item.id)
    await fetchData()
  }

  return { items, loading, error, crear, editar, editarNotes, donarDeBaixa, refetch: fetchData }
}
