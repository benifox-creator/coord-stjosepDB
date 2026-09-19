import { useEffect, useState } from 'react'
import { ExcursionsPage } from '../../modules/excursions/ExcursionsPage'
import { ExcursioForm } from '../../modules/excursions/ExcursioForm'
import { useExcursions } from '../../modules/excursions/useExcursions'
import type { Excursio, ExcursioFormData } from '../../modules/excursions/types'
import { useUsuarisStore } from '../../store/usuarisStore'
import { useAuthStore } from '../../store/authStore'

export default function ExcursionsWrapper() {
  const { excursions, loading, error, load, crear, editar, canviarEstat } = useExcursions()
  const rol = useUsuarisStore((s) => s.rol)
  const email = (useAuthStore((s) => s.user?.email) ?? '').toLowerCase()
  const potAprovar = rol === 'coordinador' || rol === 'direccio' || rol === 'titular'

  const [formObert, setFormObert] = useState(false)
  const [editant, setEditant] = useState<Excursio | null>(null)

  useEffect(() => { void load() }, [load])

  async function handleDesar(data: ExcursioFormData, enviar: boolean) {
    const id = editant ? (await editar(editant.id, data), editant.id) : (await crear(data)).id
    if (enviar) await canviarEstat(id, 'Proposada')
    setFormObert(false)
    setEditant(null)
    await load()
  }

  function obre(e: Excursio) {
    // De moment només s'obre el que es pot editar: la fitxa amb les accions
    // d'estat arriba a la tasca següent.
    if (e.Estat === 'Esborrany' && e.Creat_per.toLowerCase() === email) setEditant(e)
  }

  return (
    <>
      <ExcursionsPage
        excursions={excursions}
        loading={loading}
        error={error}
        potAprovar={potAprovar}
        onNova={() => setFormObert(true)}
        onObrir={obre}
        onRefresh={() => void load()}
        onCopiarCursAnterior={() => {}}
        onAprovar={async (ids) => {
          // D'una en una i no en paral·lel: si alguna falla, es veu quina i les
          // anteriors ja han quedat aprovades.
          for (const id of ids) await canviarEstat(id, 'Aprovada')
          await load()
        }}
      />
      {(formObert || editant) && (
        <ExcursioForm
          inicial={editant ?? undefined}
          onDesar={handleDesar}
          onClose={() => { setFormObert(false); setEditant(null) }}
        />
      )}
    </>
  )
}
