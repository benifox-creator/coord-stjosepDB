import { useCallback, useEffect, useState } from 'react'
import { getRows, appendRow, updateRow, deleteRow } from '../../services/sheets'

import {
  SHEET, HEADERS, ensureHeaders, generateId,
} from './inventari.utils'
import type { ItemInventari, EstatInventari, ItemInventariFormData, CategoriaInventari } from './types'

function rowToItem(row: Record<string, string>, index: number): ItemInventari {
  return {
    ID: row['ID'] ?? '',
    Nom: row['Nom'] ?? '',
    Categoria: (row['Categoria'] as CategoriaInventari) || 'Altre',
    Marca: row['Marca'] ?? '',
    Model: row['Model'] ?? '',
    'Núm_sèrie': row['Núm_sèrie'] ?? '',
    Ubicació: row['Ubicació'] ?? '',
    Estat: (row['Estat'] as EstatInventari) || 'Actiu',
    Data_compra: row['Data_compra'] ?? '',
    Garantia_fins: row['Garantia_fins'] ?? '',
    MAC_LAN: row['MAC_LAN'] ?? '',
    MAC_WAN: row['MAC_WAN'] ?? '',
    IP_LAN: row['IP_LAN'] ?? '',
    IP_WAN: row['IP_WAN'] ?? '',
    Notes: row['Notes'] ?? '',
    _rowIndex: index,
  }
}

function itemToRow(item: ItemInventari): Record<string, string> {
  return HEADERS.reduce((acc, h) => {
    acc[h] = item[h as keyof Omit<ItemInventari, '_rowIndex'>] ?? ''
    return acc
  }, {} as Record<string, string>)
}

export function useInventari() {
  const [items, setItems] = useState<ItemInventari[]>([])
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

  async function crear(data: ItemInventariFormData): Promise<void> {
    const existingIds = items.map((i) => i.ID)
    const nouItem: ItemInventari = {
      ID: generateId(existingIds),
      ...data,
      _rowIndex: -1,
    }
    await appendRow(SHEET, itemToRow(nouItem))
    await fetchData()
  }

  async function editar(item: ItemInventari, data: ItemInventariFormData): Promise<void> {
    const updated: ItemInventari = { ...item, ...data }
    await updateRow(SHEET, item._rowIndex, itemToRow(updated))
    await fetchData()
  }

  async function canviarEstat(item: ItemInventari, estat: EstatInventari): Promise<void> {
    const updated: ItemInventari = { ...item, Estat: estat }
    await updateRow(SHEET, item._rowIndex, itemToRow(updated))
    await fetchData()
  }

  async function editarUbicacio(item: ItemInventari, ubicacio: string): Promise<void> {
    const updated: ItemInventari = { ...item, Ubicació: ubicacio }
    await updateRow(SHEET, item._rowIndex, itemToRow(updated))
    await fetchData()
  }

  async function editarNotes(item: ItemInventari, notes: string): Promise<void> {
    const updated: ItemInventari = { ...item, Notes: notes }
    await updateRow(SHEET, item._rowIndex, itemToRow(updated))
    await fetchData()
  }

  async function donarDeBaixa(item: ItemInventari): Promise<void> {
    await deleteRow(SHEET, item._rowIndex)
    await fetchData()
  }

  async function eliminar(item: ItemInventari): Promise<void> {
    await deleteRow(SHEET, item._rowIndex)
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

