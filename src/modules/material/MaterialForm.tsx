import { useState } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'
import type { MaterialFormData } from './types'
import { useConfigStore } from '../../store/configStore'

type Errors = Partial<Record<keyof MaterialFormData, string>>

interface Props {
  onClose: () => void
  onGuardar: (data: MaterialFormData) => Promise<void>
  inicial?: Partial<MaterialFormData>
}

export function MaterialForm({ onClose, onGuardar, inicial }: Props) {
  const categories = useConfigStore((s) => s.getValues('material.categories'))
  const [form, setForm] = useState<MaterialFormData>({
    Nom: inicial?.Nom ?? '',
    Categoria: inicial?.Categoria ?? '' as MaterialFormData['Categoria'],
    Descripció: inicial?.Descripció ?? '',
    Quantitat_total: inicial?.Quantitat_total ?? 1,
    Ubicació: inicial?.Ubicació ?? '',
    Notes: inicial?.Notes ?? '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  function setField<K extends keyof MaterialFormData>(key: K, value: MaterialFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const e: Errors = {}
    if (!form.Nom.trim()) e.Nom = 'El nom és obligatori.'
    if (!form.Categoria) e.Categoria = 'La categoria és obligatòria.'
    if (!form.Quantitat_total || form.Quantitat_total < 1) e.Quantitat_total = 'La quantitat ha de ser ≥ 1.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await onGuardar(form)
      onClose()
    } catch (err) {
      setErrors({ Nom: err instanceof Error ? err.message : 'Error en guardar.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-text-main">
              {inicial ? 'Editar material' : 'Nou material'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Els camps marcats amb * són obligatoris</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          <FormField label="Nom *" error={errors.Nom}>
            <input
              type="text"
              value={form.Nom}
              onChange={(e) => setField('Nom', e.target.value)}
              placeholder="Ex: Cable HDMI 2m"
              className={cls(!!errors.Nom)}
              autoFocus
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Categoria *" error={errors.Categoria}>
              <select
                value={form.Categoria}
                onChange={(e) => setField('Categoria', e.target.value as MaterialFormData['Categoria'])}
                className={cls(!!errors.Categoria)}
              >
                <option value="">Selecciona...</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Quantitat total *" error={errors.Quantitat_total}>
              <input
                type="number"
                min={1}
                value={form.Quantitat_total}
                onChange={(e) => setField('Quantitat_total', parseInt(e.target.value, 10) || 0)}
                className={cls(!!errors.Quantitat_total)}
              />
            </FormField>
          </div>

          <FormField label="Descripció">
            <input
              type="text"
              value={form.Descripció}
              onChange={(e) => setField('Descripció', e.target.value)}
              placeholder="Descripció breu de l'ítem"
              className={cls(false)}
            />
          </FormField>

          <FormField label="Ubicació">
            <input
              type="text"
              value={form.Ubicació}
              onChange={(e) => setField('Ubicació', e.target.value)}
              placeholder="Ex: Armari TIC, Calaix Coordinació..."
              className={cls(false)}
            />
          </FormField>

          <FormField label="Notes">
            <textarea
              value={form.Notes}
              onChange={(e) => setField('Notes', e.target.value)}
              placeholder="Observacions addicionals..."
              rows={2}
              className={`${cls(false)} resize-none`}
            />
          </FormField>

          {inicial && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Modificar la quantitat total ajustarà el disponible proporcionalment, conservant les unitats en préstec.
            </p>
          )}
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel·lar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#861414' }}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Guardant...' : inicial ? 'Desar canvis' : 'Afegir material'}
          </button>
        </div>
      </div>
    </div>
  )
}

function cls(hasError: boolean) {
  return `input ${hasError ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : ''}`
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-600">{label}</label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  )
}
