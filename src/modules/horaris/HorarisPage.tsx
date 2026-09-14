import { schoolYear } from '../../utils/schoolCalendar'
import { useEffect, useState } from 'react'
import { useHoraris } from './useHoraris'
import { HorariGrid } from './HorariGrid'
import { HorariSlotForm } from './HorariSlotForm'
import { potVeureTotHorari } from './permisos'
import type { DiaSetmana, Horari } from './types'
import { ETAPES_SUBSTITUCIO, ETAPA_FRANJA_KEY, type EtapaSubstitucio } from '../substitucions/types'
import { useAuthStore } from '../../store/authStore'
import { useUsuarisStore } from '../../store/usuarisStore'
import { useConfigStore } from '../../store/configStore'

type Tab = 'meu' | 'tots'

export function HorarisPage() {
  const { horaris, loading, error, load, crear, editar, eliminar } = useHoraris()
  const rol = useUsuarisStore((s) => s.rol)
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const email = (useAuthStore((s) => s.user?.email) ?? '').toLowerCase()

  const usuariActual = usuaris.find((u) => u.Email.toLowerCase() === email) ?? null
  const potVeureTot = potVeureTotHorari(rol)

  const [referenceDate, setReferenceDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const selectedYear = schoolYear(new Date(referenceDate + 'T12:00:00'))
  useEffect(() => { void load(selectedYear) }, [load, selectedYear])
  const activeHoraris = horaris.filter(h => h.VigentDesde <= referenceDate && h.VigentFins >= referenceDate)

  const [tab, setTab] = useState<Tab>('meu')
  const [etapaMevaManual, setEtapaMevaManual] = useState<EtapaSubstitucio | null>(null)
  const etapaMeva = etapaMevaManual ?? usuariActual?.Etapa ?? 'EI'
  const [professorSeleccionat, setProfessorSeleccionat] = useState('')
  const [etapaAliena, setEtapaAliena] = useState<EtapaSubstitucio>('EI')
  const [cellaSeleccionada, setCellaSeleccionada] = useState<{ dia: DiaSetmana; franja: string; existent: Horari | null } | null>(null)

  const frangesMeves = useConfigStore((s) => s.getValues(ETAPA_FRANJA_KEY[etapaMeva]))
  const frangesAliena = useConfigStore((s) => s.getValues(ETAPA_FRANJA_KEY[etapaAliena]))

  const horarisMeus = activeHoraris.filter((h) => h.Professor.toLowerCase() === email && h.Etapa === etapaMeva)
  const horarisAliens = activeHoraris.filter((h) => h.Professor.toLowerCase() === professorSeleccionat.toLowerCase() && h.Etapa === etapaAliena)

  async function handleDesarCella(data: Parameters<typeof crear>[0]) {
    if (cellaSeleccionada?.existent) {
      await editar(cellaSeleccionada.existent, data)
    } else {
      await crear(data)
    }
    setCellaSeleccionada(null)
  }

  async function handleEliminarCella() {
    if (cellaSeleccionada?.existent) {
      await eliminar(cellaSeleccionada.existent)
    }
    setCellaSeleccionada(null)
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-text-main mb-3">Horaris</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('meu')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === 'meu' ? 'bg-white text-text-main shadow-sm' : 'text-gray-500'}`}
          >
            El meu horari
          </button>
          {potVeureTot && (
            <button
              onClick={() => setTab('tots')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === 'tots' ? 'bg-white text-text-main shadow-sm' : 'text-gray-500'}`}
            >
              Tots els horaris
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <label className="mb-4 flex items-center gap-3 text-sm">Horari vigent el
          <input type="date" aria-label="Data de consulta" value={referenceDate} onChange={e => { if (e.target.value) setReferenceDate(e.target.value) }} className="rounded border p-2" />
          <span>Curs {selectedYear}</span>
        </label>
        {loading && <p className="text-xs text-gray-400">Carregant…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}

        {tab === 'meu' && (
          <div className="space-y-3">
            <select
              value={etapaMeva}
              onChange={(e) => setEtapaMevaManual(e.target.value as EtapaSubstitucio)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
            >
              {ETAPES_SUBSTITUCIO.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <HorariGrid
              franges={frangesMeves}
              horaris={horarisMeus}
              editable
              onClickCella={(dia, franja, existent) => setCellaSeleccionada({ dia, franja, existent })}
            />
          </div>
        )}

        {tab === 'tots' && potVeureTot && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <select
                value={professorSeleccionat}
                onChange={(e) => setProfessorSeleccionat(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
              >
                <option value="">Selecciona un professor…</option>
                {usuaris.filter((u) => u.Rol !== 'convidat').map((u) => (
                  <option key={u.id} value={u.Email}>{u.Nom || u.Email}</option>
                ))}
              </select>
              <select
                value={etapaAliena}
                onChange={(e) => setEtapaAliena(e.target.value as EtapaSubstitucio)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
              >
                {ETAPES_SUBSTITUCIO.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            {professorSeleccionat && <HorariGrid franges={frangesAliena} horaris={horarisAliens} editable={false} />}
          </div>
        )}
      </div>

      {cellaSeleccionada && (
        <HorariSlotForm
          cursEscolar={selectedYear}
          diaSetmana={cellaSeleccionada.dia}
          etapa={etapaMeva}
          franja={cellaSeleccionada.franja}
          horariExistent={cellaSeleccionada.existent}
          onDesar={handleDesarCella}
          onEliminar={handleEliminarCella}
          onCancel={() => setCellaSeleccionada(null)}
        />
      )}
    </div>
  )
}
