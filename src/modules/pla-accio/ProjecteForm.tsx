import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useConfigStore } from '../../store/configStore'
import type { Projecte, ProjecteFormData, EstatProjecte } from './types'

const ESTATS: EstatProjecte[] = ['Actiu', 'Completat', 'Arxivat']

interface Props {
  projecte?: Projecte | null
  onClose: () => void
  onGuardar: (data: ProjecteFormData) => Promise<void>
}

export function ProjecteForm({ projecte, onClose, onGuardar }: Props) {
  const categories = useConfigStore((s) => s.getValues('pla-accio.categories'))

  const [form, setForm] = useState<ProjecteFormData>({
    Nom: projecte?.Nom ?? '',
    Descripcio: projecte?.Descripcio ?? '',
    Categoria: projecte?.Categoria ?? '',
    Estat: projecte?.Estat ?? 'Actiu',
    Responsable: projecte?.Responsable ?? '',
    Data_inici: projecte?.Data_inici ?? '',
    Data_fi_prevista: projecte?.Data_fi_prevista ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(key: keyof ProjecteFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.Nom.trim()) { setError('El nom és obligatori.'); return }
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-text-main">
            {projecte ? 'Editar projecte' : 'Nou projecte'}
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
            <label className="label">Nom del projecte *</label>
            <input
              className="input"
              value={form.Nom}
              onChange={(e) => update('Nom', e.target.value)}
              placeholder="Renovació equipament aules..."
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
              placeholder="Descripció opcional..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select className="input" value={form.Categoria} onChange={(e) => update('Categoria', e.target.value)}>
                <option value="">Sense categoria</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estat</label>
              <select
                className="input"
                value={form.Estat}
                onChange={(e) => update('Estat', e.target.value as EstatProjecte)}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data inici</label>
              <input
                type="date"
                className="input"
                value={form.Data_inici}
                onChange={(e) => update('Data_inici', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Data fi prevista</label>
              <input
                type="date"
                className="input"
                value={form.Data_fi_prevista}
                onChange={(e) => update('Data_fi_prevista', e.target.value)}
              />
            </div>
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
              {projecte ? 'Desar canvis' : 'Crear projecte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
