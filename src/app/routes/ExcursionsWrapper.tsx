import { useEffect } from 'react'
import { ExcursionsPage } from '../../modules/excursions/ExcursionsPage'
import { useExcursions } from '../../modules/excursions/useExcursions'
import { useUsuarisStore } from '../../store/usuarisStore'

export default function ExcursionsWrapper() {
  const { excursions, loading, error, load, canviarEstat } = useExcursions()
  const rol = useUsuarisStore((s) => s.rol)
  const potAprovar = rol === 'coordinador' || rol === 'direccio' || rol === 'titular'

  useEffect(() => { void load() }, [load])

  return (
    <ExcursionsPage
      excursions={excursions}
      loading={loading}
      error={error}
      potAprovar={potAprovar}
      onNova={() => {}}
      onObrir={() => {}}
      onRefresh={() => void load()}
      onCopiarCursAnterior={() => {}}
      onAprovar={async (ids) => {
        // D'una en una i no en paral·lel: si alguna falla, es veu quina i les
        // anteriors ja han quedat aprovades.
        for (const id of ids) await canviarEstat(id, 'Aprovada')
        await load()
      }}
    />
  )
}
