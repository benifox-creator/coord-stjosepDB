import { useCallback, useEffect, useState } from 'react'
import { getRows, appendRow, updateRow, deleteRow } from '../../services/sheets'
import { SHEET, HEADERS, ensureHeaders, generateId, formatDateISO } from './prestecs.utils'
import { adjustStock, parseMaterial } from '../material/material.utils'
import type { Prestec, EstatPrestec, PrestecFormData } from './types'

function rowToPrestec(row: Record<string, string>, index: number): Prestec {
  return {
    ID: row['ID'] ?? '',
    Dispositiu_ID: row['Dispositiu_ID'] ?? '',
    Dispositiu_Nom: row['Dispositiu_Nom'] ?? '',
    Usuari: row['Usuari'] ?? '',
    Email: row['Email'] ?? '',
    Data_inici: row['Data_inici'] ?? '',
    Data_fi_prevista: row['Data_fi_prevista'] ?? '',
    Data_fi_real: row['Data_fi_real'] ?? '',
    Material: row['Material'] ?? '',
    Estat: (row['Estat'] as EstatPrestec) || 'Actiu',
    Notes: row['Notes'] ?? '',
    _rowIndex: index,
  }
}

function prestecToRow(p: Prestec): Record<string, string> {
  return HEADERS.reduce((acc, h) => {
    acc[h] = p[h as keyof Omit<Prestec, '_rowIndex'>] ?? ''
    return acc
  }, {} as Record<string, string>)
}

export function usePrestecs() {
  const [prestecs, setPrestecs] = useState<Prestec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await ensureHeaders()
      const rows = await getRows(SHEET)
      setPrestecs(
        rows.flatMap((r, i) => r['Eliminat'] === 'true' ? [] : [rowToPrestec(r, i)])
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: PrestecFormData): Promise<void> {
    const existingIds = prestecs.map((p) => p.ID)
    const nou: Prestec = {
      ID: generateId(existingIds),
      ...data,
      Data_fi_real: '',
      Estat: 'Actiu',
      _rowIndex: -1,
    }
    await appendRow(SHEET, prestecToRow(nou))
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
    const updated: Prestec = { ...prestec, Estat: estat, Data_fi_real: dataFiReal }
    await updateRow(SHEET, prestec._rowIndex, prestecToRow(updated))
    // Si es retorna, incrementar stock del material
    if (estat === 'Retornat' && prestec.Estat !== 'Retornat') {
      const matItems = parseMaterial(prestec.Material)
      if (matItems.length > 0) {
        await adjustStock(matItems.map((m) => ({ ID: m.ID, delta: m.Quantitat })))
      }
    }
    await fetchData()
  }

  async function editarNotes(prestec: Prestec, notes: string): Promise<void> {
    const updated: Prestec = { ...prestec, Notes: notes }
    await updateRow(SHEET, prestec._rowIndex, prestecToRow(updated))
    await fetchData()
  }

  async function eliminar(prestec: Prestec): Promise<void> {
    // Si el préstec estava actiu, restaurem el stock del material
    if (prestec.Estat !== 'Retornat') {
      const matItems = parseMaterial(prestec.Material)
      if (matItems.length > 0) {
        await adjustStock(matItems.map((m) => ({ ID: m.ID, delta: m.Quantitat })))
      }
    }
    await deleteRow(SHEET, prestec._rowIndex)
    await fetchData()
  }

  return { prestecs, loading, error, crear, canviarEstat, editarNotes, eliminar, refetch: fetchData }
}
