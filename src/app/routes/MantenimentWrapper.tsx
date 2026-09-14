import { useState } from 'react'
import { MantenimentPage } from '../../modules/manteniment/MantenimentPage'
import { MantenimentForm } from '../../modules/manteniment/MantenimentForm'
import { MantenimentDetall } from '../../modules/manteniment/MantenimentDetall'
import { useManteniment } from '../../modules/manteniment/useManteniment'
import type { Manteniment } from '../../modules/manteniment/types'
import { useUsuarisStore, potGestionar } from '../../store/usuarisStore'

export default function MantenimentWrapper() {
  const { manteniments, loading, error, crear, canviarEstat, eliminar, refetch } = useManteniment()
  const rol = useUsuarisStore((s) => s.rol)
  const canGestionar = potGestionar(rol)

  const [formObert, setFormObert] = useState(false)
  const [seleccionat, setSeleccionat] = useState<Manteniment | null>(null)

  async function handleCanviarEstat(m: Manteniment, estat: Parameters<typeof canviarEstat>[1]) {
    await canviarEstat(m, estat)
    setSeleccionat((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  return (
    <>
      <MantenimentPage
        manteniments={manteniments}
        loading={loading}
        error={error}
        onRefresh={refetch}
        onNou={() => setFormObert(true)}
        onVeure={setSeleccionat}
      />
      {formObert && (
        <MantenimentForm
          onClose={() => setFormObert(false)}
          onGuardar={crear}
        />
      )}
      {seleccionat && (
        <MantenimentDetall
          manteniment={seleccionat}
          canGestionar={canGestionar}
          onClose={() => setSeleccionat(null)}
          onEliminar={async (m) => { await eliminar(m); setSeleccionat(null) }}
          onCanviarEstat={handleCanviarEstat}
        />
      )}
    </>
  )
}
