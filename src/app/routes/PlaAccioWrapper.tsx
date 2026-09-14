import { useState } from 'react'
import { PlaAccioPage } from '../../modules/pla-accio/PlaAccioPage'
import { ProjecteForm } from '../../modules/pla-accio/ProjecteForm'
import { TascaForm } from '../../modules/pla-accio/TascaForm'
import { TascaDetall } from '../../modules/pla-accio/TascaDetall'
import { useProjectes } from '../../modules/pla-accio/useProjectes'
import { useTasques } from '../../modules/pla-accio/useTasques'
import type { Projecte } from '../../modules/pla-accio/types'
import type { Tasca } from '../../modules/pla-accio/types'
import { useUsuarisStore, potGestionar } from '../../store/usuarisStore'

export default function PlaAccioWrapper() {
  const { projectes, loading: lPrj, error: ePrj, crear: crearProjecte, editar: editarProjecte, eliminar: eliminarProjecte, refetch: refetchPrj } = useProjectes()
  const { tasques, loading: lTas, error: eTas, crear: crearTasca, editar: editarTasca, canviarEstat: canviarEstatTasca, eliminar: eliminarTasca, refetch: refetchTas } = useTasques()
  const rol = useUsuarisStore((s) => s.rol)
  const canGestionar = potGestionar(rol)

  const [formProjecte, setFormProjecte] = useState(false)
  const [editantProjecte, setEditantProjecte] = useState<Projecte | null>(null)
  const [formTasca, setFormTasca] = useState(false)
  const [defaultProjecteId, setDefaultProjecteId] = useState<string | undefined>()
  const [editantTasca, setEditantTasca] = useState<Tasca | null>(null)
  const [seleccionadaTasca, setSeleccionadaTasca] = useState<Tasca | null>(null)

  function handleNovaTasca(projecteId?: string) {
    setEditantTasca(null)
    setDefaultProjecteId(projecteId)
    setFormTasca(true)
  }

  function handleEditarTasca() {
    setEditantTasca(seleccionadaTasca)
    setSeleccionadaTasca(null)
    setFormTasca(true)
  }

  async function handleCanviarEstatTasca(tasca: Tasca, estat: Parameters<typeof canviarEstatTasca>[1]) {
    await canviarEstatTasca(tasca, estat)
    setSeleccionadaTasca((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  function handleRefresh() {
    refetchPrj()
    refetchTas()
  }

  return (
    <>
      <PlaAccioPage
        projectes={projectes}
        tasques={tasques}
        loading={lPrj || lTas}
        error={ePrj ?? eTas}
        canGestionar={canGestionar}
        onRefresh={handleRefresh}
        onNouProjecte={() => { setEditantProjecte(null); setFormProjecte(true) }}
        onEditarProjecte={(p) => { setEditantProjecte(p); setFormProjecte(true) }}
        onEliminarProjecte={eliminarProjecte}
        onNovaTasca={handleNovaTasca}
        onVeureTasca={setSeleccionadaTasca}
      />
      {formProjecte && (
        <ProjecteForm
          projecte={editantProjecte}
          onClose={() => { setFormProjecte(false); setEditantProjecte(null) }}
          onGuardar={editantProjecte
            ? (data) => editarProjecte(editantProjecte, data)
            : crearProjecte
          }
        />
      )}
      {formTasca && (
        <TascaForm
          tasca={editantTasca}
          projectes={projectes}
          defaultProjecteId={defaultProjecteId}
          onClose={() => { setFormTasca(false); setEditantTasca(null); setDefaultProjecteId(undefined) }}
          onGuardar={editantTasca
            ? (data) => editarTasca(editantTasca, data)
            : crearTasca
          }
        />
      )}
      {seleccionadaTasca && (
        <TascaDetall
          tasca={seleccionadaTasca}
          projecte={projectes.find((p) => p.ID === seleccionadaTasca.Projecte_ID)}
          canGestionar={canGestionar}
          onClose={() => setSeleccionadaTasca(null)}
          onEditar={handleEditarTasca}
          onEliminar={async (t) => { await eliminarTasca(t); setSeleccionadaTasca(null) }}
          onCanviarEstat={handleCanviarEstatTasca}
        />
      )}
    </>
  )
}
