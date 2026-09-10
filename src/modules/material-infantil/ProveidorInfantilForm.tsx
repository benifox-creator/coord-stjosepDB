import { useState } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'
import type { ProveidorInfantilFormData } from './types'

type Errors = Partial<Record<keyof ProveidorInfantilFormData, string>>

interface Props {
  onClose: () => void
  onGuardar: (data: ProveidorInfantilFormData) => Promise<void>
  inicial?: ProveidorInfantilFormData
}

export function ProveidorInfantilForm({ onClose, onGuardar, inicial }: Props) {
  const [form, setForm] = useState<ProveidorInfantilFormData>({
    Nom: inicial?.Nom ?? '',
    Contacte: inicial?.Contacte ?? '',
    Email: inicial?.Email ?? '',
    Telefon: inicial?.Telefon ?? '',
    Web: inicial?.Web ?? '',
    TerminiLliurament: inicial?.TerminiLliurament ?? '',
    Notes: inicial?.Notes ?? '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  function setField<K extends keyof ProveidorInfantilFormData>(key: K, value: ProveidorInfantilFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const e: Errors = {}
    if (!form.Nom.trim()) e.Nom = 'El nom és obligatori.'
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
          <h2 className="font-semibold text-text-main">{inicial ? 'Editar proveïdor' : 'Nou proveïdor'}</h2>
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
              <label className="text-sm font-medium text-gray-600">Contacte</label>
              <input type="text" value={form.Contacte} onChange={(e) => setField('Contacte', e.target.value)} className="input" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Telèfon</label>
              <input type="text" value={form.Telefon} onChange={(e) => setField('Telefon', e.target.value)} className="input" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Email</label>
            <input type="email" value={form.Email} onChange={(e) => setField('Email', e.target.value)} className="input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Web</label>
              <input type="text" value={form.Web} onChange={(e) => setField('Web', e.target.value)} className="input" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Termini lliurament</label>
              <input
                type="text"
                value={form.TerminiLliurament}
                onChange={(e) => setField('TerminiLliurament', e.target.value)}
                placeholder="Ex: 2-5 dies"
                className="input"
              />
            </div>
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
            {inicial ? 'Desar canvis' : 'Afegir proveïdor'}
          </button>
        </div>
      </div>
    </div>
  )
}
