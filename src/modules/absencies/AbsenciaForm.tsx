import { useState, useMemo } from 'react'
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
    Motiu: '',
    Notes: '',
  })
  const [motiuAltre, setMotiuAltre] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof AbsenciaFormData>(k: K, v: AbsenciaFormData[K]) {
    setData((prev) => ({ ...prev, [k]: v }))
  }

  const hores = useMemo(() => calcularHores(data.HoraInici, data.HoraFi), [data.HoraInici, data.HoraFi])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data.Data) { setError('Cal indicar la data.'); return }
    if (!data.HoraInici || !data.HoraFi) { setError("Cal indicar l'hora d'inici i de fi."); return }
    if (hores <= 0) { setError("L'hora de fi ha de ser posterior a la d'inici."); return }
    const motiuFinal = data.Motiu === 'Altre' ? motiuAltre.trim() : data.Motiu
    if (!motiuFinal) { setError('Cal indicar el motiu.'); return }
    setError('')
    setSaving(true)
    try {
      await onDesar({ ...data, Motiu: motiuFinal })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desant l'absència")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={() => { if (!saving) onCancel() }} />
      <div className="relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-text-main">Nova absència</h2>
          <button onClick={() => { if (!saving) onCancel() }} disabled={saving} className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
            <input
              type="date"
              value={data.Data}
              onChange={(e) => set('Data', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          {hores > 0 && (
            <p className="text-xs text-gray-500">
              Total: <span className="font-semibold text-text-main">{hores.toString().replace('.', ',')} hores</span>
            </p>
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
