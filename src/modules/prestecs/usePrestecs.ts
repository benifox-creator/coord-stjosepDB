import { useCallback, useEffect, useState } from 'react'
import { supabase, insertRow, updateRowById, deleteRowById } from '../../services/db'
import { formatDateISO } from './prestecs.utils'
import { adjustStock, parseMaterial, serializeMaterial, getMaterialIdsByCodi } from '../material/material.utils'
import type { Prestec, EstatPrestec, PrestecFormData } from './types'

const TABLE = 'prestecs'

interface PrestecItemJoined {
  quantitat: number
  material: { codi: string; nom: string } | null
}

interface PrestecRow {
  id: string
  codi: string
  dispositiu_id: string
  dispositiu_nom: string
  usuari: string
  email: string
  data_inici: string
  data_fi_prevista: string
  data_fi_real: string
  estat: string
  notes: string
  prestec_items: PrestecItemJoined[]
}

function rowToPrestec(row: PrestecRow): Prestec {
  const material = serializeMaterial(
    (row.prestec_items ?? [])
      .filter((it) => it.material)
      .map((it) => ({ ID: it.material!.codi, Nom: it.material!.nom, Quantitat: it.quantitat }))
  )
  return {
    id: row.id,
    ID: row.codi,
    Dispositiu_ID: row.dispositiu_id,
    Dispositiu_Nom: row.dispositiu_nom,
    Usuari: row.usuari,
    Email: row.email,
    Data_inici: row.data_inici,
    Data_fi_prevista: row.data_fi_prevista,
    Data_fi_real: row.data_fi_real,
    Material: material,
    Estat: (row.estat as EstatPrestec) || 'Actiu',
    Notes: row.notes,
  }
}

const SELECT_AMB_ITEMS = '*, prestec_items(quantitat, material:material_id(codi, nom))'

async function fetchPrestecItems(prestecId: string): Promise<{ ID: string; Quantitat: number }[]> {
  const { data, error } = await supabase
    .from('prestec_items')
    .select('quantitat, material:material_id(codi)')
    .eq('prestec_id', prestecId)
  if (error) throw new Error(`Error llegint material del préstec: ${error.message}`)
  return ((data ?? []) as unknown as { quantitat: number; material: { codi: string } | null }[])
    .filter((it) => it.material)
    .map((it) => ({ ID: it.material!.codi, Quantitat: it.quantitat }))
}

async function crearPrestecItems(prestecId: string, material: string): Promise<void> {
  const items = parseMaterial(material)
  if (items.length === 0) return
  const idMap = await getMaterialIdsByCodi(items.map((m) => m.ID))
  const rows = items
    .filter((m) => idMap[m.ID])
    .map((m) => ({ prestec_id: prestecId, material_id: idMap[m.ID], quantitat: m.Quantitat }))
  if (rows.length === 0) return
  const { error } = await supabase.from('prestec_items').insert(rows)
  if (error) throw new Error(`Error desant material del préstec: ${error.message}`)
}

export function usePrestecs() {
  const [prestecs, setPrestecs] = useState<Prestec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: selectError } = await supabase.from(TABLE).select(SELECT_AMB_ITEMS).order('data_inici')
      if (selectError) throw selectError
      setPrestecs((data as unknown as PrestecRow[] ?? []).map(rowToPrestec))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: PrestecFormData): Promise<void> {
    const row = await insertRow<{ id: string }>(TABLE, {
      dispositiu_id: data.Dispositiu_ID, dispositiu_nom: data.Dispositiu_Nom,
      usuari: data.Usuari, email: data.Email, data_inici: data.Data_inici,
      data_fi_prevista: data.Data_fi_prevista, estat: 'Actiu', notes: data.Notes,
    })
    await crearPrestecItems(row.id, data.Material)
    // Decrementar stock del material inclòs
    const matItems = parseMaterial(data.Material)
    if (matItems.length > 0) {
      await adjustStock(matItems.map((m) => ({ ID: m.ID, delta: -m.Quantitat })))
    }
    await fetchData()
  }

  async function canviarEstat(prestec: Prestec, estat: EstatPrestec): Promise<void> {
    const dataFiReal = estat === 'Retornat' && !prestec.Data_fi_real
      ? formatDateISO(new Date())
      : prestec.Data_fi_real
    await updateRowById(TABLE, prestec.id, { estat, data_fi_real: dataFiReal })
    // Si es retorna, incrementar stock del material
    if (estat === 'Retornat' && prestec.Estat !== 'Retornat') {
      const items = await fetchPrestecItems(prestec.id)
      if (items.length > 0) {
        await adjustStock(items.map((m) => ({ ID: m.ID, delta: m.Quantitat })))
      }
    }
    await fetchData()
  }

  async function editarNotes(prestec: Prestec, notes: string): Promise<void> {
    await updateRowById(TABLE, prestec.id, { notes })
    await fetchData()
  }

  async function eliminar(prestec: Prestec): Promise<void> {
    // Si el préstec estava actiu, restaurem el stock del material
    if (prestec.Estat !== 'Retornat') {
      const items = await fetchPrestecItems(prestec.id)
      if (items.length > 0) {
        await adjustStock(items.map((m) => ({ ID: m.ID, delta: m.Quantitat })))
      }
    }
    await deleteRowById(TABLE, prestec.id)
    await fetchData()
  }

  return { prestecs, loading, error, crear, canviarEstat, editarNotes, eliminar, refetch: fetchData }
}
