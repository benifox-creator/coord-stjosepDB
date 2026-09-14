import { useState } from 'react'
import { ConeixementPage } from '../../modules/coneixement/ConeixementPage'
import { ConeixementForm } from '../../modules/coneixement/ConeixementForm'
import { ConeixementDetall } from '../../modules/coneixement/ConeixementDetall'
import { useConeixement } from '../../modules/coneixement/useConeixement'
import type { Article } from '../../modules/coneixement/types'
import { useUsuarisStore, potEliminar } from '../../store/usuarisStore'

export default function ConeixementWrapper() {
  const rol = useUsuarisStore((s) => s.rol)
  const esCoordinador = potEliminar(rol)
  const { articles, loading, error, crear, editar, togglePublicat, eliminar, refetch } = useConeixement(esCoordinador)
  const [formObert, setFormObert] = useState(false)
  const [editant, setEditant] = useState<Article | null>(null)
  const [seleccionat, setSeleccionat] = useState<Article | null>(null)

  function handleEditar(article: Article) {
    setSeleccionat(null)
    setEditant(article)
  }

  return (
    <>
      <ConeixementPage
        articles={articles}
        loading={loading}
        error={error}
        esCoordinador={esCoordinador}
        onNou={() => setFormObert(true)}
        onVeureDetall={setSeleccionat}
        onRefresh={refetch}
      />
      {(formObert || editant) && (
        <ConeixementForm
          inicial={editant ?? undefined}
          onClose={() => { setFormObert(false); setEditant(null) }}
          onGuardar={editant ? (data) => editar(editant, data) : crear}
        />
      )}
      {seleccionat && (
        <ConeixementDetall
          article={seleccionat}
          esCoordinador={esCoordinador}
          onClose={() => setSeleccionat(null)}
          onEditar={() => handleEditar(seleccionat)}
          onTogglePublicat={async (a) => { await togglePublicat(a); setSeleccionat(null) }}
          onEliminar={async (a) => { await eliminar(a); setSeleccionat(null) }}
        />
      )}
    </>
  )
}
