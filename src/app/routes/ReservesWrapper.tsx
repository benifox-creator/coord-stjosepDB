import { useState } from 'react'
import { ReservesPage } from '../../modules/reserves/ReservesPage'
import { ReservaForm } from '../../modules/reserves/ReservaForm'
import { ReservaDetall } from '../../modules/reserves/ReservaDetall'
import { useReserves } from '../../modules/reserves/useReserves'
import type { Reserva } from '../../modules/reserves/types'
import { useUsuarisStore, potGestionar, potEliminar } from '../../store/usuarisStore'

export default function ReservesWrapper() {
  const { reserves, loading, error, crear, editar, canviarEstat, eliminar, refetch } = useReserves()
  const rol = useUsuarisStore((s) => s.rol)
  const pGestionar = potGestionar(rol)
  const pEliminar = potEliminar(rol)
  const [formObert, setFormObert] = useState(false)
  const [editant, setEditant] = useState<Reserva | null>(null)
  const [seleccionada, setSeleccionada] = useState<Reserva | null>(null)

  function handleEditar(reserva: Reserva) {
    setSeleccionada(null)
    setEditant(reserva)
  }

  async function handleCanviarEstat(r: Reserva, estat: Parameters<typeof canviarEstat>[1]) {
    await canviarEstat(r, estat)
    setSeleccionada((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  return (
    <>
      <ReservesPage
        onNova={() => setFormObert(true)}
        onVeureDetall={setSeleccionada}
        loading={loading}
        reserves={reserves}
        error={error}
        onRefresh={refetch}
      />
      {(formObert || editant) && (
        <ReservaForm
          onClose={() => { setFormObert(false); setEditant(null) }}
          onGuardar={editant ? (data) => editar(editant, data) : crear}
          inicial={editant ?? undefined}
        />
      )}
      {seleccionada && (
        <ReservaDetall
          reserva={seleccionada}
          onClose={() => setSeleccionada(null)}
          isCoordinador={pGestionar}
          potEliminar={pEliminar}
          onCanviarEstat={handleCanviarEstat}
          onEditar={handleEditar}
          onEliminar={async (r) => { await eliminar(r); setSeleccionada(null) }}
        />
      )}
    </>
  )
}
