import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { Tasca, Projecte, TascaFormData, EstatTasca, PrioritatTasca } from './types'

const PRIORITATS: PrioritatTasca[] = ['Alta', 'Mitjana', 'Baixa']
const ESTATS: EstatTasca[] = ['Pendent', 'En curs', 'Completada', 'Bloquejada']

interface Props {
  tasca?: Tasca | null
  projectes: Projecte[]
  defaultProjecteId?: string
  onClose: () => void
  onGuardar: (data: TascaFormData) => Promise<void>
}

export function TascaForm({ tasca, projectes, defaultProjecteId, onClose, onGuardar }: Props) {
  const [form, setForm] = useState<TascaFormData>({
    Projecte_ID: tasca?.Projecte_ID ?? defaultProjecteId ?? projectes[0]?.ID ?? '',
    Titol: tasca?.Titol ?? '',
    Descripcio: tasca?.Descripcio ?? '',
    Estat: tasca?.Estat ?? 'Pendent',
    Prioritat: tasca?.Prioritat ?? 'Mitjana',
    Responsable: tasca?.Responsable ?? '',
    Data_limit: tasca?.Data_limit ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(key: keyof TascaFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.Titol.trim()) { setError('El títol és obligatori.'); return }
    if (!form.Projecte_ID) { setError('Cal seleccionar un projecte.'); return }
    setSaving(true)
    setError(null)
    try {
      await onGuardar(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en desar')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-text-main">
            {tasca ? 'Editar tasca' : 'Nova tasca'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div>
            <label className="label">Projecte *</label>
            <select
              className="input"
              value={form.Projecte_ID}
              onChange={(e) => update('Projecte_ID', e.target.value)}
            >
              <option value="">Selecciona un projecte</option>
              {projectes.map((p) => (
                <option key={p.ID} value={p.ID}>{p.Nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Títol *</label>
            <input
              className="input"
              value={form.Titol}
              onChange={(e) => update('Titol', e.target.value)}
              placeholder="Descripció breu de la tasca..."
              autoFocus
            />
          </div>

          <div>
            <label className="label">Descripció</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.Descripcio}
              onChange={(e) => update('Descripcio', e.target.value)}
              placeholder="Detalls opcionals..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prioritat</label>
              <select
                className="input"
                value={form.Prioritat}
                onChange={(e) => update('Prioritat', e.target.value as PrioritatTasca)}
              >
                {PRIORITATS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estat</label>
              <select
                className="input"
                value={form.Estat}
                onChange={(e) => update('Estat', e.target.value as EstatTasca)}
              >
                {ESTATS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Responsable</label>
            <input
              className="input"
              value={form.Responsable}
              onChange={(e) => update('Responsable', e.target.value)}
              placeholder="nom@stjosep.org"
            />
          </div>

          <div>
            <label className="label">Data límit</label>
            <input
              type="date"
              className="input"
              value={form.Data_limit}
              onChange={(e) => update('Data_limit', e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel·lar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#861414' }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {tasca ? 'Desar canvis' : 'Crear tasca'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
