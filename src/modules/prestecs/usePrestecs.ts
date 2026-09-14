import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, callRpc, updateRowById } from '../../services/db'
import { parseMaterial, serializeMaterial } from '../material/material.utils'
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

export function usePrestecs() {
  const requestId = useRef(crypto.randomUUID())
  const [prestecs, setPrestecs] = useState<Prestec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows: PrestecRow[] = []
      for (;;) {
        const { data, error: selectError, count } = await supabase.from(TABLE)
          .select(SELECT_AMB_ITEMS, { count: 'exact' }).order('data_inici').order('id').range(rows.length, rows.length + 499)
        if (selectError) throw selectError
        if (count === null) throw new Error('No es pot verificar la lectura dels préstecs')
        rows.push(...(data ?? []) as unknown as PrestecRow[])
        if (rows.length >= count) break
        if (!data?.length) throw new Error('Lectura incompleta dels préstecs')
      }
      setPrestecs(rows.map(rowToPrestec))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  // External fetch: synchronous loading state prevents stale content during refresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: PrestecFormData): Promise<void> {
    await callRpc('create_loan', { p_request_id: requestId.current, p_data: {
      dispositiu_id: data.Dispositiu_ID, dispositiu_nom: data.Dispositiu_Nom,
      usuari: data.Usuari, email: data.Email, data_inici: data.Data_inici,
      data_fi_prevista: data.Data_fi_prevista, notes: data.Notes,
    }, p_items: parseMaterial(data.Material).map(m => ({ codi: m.ID, quantitat: m.Quantitat })) })
    requestId.current = crypto.randomUUID()
    await fetchData()
  }

  async function canviarEstat(prestec: Prestec, estat: EstatPrestec): Promise<void> {
    await callRpc('change_loan_state', { p_id: prestec.id, p_state: estat })
    await fetchData()
  }

  async function editarNotes(prestec: Prestec, notes: string): Promise<void> {
    await updateRowById(TABLE, prestec.id, { notes })
    await fetchData()
  }

  async function eliminar(prestec: Prestec): Promise<void> {
    await callRpc('delete_loan', { p_id: prestec.id })
    await fetchData()
  }

  return { prestecs, loading, error, crear, canviarEstat, editarNotes, eliminar, refetch: fetchData }
}
