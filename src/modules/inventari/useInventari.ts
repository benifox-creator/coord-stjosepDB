import { useCallback, useEffect, useState } from 'react'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import type { ItemInventari, EstatInventari, ItemInventariFormData, CategoriaInventari } from './types'

const TABLE = 'inventari'

interface InventariRow {
  id: string
  codi: string
  nom: string
  categoria: string
  marca: string
  model: string
  num_serie: string
  ubicacio: string
  estat: string
  data_compra: string
  garantia_fins: string
  mac_lan: string
  mac_wan: string
  ip_lan: string
  ip_wan: string
  notes: string
}

function rowToItem(row: InventariRow): ItemInventari {
  return {
    id: row.id,
    ID: row.codi,
    Nom: row.nom,
    Categoria: (row.categoria as CategoriaInventari) || 'Altre',
    Marca: row.marca,
    Model: row.model,
    'Núm_sèrie': row.num_serie,
    Ubicació: row.ubicacio,
    Estat: (row.estat as EstatInventari) || 'Actiu',
    Data_compra: row.data_compra,
    Garantia_fins: row.garantia_fins,
    MAC_LAN: row.mac_lan,
    MAC_WAN: row.mac_wan,
    IP_LAN: row.ip_lan,
    IP_WAN: row.ip_wan,
    Notes: row.notes,
  }
}

function formToInsert(data: ItemInventariFormData): Record<string, unknown> {
  return {
    nom: data.Nom, categoria: data.Categoria, marca: data.Marca, model: data.Model,
    num_serie: data['Núm_sèrie'], ubicacio: data.Ubicació, estat: data.Estat,
    data_compra: data.Data_compra, garantia_fins: data.Garantia_fins,
    mac_lan: data.MAC_LAN, mac_wan: data.MAC_WAN, ip_lan: data.IP_LAN, ip_wan: data.IP_WAN,
    notes: data.Notes,
  }
}

export function useInventari() {
  const [items, setItems] = useState<ItemInventari[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getAll<InventariRow>(TABLE, 'codi')
      setItems(rows.map(rowToItem))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  // External fetch: synchronous loading state prevents stale content during refresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: ItemInventariFormData): Promise<void> {
    await insertRow(TABLE, formToInsert(data))
    await fetchData()
  }

  async function editar(item: ItemInventari, data: ItemInventariFormData): Promise<void> {
    await updateRowById(TABLE, item.id, formToInsert(data))
    await fetchData()
  }

  async function canviarEstat(item: ItemInventari, estat: EstatInventari): Promise<void> {
    await updateRowById(TABLE, item.id, { estat })
    await fetchData()
  }

  async function editarUbicacio(item: ItemInventari, ubicacio: string): Promise<void> {
    await updateRowById(TABLE, item.id, { ubicacio })
    await fetchData()
  }

  async function editarNotes(item: ItemInventari, notes: string): Promise<void> {
    await updateRowById(TABLE, item.id, { notes })
    await fetchData()
  }

  async function donarDeBaixa(item: ItemInventari): Promise<void> {
    await deleteRowById(TABLE, item.id)
    await fetchData()
  }

  async function eliminar(item: ItemInventari): Promise<void> {
    await deleteRowById(TABLE, item.id)
    await fetchData()
  }

  return {
    items,
    loading,
    error,
    crear,
    editar,
    canviarEstat,
    editarUbicacio,
    editarNotes,
    donarDeBaixa,
    eliminar,
    refetch: fetchData,
  }
}
