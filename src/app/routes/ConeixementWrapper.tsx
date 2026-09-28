import { useState } from 'react'
import { ConeixementPage } from '../../modules/coneixement/ConeixementPage'
import { ConeixementForm } from '../../modules/coneixement/ConeixementForm'
import { ConeixementDetall } from '../../modules/coneixement/ConeixementDetall'
import { useConeixement } from '../../modules/coneixement/useConeixement'
import {
  potRedactar as calculaPotRedactar,
  potPublicar as calculaPotPublicar,
  potEliminar as calculaPotEliminar,
} from '../../modules/coneixement/permisos'
import type { Article } from '../../modules/coneixement/types'
import { useUsuarisStore } from '../../store/usuarisStore'
import { useAuthStore } from '../../store/authStore'

export default function ConeixementWrapper() {
  const rol = useUsuarisStore((s) => s.rol)
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const email = (useAuthStore((s) => s.user?.email) ?? '').toLowerCase()
  const jo = usuaris.find((u) => u.Email.toLowerCase() === email) ?? null

  const potRedactar = calculaPotRedactar(rol, jo)
  const potPublicar = calculaPotPublicar(rol)

  const { articles, loading, error, crear, editar, togglePublicat, publica, eliminar, refetch } = useConeixement(potRedactar)
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
        potRedactar={potRedactar}
        potPublicar={potPublicar}
        onNou={() => setFormObert(true)}
        onVeureDetall={setSeleccionat}
        onRefresh={refetch}
        publica={publica}
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
          potRedactar={potRedactar}
          potPublicar={potPublicar}
          potEliminar={calculaPotEliminar(rol, jo, seleccionat.Publicat === 'true')}
          onClose={() => setSeleccionat(null)}
          onEditar={() => handleEditar(seleccionat)}
          onTogglePublicat={async (a) => { await togglePublicat(a); setSeleccionat(null) }}
          onEliminar={async (a) => { await eliminar(a); setSeleccionat(null) }}
        />
      )}
    </>
  )
}
