import { useState } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'
import type { MaterialInfantilFormData, ProveidorInfantil } from './types'
import { UNITATS_MATERIAL_INFANTIL, COMANDA_HABITUAL_VALORS } from './types'
import { useConfigStore } from '../../store/configStore'

type Errors = Partial<Record<keyof MaterialInfantilFormData, string>>

interface Props {
  proveidors: ProveidorInfantil[]
  onClose: () => void
  onGuardar: (data: MaterialInfantilFormData) => Promise<void>
  inicial?: MaterialInfantilFormData
}

export function MaterialInfantilForm({ proveidors, onClose, onGuardar, inicial }: Props) {
  const categories = useConfigStore((s) => s.getValues('material-infantil.categories'))
  const [form, setForm] = useState<MaterialInfantilFormData>({
    Nom: inicial?.Nom ?? '',
    Categoria: inicial?.Categoria ?? 'Altres',
    Unitat: inicial?.Unitat ?? 'unitat',
    ProveidorId: inicial?.ProveidorId ?? null,
    PreuUnitari: inicial?.PreuUnitari ?? 0,
    UnitatsPerAlumne: inicial?.UnitatsPerAlumne ?? 1,
    ComandaHabitual: inicial?.ComandaHabitual ?? 'Sí',
    RecompteManual: inicial?.RecompteManual ?? 0,
    EntradesRebudes: inicial?.EntradesRebudes ?? 0,
    ConsumManual: inicial?.ConsumManual ?? 0,
    Notes: inicial?.Notes ?? '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  function setField<K extends keyof MaterialInfantilFormData>(key: K, value: MaterialInfantilFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const e: Errors = {}
    if (!form.Nom.trim()) e.Nom = 'El nom és obligatori.'
    if (form.PreuUnitari < 0) e.PreuUnitari = 'El preu no pot ser negatiu.'
    if (form.UnitatsPerAlumne < 0) e.UnitatsPerAlumne = 'No pot ser negatiu.'
    if (form.RecompteManual < 0 || form.EntradesRebudes < 0 || form.ConsumManual < 0) {
      e.RecompteManual = 'Els camps d\'estoc no poden ser negatius.'
    }
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-text-main">{inicial ? 'Editar material' : 'Nou material'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Nom *</label>
            <input
              type="text"
              value={form.Nom}
              onChange={(e) => setField('Nom', e.target.value)}
              autoFocus
              className={`input ${errors.Nom ? 'border-red-400' : ''}`}
            />
            {errors.Nom && (
              <p className="flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12} /> {errors.Nom}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Categoria</label>
              <select
                value={form.Categoria}
                onChange={(e) => setField('Categoria', e.target.value as MaterialInfantilFormData['Categoria'])}
                className="input"
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Unitat</label>
              <select
                value={form.Unitat}
                onChange={(e) => setField('Unitat', e.target.value as MaterialInfantilFormData['Unitat'])}
                className="input"
              >
                {UNITATS_MATERIAL_INFANTIL.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Proveïdor preferent</label>
            <select
              value={form.ProveidorId ?? ''}
              onChange={(e) => setField('ProveidorId', e.target.value || null)}
              className="input"
            >
              <option value="">Sense proveïdor</option>
              {proveidors.map((p) => <option key={p.id} value={p.id}>{p.Nom}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Preu unitari (€)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.PreuUnitari}
                onChange={(e) => setField('PreuUnitari', Number(e.target.value))}
                className={`input ${errors.PreuUnitari ? 'border-red-400' : ''}`}
              />
              {errors.PreuUnitari && <p className="text-xs text-red-600">{errors.PreuUnitari}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Unitats / alumne</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.UnitatsPerAlumne}
                onChange={(e) => setField('UnitatsPerAlumne', Number(e.target.value))}
                className={`input ${errors.UnitatsPerAlumne ? 'border-red-400' : ''}`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Comanda habitual</label>
            <select
              value={form.ComandaHabitual}
              onChange={(e) => setField('ComandaHabitual', e.target.value as MaterialInfantilFormData['ComandaHabitual'])}
              className="input"
            >
              {COMANDA_HABITUAL_VALORS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Estoc</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500">Recompte manual</label>
                <input
                  type="number"
                  min={0}
                  value={form.RecompteManual}
                  onChange={(e) => setField('RecompteManual', Number(e.target.value))}
                  className="input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500">Entrades rebudes</label>
                <input
                  type="number"
                  min={0}
                  value={form.EntradesRebudes}
                  onChange={(e) => setField('EntradesRebudes', Number(e.target.value))}
                  className="input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500">Consum manual</label>
                <input
                  type="number"
                  min={0}
                  value={form.ConsumManual}
                  onChange={(e) => setField('ConsumManual', Number(e.target.value))}
                  className="input"
                />
              </div>
            </div>
            {errors.RecompteManual && (
              <p className="flex items-center gap-1 text-xs text-red-600 mt-1.5"><AlertCircle size={12} /> {errors.RecompteManual}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Notes</label>
            <textarea value={form.Notes} onChange={(e) => setField('Notes', e.target.value)} rows={2} className="input resize-none" />
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel·la
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#861414' }}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {inicial ? 'Desar canvis' : 'Afegir material'}
          </button>
        </div>
      </div>
    </div>
  )
}
