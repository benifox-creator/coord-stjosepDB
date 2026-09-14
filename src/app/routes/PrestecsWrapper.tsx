import { useState } from 'react'
import { PrestecsPage } from '../../modules/prestecs/PrestecsPage'
import { PrestecForm } from '../../modules/prestecs/PrestecForm'
import { PrestecDetall } from '../../modules/prestecs/PrestecDetall'
import { usePrestecs } from '../../modules/prestecs/usePrestecs'
import type { Prestec } from '../../modules/prestecs/types'
import { useMaterial } from '../../modules/material/useMaterial'
import { useUsuarisStore, potGestionar, potEliminar } from '../../store/usuarisStore'

export default function PrestecsWrapper() {
  const { prestecs, loading, error, crear, canviarEstat, editarNotes, eliminar, refetch } = usePrestecs()
  const { items: materialDisponible } = useMaterial()
  const rol = useUsuarisStore((s) => s.rol)
  const pGestionar = potGestionar(rol)
  const pEliminar = potEliminar(rol)
  // Préstecs: sols el coordinador pot crear nous préstecs
  const pCrearPrestec = potEliminar(rol)
  const [formObert, setFormObert] = useState(false)
  const [seleccionat, setSeleccionat] = useState<Prestec | null>(null)

  async function handleCanviarEstat(p: Prestec, estat: Parameters<typeof canviarEstat>[1]) {
    await canviarEstat(p, estat)
    setSeleccionat((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  return (
    <>
      <PrestecsPage
        onNou={pCrearPrestec ? () => setFormObert(true) : undefined}
        onVeureDetall={setSeleccionat}
        loading={loading}
        prestecs={prestecs}
        error={error}
        onRefresh={refetch}
      />
      {formObert && (
        <PrestecForm
          onClose={() => setFormObert(false)}
          onGuardar={crear}
          materialDisponible={materialDisponible}
        />
      )}
      {seleccionat && (
        <PrestecDetall
          prestec={seleccionat}
          onClose={() => setSeleccionat(null)}
          isCoordinador={pGestionar}
          potEliminar={pEliminar}
          onCanviarEstat={handleCanviarEstat}
          onEditarNotes={editarNotes}
          onEliminar={async (p) => { await eliminar(p); setSeleccionat(null) }}
        />
      )}
    </>
  )
}
