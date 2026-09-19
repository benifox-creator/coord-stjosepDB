import { useState } from 'react'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import type { Excursio, ExcursioFormData, Transport } from './types'
import { ETAPES_EXCURSIO, TRANSPORTS, TRANSPORT_LABELS } from './types'
import { campsQueFalten, esDiaLectiu, grupsTriables, formDataDe } from './excursions.utils'
import { useConfigStore } from '../../store/configStore'
import { useUsuarisStore } from '../../store/usuarisStore'
import { useAuthStore } from '../../store/authStore'
import type { EtapaSubstitucio } from '../substitucions/types'

interface Props {
  inicial?: Excursio
  onDesar: (data: ExcursioFormData, enviar: boolean) => Promise<void>
  onClose: () => void
}

export function ExcursioForm({ inicial, onDesar, onClose }: Props) {
  const jo = (useAuthStore((s) => s.user?.email) ?? '').toLowerCase()
  const grupsDisponibles = useConfigStore((s) => s.getValues('substitucions.grups'))
  const diesNoLectius = useConfigStore((s) => s.getValues('centre.dies-no-lectius'))
  const usuaris = useUsuarisStore((s) => s.usuaris)

  const [d, setD] = useState<ExcursioFormData>(() => formDataDe(inicial, jo))
  const [desant, setDesant] = useState(false)
  const [error, setError] = useState('')

  const falten = campsQueFalten(d)
  const dataNoLectiva = d.Data !== '' && !esDiaLectiu(d.Data, diesNoLectius)
  const potEnviar = falten.length === 0 && !dataNoLectiva

  function canvia<K extends keyof ExcursioFormData>(camp: K, valor: ExcursioFormData[K]) {
    setD((x) => ({ ...x, [camp]: valor }))
  }

  async function desa(enviar: boolean) {
    setDesant(true)
    setError('')
    try {
      await onDesar({ ...d, Grups: d.Grups.filter((g) => g.Grup) }, enviar)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No s’ha pogut desar.')
      setDesant(false)
    }
  }

  const camp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg'
  const etiqueta = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-text-main">
            {inicial ? `Excursió ${inicial.Codi}` : 'Nova excursió'}
          </h2>
          <button onClick={onClose} disabled={desant} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiqueta} htmlFor="exc-etapa">Etapa</label>
              <select id="exc-etapa" className={camp} value={d.Etapa} onChange={(e) => canvia('Etapa', e.target.value as EtapaSubstitucio)}>
                {ETAPES_EXCURSIO.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className={etiqueta} htmlFor="exc-data">Data</label>
              <input id="exc-data" type="date" className={camp} value={d.Data} onChange={(e) => canvia('Data', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={etiqueta} htmlFor="exc-activitat">Activitat</label>
            <input id="exc-activitat" className={camp} value={d.Activitat} onChange={(e) => canvia('Activitat', e.target.value)} placeholder="La Castanyada amb panellets" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiqueta} htmlFor="exc-lloc">Lloc</label>
              <input id="exc-lloc" className={camp} value={d.Lloc} onChange={(e) => canvia('Lloc', e.target.value)} placeholder="Can Montcau" />
            </div>
            <div>
              <label className={etiqueta} htmlFor="exc-poblacio">Població</label>
              <input id="exc-poblacio" className={camp} value={d.Poblacio} onChange={(e) => canvia('Poblacio', e.target.value)} placeholder="La Roca del Vallès" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiqueta} htmlFor="exc-sortida">Hora de sortida</label>
              <input id="exc-sortida" className={camp} value={d.HoraSortida} onChange={(e) => canvia('HoraSortida', e.target.value)} placeholder="9:00" />
            </div>
            <div>
              <label className={etiqueta} htmlFor="exc-tornada">Hora de tornada</label>
              <input id="exc-tornada" className={camp} value={d.HoraTornada} onChange={(e) => canvia('HoraTornada', e.target.value)} placeholder="17:00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiqueta} htmlFor="exc-transport">Transport</label>
              <select id="exc-transport" className={camp} value={d.Transport} onChange={(e) => canvia('Transport', e.target.value as Transport)}>
                {TRANSPORTS.map((x) => <option key={x} value={x}>{TRANSPORT_LABELS[x]}</option>)}
              </select>
            </div>
            {d.Transport === 'altres' && (
              <div>
                <label className={etiqueta} htmlFor="exc-transport-detall">Com s’hi va</label>
                <input id="exc-transport-detall" className={camp} value={d.TransportDetall} onChange={(e) => canvia('TransportDetall', e.target.value)} placeholder="Metro, a peu…" />
              </div>
            )}
          </div>

          <fieldset>
            <legend className={etiqueta}>Grups i alumnes</legend>
            <div className="space-y-2">
              {d.Grups.map((g, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    className={camp}
                    aria-label={`Grup ${i + 1}`}
                    value={g.Grup}
                    onChange={(e) => canvia('Grups', d.Grups.map((x, j) => j === i ? { ...x, Grup: e.target.value } : x))}
                  >
                    <option value="">Tria un grup…</option>
                    {grupsTriables(grupsDisponibles, d.Grups.map((x) => x.Grup), g.Grup)
                      .map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                  <input
                    type="number"
                    min={0}
                    className="w-28 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                    aria-label={`Alumnes del grup ${i + 1}`}
                    value={g.AlumnesPrevistos}
                    onChange={(e) => canvia('Grups', d.Grups.map((x, j) => j === i ? { ...x, AlumnesPrevistos: Number(e.target.value) || 0 } : x))}
                  />
                  {d.Grups.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Treu el grup ${i + 1}`}
                      onClick={() => canvia('Grups', d.Grups.filter((_, j) => j !== i))}
                      className="px-2 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => canvia('Grups', [...d.Grups, { Grup: '', AlumnesPrevistos: 0 }])}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-primary"
            >
              <Plus size={13} /> Afegeix un grup
            </button>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiqueta} htmlFor="exc-responsable">Responsable el dia de la sortida</label>
              <select id="exc-responsable" className={camp} value={d.Responsable} onChange={(e) => canvia('Responsable', e.target.value)}>
                {usuaris.filter((u) => u.Rol !== 'convidat').map((u) => (
                  <option key={u.id} value={u.Email}>{u.Nom || u.Email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={etiqueta} htmlFor="exc-externs">Acompanyants externs</label>
              <input
                id="exc-externs" type="number" min={0} className={camp}
                value={d.AcompanyantsExterns}
                onChange={(e) => canvia('AcompanyantsExterns', Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <label className={etiqueta} htmlFor="exc-acompanyants">
              Acompanyants <span className="font-normal text-gray-400">(opcional: es poden posar més endavant)</span>
            </label>
            <select
              id="exc-acompanyants"
              multiple
              size={4}
              className={camp}
              value={d.Acompanyants}
              onChange={(e) => canvia('Acompanyants', Array.from(e.target.selectedOptions, (o) => o.value))}
            >
              {usuaris.filter((u) => u.Rol !== 'convidat').map((u) => (
                <option key={u.id} value={u.Email}>{u.Nom || u.Email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={etiqueta} htmlFor="exc-observacions">Observacions</label>
            <textarea id="exc-observacions" rows={2} className={camp} value={d.Observacions} onChange={(e) => canvia('Observacions', e.target.value)} />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {dataNoLectiva && <p className="text-xs text-red-600">Aquell dia no és lectiu.</p>}
          {falten.length > 0 && (
            <p className="text-xs text-amber-700">Per enviar-la falten: {falten.join(', ')}.</p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button type="button" onClick={onClose} disabled={desant} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel·la
          </button>
          <button
            type="button"
            onClick={() => desa(false)}
            disabled={desant}
            className="px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 disabled:opacity-50"
          >
            Desa l’esborrany
          </button>
          <button
            type="button"
            onClick={() => desa(true)}
            disabled={desant || !potEnviar}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#861414' }}
          >
            {desant && <Loader2 size={15} className="animate-spin" />}
            Envia la proposta
          </button>
        </div>
      </div>
    </div>
  )
}
