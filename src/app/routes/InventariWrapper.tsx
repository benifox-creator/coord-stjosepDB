import { useState } from 'react'
import { InventariPage } from '../../modules/inventari/InventariPage'
import { InventariForm } from '../../modules/inventari/InventariForm'
import { InventariDetall } from '../../modules/inventari/InventariDetall'
import { useInventari } from '../../modules/inventari/useInventari'
import type { ItemInventari } from '../../modules/inventari/types'
import { useUsuarisStore, potEliminar } from '../../store/usuarisStore'

export default function InventariWrapper() {
  const { items, loading, error, crear, editar, canviarEstat, editarUbicacio, editarNotes, eliminar, refetch } = useInventari()
  const rol = useUsuarisStore((s) => s.rol)
  // Inventari: només coordinador pot afegir, editar i eliminar; direcció sols veu
  const pEditarInventari = potEliminar(rol)
  const [formObert, setFormObert] = useState(false)
  const [editant, setEditant] = useState<ItemInventari | null>(null)
  const [seleccionat, setSeleccionat] = useState<ItemInventari | null>(null)

  function handleEditar(item: ItemInventari) {
    setSeleccionat(null)
    setEditant(item)
  }

  async function handleCanviarEstat(item: ItemInventari, estat: Parameters<typeof canviarEstat>[1]) {
    await canviarEstat(item, estat)
    setSeleccionat((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  return (
    <>
      <InventariPage
        onNou={pEditarInventari ? () => setFormObert(true) : undefined}
        onVeureDetall={setSeleccionat}
        loading={loading}
        items={items}
        error={error}
        onRefresh={refetch}
      />
      {(formObert || editant) && (
        <InventariForm
          onClose={() => { setFormObert(false); setEditant(null) }}
          onGuardar={editant ? (data) => editar(editant, data) : crear}
          inicial={editant ?? undefined}
        />
      )}
      {seleccionat && (
        <InventariDetall
          item={seleccionat}
          onClose={() => setSeleccionat(null)}
          isCoordinador={pEditarInventari}
          potEliminar={pEditarInventari}
          onCanviarEstat={handleCanviarEstat}
          onEditarUbicacio={editarUbicacio}
          onEditarNotes={editarNotes}
          onEditar={handleEditar}
          onEliminar={async (item) => { await eliminar(item); setSeleccionat(null) }}
        />
      )}
    </>
  )
}
