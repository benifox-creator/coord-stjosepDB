import { useCallback, useEffect, useState } from 'react'
import { getAll, insertRow, updateRowById, deleteRowById } from '../../services/db'
import { useAuthStore } from '../../store/authStore'
import { formatTimestamp, calcularDiesOberts } from './incidencies.utils'
import type { Incidencia, EstatIncidencia, IncidenciaFormData } from './types'

const TABLE = 'incidencies'

interface IncidenciaRow {
  id: string
  codi: string
  marca_temps: string
  estat: string
  prioritat: string
  reporter: string
  tipus_problema: string
  localitzacio: string
  dispositiu: string
  descripcio_detallada: string
  assignat_a: string
  data_resolucio: string
  dies_tasca_oberta: string
  comentaris: string
  notificat: string
}

function rowToIncidencia(row: IncidenciaRow): Incidencia {
  return {
    id: row.id,
    Ticket: row.codi,
    'Marca de temps': row.marca_temps,
    Estat: (row.estat as Incidencia['Estat']) || 'Oberta',
    Prioritat: (row.prioritat as Incidencia['Prioritat']) || 'Mitjana',
    Reporter: row.reporter,
    'Tipus de problema': (row.tipus_problema as Incidencia['Tipus de problema']) || 'Altre',
    Localització: row.localitzacio,
    Dispositiu: row.dispositiu,
    'Descripció detallada': row.descripcio_detallada,
    'Assignat a': row.assignat_a,
    'Data Resolució': row.data_resolucio,
    'Dies Tasca Oberta': row.dies_tasca_oberta,
    Comentaris: row.comentaris,
    Notificat: row.notificat || 'false',
  }
}

export function useIncidencies() {
  const [incidencies, setIncidencies] = useState<Incidencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const user = useAuthStore((s) => s.user)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getAll<IncidenciaRow>(TABLE, 'marca_temps')
      setIncidencies(rows.map(rowToIncidencia))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [])

  // External fetch: synchronous loading state prevents stale content during refresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [fetchData])

  async function crear(data: IncidenciaFormData): Promise<void> {
    const ara = new Date()
    await insertRow(TABLE, {
      marca_temps: formatTimestamp(ara),
      estat: 'Oberta',
      prioritat: data.Prioritat,
      reporter: user?.email ?? '',
      tipus_problema: data['Tipus de problema'],
      localitzacio: data.Localització,
      dispositiu: data.Dispositiu,
      descripcio_detallada: data['Descripció detallada'],
      assignat_a: data['Assignat a'] ?? '',
      comentaris: data.Comentaris ?? '',
      notificat: 'false',
    })
    await fetchData()
  }

  async function canviarEstat(inc: Incidencia, nouEstat: EstatIncidencia): Promise<{ emailProgramat?: boolean }> {
    const ara = new Date()
    const dataResolucio = nouEstat === 'Tancada' ? formatTimestamp(ara) : inc['Data Resolució']
    const dies = nouEstat === 'Tancada'
      ? calcularDiesOberts(inc['Marca de temps'], dataResolucio)
      : inc['Dies Tasca Oberta']

    if (nouEstat !== 'Tancada') {
      await updateRowById(TABLE, inc.id, { estat: nouEstat, data_resolucio: dataResolucio, dies_tasca_oberta: dies })
      await fetchData()
      return {}
    }

    const row = await updateRowById<IncidenciaRow>(TABLE, inc.id, { estat: 'Tancada', data_resolucio: dataResolucio, dies_tasca_oberta: dies })
    await fetchData()
    return { emailProgramat: row.notificat === 'queued' }
  }

  async function assignar(inc: Incidencia, assignat: string): Promise<void> {
    await updateRowById(TABLE, inc.id, { assignat_a: assignat })
    await fetchData()
  }

  async function editarComentaris(inc: Incidencia, comentaris: string): Promise<void> {
    await updateRowById(TABLE, inc.id, { comentaris })
    await fetchData()
  }

  async function eliminar(inc: Incidencia): Promise<void> {
    await deleteRowById(TABLE, inc.id)
    await fetchData()
  }

  return { incidencies, loading, error, crear, canviarEstat, assignar, editarComentaris, eliminar, refetch: fetchData }
}
