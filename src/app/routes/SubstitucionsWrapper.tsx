import { useEffect, useMemo } from 'react'
import { useState } from 'react'
import { SubstitucionsPage } from '../../modules/substitucions/SubstitucionsPage'
import { SubstitucioForm } from '../../modules/substitucions/SubstitucioForm'
import { SubstitucioDetall } from '../../modules/substitucions/SubstitucioDetall'
import { useSubstitucions } from '../../modules/substitucions/useSubstitucions'
import type { Substitucio } from '../../modules/substitucions/types'
import { useAbsencies } from '../../modules/absencies/useAbsencies'
import { AbsenciaForm } from '../../modules/absencies/AbsenciaForm'
import { AbsenciaDetall } from '../../modules/absencies/AbsenciaDetall'
import type { Absencia } from '../../modules/absencies/types'
import { useUsuarisStore, potGestionar, potEliminar, potAprovarAbsencies } from '../../store/usuarisStore'

export default function SubstitucionsWrapper() {
  const { substitucions, loading, error, load, crear, canviarEstat, eliminar, assignar } = useSubstitucions()
  const {
    absencies, loading: loadingAbsencies, error: errorAbsencies, load: loadAbsencies,
    crear: crearAbsencia, aprovar, rebutjar, eliminar: eliminarAbsencia,
  } = useAbsencies()
  const rol = useUsuarisStore((s) => s.rol)
  const canGestionar = potGestionar(rol)
  const canAprovar = potAprovarAbsencies(rol)
  const canEliminar = potEliminar(rol)

  useEffect(() => { void load(); void loadAbsencies() }, [load, loadAbsencies])

  const [formObert, setFormObert] = useState(false)
  const [dataInicial, setDataInicial] = useState<string | undefined>()
  const [professorAbsentInicial, setProfessorAbsentInicial] = useState<string | undefined>()
  const [franjaInicial, setFranjaInicial] = useState<string | undefined>()
  const [absenciaIdInicial, setAbsenciaIdInicial] = useState<string | undefined>()
  const [notesInicial, setNotesInicial] = useState<string | undefined>()
  const [seleccionada, setSeleccionada] = useState<Substitucio | null>(null)

  const [formAbsenciaObert, setFormAbsenciaObert] = useState(false)
  const [absenciaSeleccionada, setAbsenciaSeleccionada] = useState<Absencia | null>(null)

  const substitucionsDeLAbsencia = useMemo(
    () => absenciaSeleccionada ? substitucions.filter((s) => s.Absencia_ID === absenciaSeleccionada.id) : [],
    [substitucions, absenciaSeleccionada]
  )

  async function handleCanviarEstat(s: Substitucio, estat: Parameters<typeof canviarEstat>[1]) {
    await canviarEstat(s, estat)
    setSeleccionada((prev) => prev ? { ...prev, Estat: estat } : null)
  }

  function handleNova(data?: string) {
    setDataInicial(data)
    setProfessorAbsentInicial(undefined)
    setFranjaInicial(undefined)
    setAbsenciaIdInicial(undefined)
    setNotesInicial(undefined)
    setFormObert(true)
  }

  function handleCrearSubstitucioDesDAbsencia(a: Absencia) {
    setDataInicial(a.Data)
    setProfessorAbsentInicial(a.Professor)
    setFranjaInicial(`${a.HoraInici}-${a.HoraFi}`)
    setAbsenciaIdInicial(a.id)
    setNotesInicial(a.Notes)
    setFormObert(true)
  }

  async function handleAprovarAbsencia(a: Absencia) {
    await aprovar(a)
    setAbsenciaSeleccionada((prev) => (prev ? { ...prev, Estat: 'Aprovada' } : null))
  }

  async function handleRebutjarAbsencia(a: Absencia, motiu: string) {
    await rebutjar(a, motiu)
    setAbsenciaSeleccionada((prev) => (prev ? { ...prev, Estat: 'Rebutjada', MotiuRebuig: motiu } : null))
  }

  return (
    <>
      <SubstitucionsPage
        substitucions={substitucions}
        loading={loading}
        error={error}
        onRefresh={load}
        onNova={handleNova}
        onVeure={setSeleccionada}
        absencies={absencies}
        loadingAbsencies={loadingAbsencies}
        errorAbsencies={errorAbsencies}
        onRefreshAbsencies={loadAbsencies}
        onNovaAbsencia={() => setFormAbsenciaObert(true)}
        onVeureAbsencia={setAbsenciaSeleccionada}
      />
      {formObert && (
        <SubstitucioForm
          dataInicial={dataInicial}
          professorAbsentInicial={professorAbsentInicial}
          franjaInicial={franjaInicial}
          absenciaIdInicial={absenciaIdInicial}
          notesInicial={notesInicial}
          onDesar={async (data) => { await crear(data); setFormObert(false) }}
          onCancel={() => setFormObert(false)}
        />
      )}
      {seleccionada && (
        <SubstitucioDetall
          onAssignar={async (s, email) => { const updated = await assignar(s, email); setSeleccionada(updated) }}
          substitucio={seleccionada}
          canGestionar={canGestionar}
          onClose={() => setSeleccionada(null)}
          onCanviarEstat={handleCanviarEstat}
          onEliminar={async (s) => { await eliminar(s); setSeleccionada(null) }}
        />
      )}
      {formAbsenciaObert && (
        <AbsenciaForm
          onDesar={async (data) => { await crearAbsencia(data); setFormAbsenciaObert(false) }}
          onCancel={() => setFormAbsenciaObert(false)}
        />
      )}
      {absenciaSeleccionada && !formObert && (
        <AbsenciaDetall
          absencia={absenciaSeleccionada}
          substitucionsVinculades={substitucionsDeLAbsencia}
          potAprovar={canAprovar}
          potGestionar={canGestionar}
          potEliminar={canEliminar}
          onClose={() => setAbsenciaSeleccionada(null)}
          onAprovar={handleAprovarAbsencia}
          onRebutjar={handleRebutjarAbsencia}
          onEliminar={async (a) => { await eliminarAbsencia(a); setAbsenciaSeleccionada(null) }}
          onCrearSubstitucio={handleCrearSubstitucioDesDAbsencia}
        />
      )}
    </>
  )
}
