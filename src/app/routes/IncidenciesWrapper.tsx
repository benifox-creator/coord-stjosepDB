import { useState } from 'react'
import { IncidenciesPage } from '../../modules/incidencies/IncidenciesPage'
import { IncidenciaForm } from '../../modules/incidencies/IncidenciaForm'
import { IncidenciaDetall } from '../../modules/incidencies/IncidenciaDetall'
import { useIncidencies } from '../../modules/incidencies/useIncidencies'
import type { Incidencia } from '../../modules/incidencies/types'
import { useInventari } from '../../modules/inventari/useInventari'
import { useUsuarisStore, potGestionar, potEliminar } from '../../store/usuarisStore'

export default function IncidenciesWrapper() {
  const { incidencies, loading, error, crear, canviarEstat, assignar, editarComentaris, eliminar, refetch } = useIncidencies()
  const { items: inventariItems } = useInventari()
  const inventariPerSelector = inventariItems.map((item) => ({ id: item.ID, nom: item.Nom, ubicacio: item.Ubicació }))
  const rol = useUsuarisStore((s) => s.rol)
  const pGestionar = potGestionar(rol)
  const pEliminar = potEliminar(rol)
  const [formObert, setFormObert] = useState(false)
  const [seleccionada, setSeleccionada] = useState<Incidencia | null>(null)

  async function handleCanviarEstat(inc: Incidencia, estat: Parameters<typeof canviarEstat>[1]) {
    const result = await canviarEstat(inc, estat)
    setSeleccionada((prev) => prev ? { ...prev, Estat: estat } : null)
    return result
  }

  return (
    <>
      <IncidenciesPage
        onNova={() => setFormObert(true)}
        onVeureDetall={setSeleccionada}
        loading={loading}
        incidencies={incidencies}
        error={error}
        onRefresh={refetch}
      />
      {formObert && (
        <IncidenciaForm
          onClose={() => setFormObert(false)}
          onGuardar={crear}
          isCoordinador={pGestionar}
          inventari={inventariPerSelector}
        />
      )}
      {seleccionada && (
        <IncidenciaDetall
          incidencia={seleccionada}
          onClose={() => setSeleccionada(null)}
          isCoordinador={pGestionar}
          potEliminar={pEliminar}
          onCanviarEstat={handleCanviarEstat}
          onAssignar={assignar}
          onEditarComentaris={editarComentaris}
          onEliminar={async (inc) => { await eliminar(inc); setSeleccionada(null) }}
        />
      )}
    </>
  )
}
