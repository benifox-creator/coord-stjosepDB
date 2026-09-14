import { useState } from 'react'
import { MaterialPage } from '../../modules/material/MaterialPage'
import { MaterialForm } from '../../modules/material/MaterialForm'
import { MaterialDetall } from '../../modules/material/MaterialDetall'
import { useMaterial } from '../../modules/material/useMaterial'
import type { ItemMaterial } from '../../modules/material/types'
import { useUsuarisStore, potGestionar, potEliminar } from '../../store/usuarisStore'

export default function MaterialWrapper() {
  const { items, loading, error, crear, editar, editarNotes, donarDeBaixa, refetch } = useMaterial()
  const rol = useUsuarisStore((s) => s.rol)
  const pGestionar = potGestionar(rol)
  const pEliminar = potEliminar(rol)
  const [formObert, setFormObert] = useState(false)
  const [editant, setEditant] = useState<ItemMaterial | null>(null)
  const [seleccionat, setSeleccionat] = useState<ItemMaterial | null>(null)

  function handleEditar(item: ItemMaterial) {
    setSeleccionat(null)
    setEditant(item)
  }

  return (
    <>
      <MaterialPage
        onNou={() => setFormObert(true)}
        onVeureDetall={setSeleccionat}
        loading={loading}
        items={items}
        error={error}
        onRefresh={refetch}
      />
      {(formObert || editant) && (
        <MaterialForm
          onClose={() => { setFormObert(false); setEditant(null) }}
          onGuardar={editant ? (data) => editar(editant, data) : crear}
          inicial={editant ?? undefined}
        />
      )}
      {seleccionat && (
        <MaterialDetall
          item={seleccionat}
          onClose={() => setSeleccionat(null)}
          isCoordinador={pGestionar}
          potEliminar={pEliminar}
          onEditarNotes={editarNotes}
          onEditar={handleEditar}
          onEliminar={async (item) => { await donarDeBaixa(item); setSeleccionat(null) }}
        />
      )}
    </>
  )
}
