import { useCallback, useEffect, useState } from 'react'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import { formatDateTimeISO } from './pla-accio.utils'
import type { Projecte, ProjecteFormData, EstatProjecte } from './types'

const TABLE = 'projectes'

interface ProjecteRow {
  id: string
  codi: string
  nom: string
  descripcio: string
  categoria: string
  estat: string
  responsable: string
  data_inici: string
  data_fi_prevista: string
  creat_el: string
}

function rowToProjecte(row: ProjecteRow): Projecte {
  return {
    id: row.id,
    ID: row.codi,
    Nom: row.nom,
    Descripcio: row.descripcio,
    Categoria: row.categoria,
    Estat: (row.estat as EstatProjecte) || 'Actiu',
    Responsable: row.responsable,
    Data_inici: row.data_inici,
    Data_fi_prevista: row.data_fi_prevista,
    Creat_el: row.creat_el,
  }
}

function formToInsert(data: ProjecteFormData): Record<string, unknown> {
  return {
    nom: data.Nom, descripcio: data.Descripcio, categoria: data.Categoria, estat: data.Estat,
    responsable: data.Responsable, data_inici: data.Data_inici, data_fi_prevista: data.Data_fi_prevista,
  }
}

export function useProjectes() {
  const [projectes, setProjectes] = useState<Projecte[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getAll<ProjecteRow>(TABLE, 'creat_el')
      setProjectes(rows.map(rowToProjecte))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  // External fetch: synchronous loading state prevents stale content during refresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: ProjecteFormData): Promise<void> {
    await insertRow(TABLE, { ...formToInsert(data), creat_el: formatDateTimeISO(new Date()) })
    await fetchData()
  }

  async function editar(projecte: Projecte, data: ProjecteFormData): Promise<void> {
    await updateRowById(TABLE, projecte.id, formToInsert(data))
    await fetchData()
  }

  async function canviarEstat(projecte: Projecte, estat: EstatProjecte): Promise<void> {
    await updateRowById(TABLE, projecte.id, { estat })
    await fetchData()
  }

  async function eliminar(projecte: Projecte): Promise<void> {
    await deleteRowById(TABLE, projecte.id)
    await fetchData()
  }

  return { projectes, loading, error, crear, editar, canviarEstat, eliminar, refetch: fetchData }
}
