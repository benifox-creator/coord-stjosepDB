import { useHoraris } from '../horaris/useHoraris'
import { diaSetmanaDeData } from '../horaris/horaris.utils'
import { schoolYear, slotMinutes } from '../../utils/schoolCalendar'
import { useAuthStore } from '../../store/authStore'
import { duradaPeriodes } from './absencies.utils'
import { useState, useMemo, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { AbsenciaFormData } from './types'
import { calcularHores } from './absencies.utils'
import { formatDateISO } from '../substitucions/substitucions.utils'
import { useConfigStore } from '../../store/configStore'

interface Props {
  onDesar: (data: AbsenciaFormData) => Promise<void>
  onCancel: () => void
}

export function AbsenciaForm({ onDesar, onCancel }: Props) {
  const avui = formatDateISO(new Date())
  const motius = useConfigStore((s) => s.getValues('absencies.motius'))

  const [data, setData] = useState<AbsenciaFormData>({
    Data: avui,
    HoraInici: '',
    HoraFi: '',
    HoresNoLectives: 0,
    Motiu: '',
    Notes: '',
  })
  const [requestId] = useState(() => crypto.randomUUID())
  const { horaris, load, loading: loadingHoraris, error: errorHoraris } = useHoraris()
  const email = (useAuthStore(s => s.user?.email) ?? '').toLowerCase()
  const [manual, setManual] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const year = schoolYear(new Date(data.Data + 'T12:00:00'))
  useEffect(() => { void load(year) }, [load, year])
  const holidays = useConfigStore(s => s.getValues('centre.dies-no-lectius'))
  const available = horaris.filter(h => h.Professor === email && h.DiaSetmana === diaSetmanaDeData(data.Data)
    && h.VigentDesde <= data.Data && h.VigentFins >= data.Data && !holidays.includes(data.Data))
    .sort((a,b) => slotMinutes(a.Franja)[0] - slotMinutes(b.Franja)[0])
  const usePeriods = !manual && available.length > 0
  const selected = available.filter(h => selectedIds.includes(h.id)).map(h => ({ ...h, HorariId: h.id }))
  const calculated = usePeriods && selected.length ? {
    HoraInici: selected[0].Franja.split('-')[0], HoraFi: selected[selected.length-1].Franja.split('-')[1],
    HoresNoLectives: duradaPeriodes(selected, 'No lectiva'),
  } : data
  const [teHoresNoLectives, setTeHoresNoLectives] = useState(false)
  const [motiuAltre, setMotiuAltre] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof AbsenciaFormData>(k: K, v: AbsenciaFormData[K]) {
    setData((prev) => ({ ...prev, [k]: v }))
  }

  const manualHours = useMemo(() => calcularHores(data.HoraInici, data.HoraFi), [data.HoraInici, data.HoraFi])
  const hores = usePeriods ? duradaPeriodes(selected) : manualHours

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data.Data) { setError('Cal indicar la data.'); return }
    if (usePeriods && !selected.length) { setError('Selecciona almenys un període.'); return }
    if (!manual && (loadingHoraris || errorHoraris)) { setError('Revisa la càrrega de l’horari o tria l’entrada manual.'); return }
    if (!calculated.HoraInici || !calculated.HoraFi) { setError("Cal indicar l'hora d'inici i de fi."); return }
    if (hores <= 0) { setError("L'hora de fi ha de ser posterior a la d'inici."); return }
    if (!usePeriods && teHoresNoLectives && (data.HoresNoLectives < 0 || data.HoresNoLectives > hores)) {
      setError("Les hores no lectives no poden ser negatives ni superar el total d'hores.")
      return
    }
    const motiuFinal = data.Motiu === 'Altre' ? motiuAltre.trim() : data.Motiu
    if (!motiuFinal) { setError('Cal indicar el motiu.'); return }
    setError('')
    setSaving(true)
    try {
      await onDesar({ ...data, ...calculated, RequestId: requestId, Periodes: usePeriods ? selected : undefined, HoresNoLectives: usePeriods ? calculated.HoresNoLectives : teHoresNoLectives ? data.HoresNoLectives : 0, Motiu: motiuFinal })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desant l'absència")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={() => { if (!saving) onCancel() }} />
      <div role="dialog" aria-modal="true" aria-label="Nova absència" className="relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-text-main">Nova absència</h2>
          <button aria-label="Tanca el formulari" onClick={() => { if (!saving) onCancel() }} disabled={saving} className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
            <input
              aria-label="Data de l’absència" type="date"
              value={data.Data}
              onChange={(e) => { if (e.target.value) { set('Data', e.target.value); setSelectedIds([]) } }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <label className="flex gap-2 text-sm"><input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)} />Entrada manual / absència parcial</label>
          {loadingHoraris && <p role="status" className="text-sm">Carregant horari…</p>}
          {errorHoraris && <p role="alert" className="text-sm text-red-600">{errorHoraris}</p>}
          {usePeriods && <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Períodes afectats</legend>{available.map(h => <label key={h.id} className="flex gap-2 rounded border p-3 text-sm"><input type="checkbox" checked={selectedIds.includes(h.id)} onChange={e => setSelectedIds(ids => e.target.checked ? [...ids,h.id] : ids.filter(id => id !== h.id))} /><span>{h.Franja} · {h.Grup} {h.Materia}<span className="block text-xs text-gray-500">{h.Tipus} · {h.NecessitaCobertura ? 'Cal cobertura' : 'Sense cobertura'}</span></span></label>)}</fieldset>}
          {!usePeriods && <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hora d'inici</label>
              <input
                type="time"
                value={data.HoraInici}
                onChange={(e) => set('HoraInici', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hora de fi</label>
              <input
                type="time"
                value={data.HoraFi}
                onChange={(e) => set('HoraFi', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          }
          {hores > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Total: <span className="font-semibold text-text-main">{hores.toString().replace('.', ',')} hores</span>
              </p>
              {!usePeriods && <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={teHoresNoLectives}
                  onChange={(e) => {
                    setTeHoresNoLectives(e.target.checked)
                    if (!e.target.checked) set('HoresNoLectives', 0)
                  }}
                  className="rounded border-gray-300 text-primary focus:ring-primary/30"
                />
                Alguna d'aquestes hores no és lectiva
              </label>}
              {!usePeriods && teHoresNoLectives && (
                <div className="flex items-center gap-2 pl-6">
                  <input
                    type="number"
                    min={0}
                    max={hores}
                    step={0.5}
                    value={data.HoresNoLectives || ''}
                    onChange={(e) => set('HoresNoLectives', Number(e.target.value))}
                    placeholder="0"
                    className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-xs text-gray-500">hores no lectives (de {hores.toString().replace('.', ',')} totals)</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Motiu</label>
            <select
              value={data.Motiu}
              onChange={(e) => set('Motiu', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Selecciona un motiu…</option>
              {motius.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {data.Motiu === 'Altre' && (
              <input
                type="text"
                value={motiuAltre}
                onChange={(e) => setMotiuAltre(e.target.value)}
                placeholder="Especifica el motiu"
                className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tasques a realitzar (opcional)</label>
            <textarea
              value={data.Notes}
              onChange={(e) => set('Notes', e.target.value)}
              rows={3}
              placeholder="Indica els exercicis o tasques que ha de fer cada classe durant la teva absència. Si afecta diverses classes, pots separar-ho per grups."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>

        <div className="px-5 py-4 border-t border-gray-200 shrink-0 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel·la
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60"
            style={{ backgroundColor: '#861414' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Reporta l'absència
          </button>
        </div>
      </div>
    </div>
  )
}
