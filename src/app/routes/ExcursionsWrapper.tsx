import { useEffect, useState } from 'react'
import { ExcursionsPage } from '../../modules/excursions/ExcursionsPage'
import { ExcursioForm } from '../../modules/excursions/ExcursioForm'
import { ExcursioDetall } from '../../modules/excursions/ExcursioDetall'
import { CopiarCursAnterior } from '../../modules/excursions/CopiarCursAnterior'
import { useExcursions } from '../../modules/excursions/useExcursions'
import { useFinances } from '../../modules/excursions/useFinances'
import { potAprovar, potGestionar, potEditar, potVeureCostos } from '../../modules/excursions/permisos'
import { parametresPreu } from '../../modules/excursions/parametres'
import { proposaDates } from '../../modules/excursions/datesCircular'
import { textosCircular } from '../../modules/excursions/circular/textos'
import type { Excursio, ExcursioFormData } from '../../modules/excursions/types'
import { useUsuarisStore } from '../../store/usuarisStore'
import { useAuthStore } from '../../store/authStore'
import { useConfigStore } from '../../store/configStore'
import { schoolYear } from '../../utils/schoolCalendar'

/**
 * Un nombre de dies de la configuració. Si el valor desat no s'entén —algú hi
 * va escriure "dues setmanes"— val més la proposta de sempre que una data en
 * «Invalid Date» a la circular. Mateix criteri que `parametresPreu`.
 */
function dies(valors: string[], defecte: number): number {
  const desat = Number(valors[0]?.trim())
  return Number.isFinite(desat) && desat > 0 ? desat : defecte
}

export default function ExcursionsWrapper() {
  const { excursions, loading, error, load, crear, editar, canviarEstat, copiarDelCurs, enviarCircular } = useExcursions()
  const rol = useUsuarisStore((s) => s.rol)
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const email = (useAuthStore((s) => s.user?.email) ?? '').toLowerCase()
  const jo = usuaris.find((u) => u.Email.toLowerCase() === email) ?? null
  const config = useConfigStore((s) => s.config)
  const diesNoLectius = useConfigStore((s) => s.getValues('centre.dies-no-lectius'))
  const diesAbansCircular = useConfigStore((s) => dies(s.getValues('excursions.dies-abans-circular'), 15))
  const diesAbansTermini = useConfigStore((s) => dies(s.getValues('excursions.dies-abans-termini'), 8))
  const confirmaPreu = useFinances((s) => s.confirma)

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
          datesCircular={proposaDates(oberta.Data ?? '', diesNoLectius, diesAbansCircular, diesAbansTermini)}
          textosCircular={textosCircular(config)}
          diesNoLectius={diesNoLectius}
          onEnviarCircular={async (dates) => {
            await enviarCircular(oberta.id, dates)
            // Mateixa ruta que onConfirmaPreu: es recarrega i es torna a agafar
            // la fila fresca sense tancar la fitxa, perquè qui l'envia hi vegi
            // l'estat nou i qui hi consta com a remitent.
            await load()
            setOberta((actual) => (actual && useExcursions.getState().excursions.find((x) => x.id === actual.id)) || actual)
          }}
          onCanviarEstat={async (estat, motiu) => {
            await canviarEstat(oberta.id, estat, motiu)
            await load()
          }}
          onConfirmaPreu={async (preu, finances) => {
            // Els mateixos paràmetres amb què `BlocEconomic` ha calculat
            // `preu`, perquè `confirmar_preu` els congeli amb el preu: si es
            // recalculessin aquí, una configuració canviada entremig faria
            // que el preu confirmat i els paràmetres desats no coincidissin.
            await confirmaPreu(oberta.id, preu, finances, parametresPreu(config, oberta.Etapa))
            // Mateixa ruta que onCanviarEstat: recarregar la llista i, d'aquí,
            // agafar la fila fresca. Però aquí no es tanca la fitxa (onClose)
            // en acabar: qui acaba de confirmar un preu vol veure'l sense
            // haver de tornar a obrir la targeta.
            await load()
            setOberta((actual) => (actual && useExcursions.getState().excursions.find((x) => x.id === actual.id)) || actual)
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
