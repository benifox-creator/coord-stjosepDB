import { useState } from 'react'
import { X, Loader2, Trash2 } from 'lucide-react'
import type { DiaSetmana, Horari, HorariFormData, TipusPeriode } from './types'
import type { EtapaSubstitucio } from '../substitucions/types'
import { useConfigStore } from '../../store/configStore'

interface Props {
  diaSetmana: DiaSetmana
  etapa: EtapaSubstitucio
  franja: string
  horariExistent: Horari | null
  onDesar: (data: HorariFormData) => Promise<void>
  onEliminar: () => Promise<void>
  onCancel: () => void
}

export function HorariSlotForm({ diaSetmana, etapa, franja, horariExistent, onDesar, onEliminar, onCancel }: Props) {
  const tipusNoLectiva = useConfigStore((s) => s.getValues('horaris.tipus-no-lectiva'))

  const [tipus, setTipus] = useState<TipusPeriode>(horariExistent?.Tipus ?? 'Lectiva')
  const [grup, setGrup] = useState(horariExistent?.Grup ?? '')
  const [materia, setMateria] = useState(horariExistent?.Materia ?? (tipusNoLectiva[0] ?? ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (tipus === 'Lectiva' && (!grup.trim() || !materia.trim())) {
      setError('Cal indicar el grup i la matèria.')
      return
    }
    if (tipus === 'No lectiva' && !materia.trim()) {
      setError('Cal indicar el tipus de no lectiva.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await onDesar({
        DiaSetmana: diaSetmana, Etapa: etapa, Franja: franja, Tipus: tipus,
        Grup: tipus === 'Lectiva' ? grup.trim() : '',
        Materia: materia.trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desant el període')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={() => { if (!saving) onCancel() }} />
      <div className="relative z-10 w-full max-w-sm bg-white shadow-2xl rounded-lg flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-text-main">{diaSetmana} · {franja}</h2>
          <button onClick={() => { if (!saving) onCancel() }} disabled={saving} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="radio" name="tipus" checked={tipus === 'Lectiva'} onChange={() => setTipus('Lectiva')} />
              Lectiva
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="radio" name="tipus" checked={tipus === 'No lectiva'} onChange={() => setTipus('No lectiva')} />
              No lectiva
            </label>
          </div>

          {tipus === 'Lectiva' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Grup</label>
                <input
                  type="text" value={grup} onChange={(e) => setGrup(e.target.value)}
                  placeholder="p.ex. EP-3r A"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Matèria</label>
                <input
                  type="text" value={materia} onChange={(e) => setMateria(e.target.value)}
                  placeholder="p.ex. Matemàtiques"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipus de no lectiva</label>
              <select
                value={materia} onChange={(e) => setMateria(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {tipusNoLectiva.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>

        <div className="px-5 py-4 border-t border-gray-200 flex gap-2">
          {horariExistent && (
            <button
              type="button"
              onClick={async () => { setSaving(true); await onEliminar() }}
              disabled={saving}
              className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            type="button" onClick={onCancel} disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel·la
          </button>
          <button
            onClick={handleSubmit} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60"
            style={{ backgroundColor: '#861414' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Desa
          </button>
        </div>
      </div>
    </div>
  )
}
