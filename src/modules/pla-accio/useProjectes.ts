import { useCallback, useEffect, useState } from 'react'
import { getRows, appendRow, updateRow, deleteRow } from '../../services/sheets'
import {
  SHEET_PROJECTES, HEADERS_PROJECTES, ensureHeadersProjectes,
  generateProjecteId, formatDateTimeISO,
} from './pla-accio.utils'
import type { Projecte, ProjecteFormData, EstatProjecte } from './types'

function rowToProjecte(row: Record<string, string>, index: number): Projecte {
  return {
    ID: row['ID'] ?? '',
    Nom: row['Nom'] ?? '',
    Descripcio: row['Descripcio'] ?? '',
    Categoria: row['Categoria'] ?? '',
    Estat: (row['Estat'] as EstatProjecte) || 'Actiu',
    Responsable: row['Responsable'] ?? '',
    Data_inici: row['Data_inici'] ?? '',
    Data_fi_prevista: row['Data_fi_prevista'] ?? '',
    Creat_el: row['Creat_el'] ?? '',
    _rowIndex: index,
  }
}

function projecteToRow(p: Projecte): Record<string, string> {
  return [...HEADERS_PROJECTES].reduce((acc, h) => {
    acc[h] = p[h as keyof Omit<Projecte, '_rowIndex'>] ?? ''
    return acc
  }, {} as Record<string, string>)
}

export function useProjectes() {
  const [projectes, setProjectes] = useState<Projecte[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await ensureHeadersProjectes()
      const rows = await getRows(SHEET_PROJECTES)
      setProjectes(rows.flatMap((r, i) => r['Eliminat'] === 'true' ? [] : [rowToProjecte(r, i)]))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: ProjecteFormData): Promise<void> {
    const nou: Projecte = {
      ID: generateProjecteId(projectes.map((p) => p.ID)),
      ...data,
      Creat_el: formatDateTimeISO(new Date()),
      _rowIndex: -1,
    }
    await appendRow(SHEET_PROJECTES, projecteToRow(nou))
    await fetchData()
  }

  async function editar(projecte: Projecte, data: ProjecteFormData): Promise<void> {
    await updateRow(SHEET_PROJECTES, projecte._rowIndex, projecteToRow({ ...projecte, ...data }))
    await fetchData()
  }

  async function canviarEstat(projecte: Projecte, estat: EstatProjecte): Promise<void> {
    await updateRow(SHEET_PROJECTES, projecte._rowIndex, projecteToRow({ ...projecte, Estat: estat }))
    await fetchData()
  }

  async function eliminar(projecte: Projecte): Promise<void> {
    await deleteRow(SHEET_PROJECTES, projecte._rowIndex)
    await fetchData()
  }

  return { projectes, loading, error, crear, editar, canviarEstat, eliminar, refetch: fetchData }
}
