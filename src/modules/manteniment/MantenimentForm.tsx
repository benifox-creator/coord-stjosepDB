import { useState } from 'react'
import { X, Loader2, Wrench } from 'lucide-react'
import type { MantenimentFormData, CategoriaManteniment, PrioritatManteniment } from './types'
import { CATEGORIES_MANTENIMENT } from './manteniment.utils'

const PRIORITATS: PrioritatManteniment[] = ['Urgent', 'Normal', 'Baixa']

interface Props {
  onClose: () => void
  onGuardar: (data: MantenimentFormData) => Promise<void>
}

export function MantenimentForm({ onClose, onGuardar }: Props) {
  const [form, setForm] = useState<MantenimentFormData>({
    Titol: '',
    Categoria: 'Altres',
    Localitzacio: '',
    Descripcio: '',
    Prioritat: 'Normal',
    Notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof MantenimentFormData>(key: K, value: MantenimentFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.Titol.trim()) { setError('El títol és obligatori.'); return }
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
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#861414' }}>
            <Wrench size={15} className="text-white" />
          </div>
          <h2 className="text-base font-semibold text-text-main">Reportar desperfecte</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[78vh] overflow-y-auto">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div>
            <label className="label">Descripció breu *</label>
            <input
              className="input"
              value={form.Titol}
              onChange={(e) => update('Titol', e.target.value)}
              placeholder="Ex: Persiana trencada, porta que no tanca..."
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select
                className="input"
                value={form.Categoria}
                onChange={(e) => update('Categoria', e.target.value as CategoriaManteniment)}
              >
                {CATEGORIES_MANTENIMENT.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prioritat</label>
              <select
                className="input"
                value={form.Prioritat}
                onChange={(e) => update('Prioritat', e.target.value as PrioritatManteniment)}
              >
                {PRIORITATS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Localització</label>
            <input
              className="input"
              value={form.Localitzacio}
              onChange={(e) => update('Localitzacio', e.target.value)}
              placeholder="Ex: Aula 3A, Passadís planta 1, Biblioteca..."
            />
          </div>

          <div>
            <label className="label">Descripció detallada</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={form.Descripcio}
              onChange={(e) => update('Descripcio', e.target.value)}
              placeholder="Explica el problema amb el màxim detall possible..."
            />
          </div>

          <div>
            <label className="label">Notes addicionals</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.Notes}
              onChange={(e) => update('Notes', e.target.value)}
              placeholder="Qualsevol informació addicional rellevant..."
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
              {saving ? 'Enviant...' : 'Enviar report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
