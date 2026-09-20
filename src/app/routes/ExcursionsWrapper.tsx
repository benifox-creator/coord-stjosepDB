import { useEffect, useState } from 'react'
import { ExcursionsPage } from '../../modules/excursions/ExcursionsPage'
import { ExcursioForm } from '../../modules/excursions/ExcursioForm'
import { ExcursioDetall } from '../../modules/excursions/ExcursioDetall'
import { CopiarCursAnterior } from '../../modules/excursions/CopiarCursAnterior'
import { useExcursions } from '../../modules/excursions/useExcursions'
import { potAprovar, potGestionar, potEditar, potVeureCostos } from '../../modules/excursions/permisos'
import { parametresPreu } from '../../modules/excursions/parametres'
import type { Excursio, ExcursioFormData } from '../../modules/excursions/types'
import { useUsuarisStore } from '../../store/usuarisStore'
import { useAuthStore } from '../../store/authStore'
import { useConfigStore } from '../../store/configStore'
import { schoolYear } from '../../utils/schoolCalendar'

export default function ExcursionsWrapper() {
  const { excursions, loading, error, load, crear, editar, canviarEstat, copiarDelCurs } = useExcursions()
  const rol = useUsuarisStore((s) => s.rol)
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const email = (useAuthStore((s) => s.user?.email) ?? '').toLowerCase()
  const jo = usuaris.find((u) => u.Email.toLowerCase() === email) ?? null
  const config = useConfigStore((s) => s.config)

  const [formObert, setFormObert] = useState(false)
  const [editant, setEditant] = useState<Excursio | null>(null)
  const [oberta, setOberta] = useState<Excursio | null>(null)
  const [copiant, setCopiant] = useState(false)

  const cursDesti = schoolYear()
  // El curs anterior es dedueix restant un any als dos extrems: "2026-2027" → "2025-2026".
  const cursOrigen = `${Number(cursDesti.slice(0, 4)) - 1}-${Number(cursDesti.slice(5)) - 1}`

  useEffect(() => { void load() }, [load])

  async function handleDesar(data: ExcursioFormData, enviar: boolean) {
    const id = editant ? (await editar(editant.id, data), editant.id) : (await crear(data)).id
    if (enviar) await canviarEstat(id, 'Proposada')
    setFormObert(false)
    setEditant(null)
    await load()
  }

  return (
    <>
      <ExcursionsPage
        excursions={excursions}
        loading={loading}
        error={error}
        potAprovar={potAprovar(rol)}
        onNova={() => setFormObert(true)}
        onObrir={setOberta}
        onRefresh={() => void load()}
        onCopiarCursAnterior={() => setCopiant(true)}
        onAprovar={async (ids) => {
          // D'una en una i no en paral·lel: si alguna falla, es veu quina i les
          // anteriors ja han quedat aprovades.
          for (const id of ids) await canviarEstat(id, 'Aprovada')
          await load()
        }}
      />

      {oberta && (
        <ExcursioDetall
          excursio={oberta}
          potAprovar={potAprovar(rol)}
          potGestionar={potGestionar(rol, jo)}
          potEditar={potEditar(oberta, email, rol, jo)}
          potVeureCostos={potVeureCostos(rol, jo)}
          parametres={parametresPreu(config, oberta.Etapa)}
          onCanviarEstat={async (estat, motiu) => {
            await canviarEstat(oberta.id, estat, motiu)
            await load()
          }}
          onEditar={() => { setEditant(oberta); setOberta(null) }}
          onClose={() => setOberta(null)}
        />
      )}

      {copiant && (
        <CopiarCursAnterior
          cursOrigen={cursOrigen}
          cursDesti={cursDesti}
          onCopiar={copiarDelCurs}
          onClose={() => setCopiant(false)}
        />
      )}

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
