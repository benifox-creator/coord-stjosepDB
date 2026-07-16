import { useState } from 'react'
import { X, AlertCircle, Loader2, Plus, Infinity } from 'lucide-react'
import { formatDateISO } from './prestecs.utils'
import { serializeMaterial } from '../material/material.utils'
import type { PrestecFormData } from './types'
import type { ItemMaterial } from '../material/types'

type Errors = Partial<Record<keyof PrestecFormData | 'general', string>>

interface Props {
  onClose: () => void
  onGuardar: (data: PrestecFormData) => Promise<void>
  materialDisponible?: ItemMaterial[]
}

interface MatSeleccionat {
  ID: string
  Nom: string
  Quantitat: number
  Disponible: number
}

export function PrestecForm({ onClose, onGuardar, materialDisponible = [] }: Props) {
  const avui = formatDateISO(new Date())

  const [form, setForm] = useState<Omit<PrestecFormData, 'Material'>>({
    Dispositiu_ID: '',
    Dispositiu_Nom: '',
    Usuari: '',
    Email: '',
    Data_inici: avui,
    Data_fi_prevista: '',
    Notes: '',
  })
  const [tempsIllimitat, setTempsIllimitat] = useState(false)
  const [matSeleccionat, setMatSeleccionat] = useState<MatSeleccionat[]>([])
  const [afegintMat, setAfegintMat] = useState(false)
  const [nouMatID, setNouMatID] = useState('')
  const [nouMatQ, setNouMatQ] = useState(1)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  const matDisponiblePicker = materialDisponible.filter(
    (m) => m.Quantitat_disponible > 0 && !matSeleccionat.some((s) => s.ID === m.ID)
  )

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key as keyof Errors]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function handleAfegirMaterial() {
    if (!nouMatID) return
    const mat = materialDisponible.find((m) => m.ID === nouMatID)
    if (!mat) return
    const q = Math.min(Math.max(1, nouMatQ), mat.Quantitat_disponible)
    setMatSeleccionat((prev) => [...prev, { ID: mat.ID, Nom: mat.Nom, Quantitat: q, Disponible: mat.Quantitat_disponible }])
    setNouMatID('')
    setNouMatQ(1)
    setAfegintMat(false)
  }

  function handleTreuremat(id: string) {
    setMatSeleccionat((prev) => prev.filter((m) => m.ID !== id))
  }

  function validate(): boolean {
    const e: Errors = {}
    if (!form.Dispositiu_ID.trim() && matSeleccionat.length === 0) {
      e.Dispositiu_ID = 'Cal indicar un dispositiu o material a prestar.'
    }
    if (!form.Usuari.trim()) e.Usuari = "El nom de l'usuari és obligatori."
    if (!form.Data_inici) e.Data_inici = "La data d'inici és obligatòria."
    if (!tempsIllimitat) {
      if (!form.Data_fi_prevista) {
        e.Data_fi_prevista = 'La data de retorn prevista és obligatòria.'
      } else if (form.Data_inici && form.Data_fi_prevista < form.Data_inici) {
        e.Data_fi_prevista = "La data de retorn no pot ser anterior a la d'inici."
      }
    }
    if (form.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.Email)) {
      e.Email = 'Format de correu invàlid.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const data: PrestecFormData = {
        ...form,
        Data_fi_prevista: tempsIllimitat ? '' : form.Data_fi_prevista,
        Material: serializeMaterial(matSeleccionat),
      }
      await onGuardar(data)
      onClose()
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Error en guardar.' })
    } finally {
      setSaving(false)
    }
  }

  const maxNouMat = materialDisponible.find((m) => m.ID === nouMatID)?.Quantitat_disponible ?? 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-text-main">Nou préstec</h2>
            <p className="text-xs text-gray-400 mt-0.5">Els camps marcats amb * són obligatoris</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {errors.general && (
            <p className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={13} /> {errors.general}
            </p>
          )}

          {/* Dispositiu */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="ID Dispositiu" error={errors.Dispositiu_ID}>
              <input
                type="text"
                value={form.Dispositiu_ID}
                onChange={(e) => setField('Dispositiu_ID', e.target.value.toUpperCase())}
                placeholder="INV-001 (opcional)"
                className={cls(!!errors.Dispositiu_ID)}
                autoFocus
              />
            </FormField>
            <FormField label="Nom dispositiu">
              <input
                type="text"
                value={form.Dispositiu_Nom}
                onChange={(e) => setField('Dispositiu_Nom', e.target.value)}
                placeholder="Ex: MacBook Air M2"
                className={cls(false)}
              />
            </FormField>
          </div>

          {/* Usuari */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Usuari *" error={errors.Usuari}>
              <input
                type="text"
                value={form.Usuari}
                onChange={(e) => setField('Usuari', e.target.value)}
                placeholder="Nom i cognoms"
                className={cls(!!errors.Usuari)}
              />
            </FormField>
            <FormField label="Correu electrònic" error={errors.Email}>
              <input
                type="email"
                value={form.Email}
                onChange={(e) => setField('Email', e.target.value)}
                placeholder="usuari@stjosep.org"
                className={cls(!!errors.Email)}
              />
            </FormField>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Data d'inici *" error={errors.Data_inici}>
              <input
                type="date"
                value={form.Data_inici}
                onChange={(e) => setField('Data_inici', e.target.value)}
                className={cls(!!errors.Data_inici)}
              />
            </FormField>
            <FormField label={`Data retorn prev.${tempsIllimitat ? '' : ' *'}`} error={errors.Data_fi_prevista}>
              {tempsIllimitat ? (
                <div className="input flex items-center gap-2 text-blue-600 bg-blue-50 border-blue-200 cursor-default select-none">
                  <Infinity size={15} />
                  <span className="text-sm">Temps il·limitat</span>
                </div>
              ) : (
                <input
                  type="date"
                  value={form.Data_fi_prevista}
                  onChange={(e) => setField('Data_fi_prevista', e.target.value)}
                  min={form.Data_inici || undefined}
                  className={cls(!!errors.Data_fi_prevista)}
                />
              )}
            </FormField>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none -mt-1">
            <input
              type="checkbox"
              checked={tempsIllimitat}
              onChange={(e) => {
                setTempsIllimitat(e.target.checked)
                if (e.target.checked) setErrors((er) => ({ ...er, Data_fi_prevista: undefined }))
              }}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-sm text-gray-600 flex items-center gap-1.5">
              <Infinity size={14} className="text-blue-500" /> Préstec de temps il·limitat (sense data de retorn)
            </span>
          </label>

          {/* Material del préstec */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Material del préstec</p>
              {!afegintMat && matDisponiblePicker.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAfegintMat(true)}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus size={13} /> Afegir ítem
                </button>
              )}
            </div>

            {/* Ítems seleccionats */}
            {matSeleccionat.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {matSeleccionat.map((m) => (
                  <div key={m.ID} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-xs font-mono text-blue-700 mr-2">{m.ID}</span>
                      <span className="text-sm text-gray-700">{m.Nom}</span>
                      <span className="ml-2 text-sm font-semibold text-gray-800">× {m.Quantitat}</span>
                    </div>
                    <button type="button" onClick={() => handleTreuremat(m.ID)} className="text-gray-400 hover:text-red-500 transition-colors ml-2">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Picker nou ítem */}
            {afegintMat && (
              <div className="flex gap-2 items-start mt-1">
                <div className="flex-1">
                  <select
                    value={nouMatID}
                    onChange={(e) => { setNouMatID(e.target.value); setNouMatQ(1) }}
                    className="input text-sm w-full"
                    autoFocus
                  >
                    <option value="">Selecciona material...</option>
                    {matDisponiblePicker.map((m) => (
                      <option key={m.ID} value={m.ID}>
                        {m.Nom} (disp: {m.Quantitat_disponible})
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="number"
                  min={1}
                  max={maxNouMat}
                  value={nouMatQ}
                  onChange={(e) => setNouMatQ(Math.min(parseInt(e.target.value, 10) || 1, maxNouMat))}
                  className="input text-sm w-20"
                />
                <button
                  type="button"
                  onClick={handleAfegirMaterial}
                  disabled={!nouMatID}
                  className="px-3 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-40 shrink-0"
                  style={{ backgroundColor: '#861414' }}
                >
                  Afegir
                </button>
                <button type="button" onClick={() => setAfegintMat(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <X size={15} />
                </button>
              </div>
            )}

            {materialDisponible.length === 0 && (
              <p className="text-xs text-gray-400 italic">No hi ha material disponible al sistema.</p>
            )}
          </div>

          {/* Notes */}
          <FormField label="Notes">
            <textarea
              value={form.Notes}
              onChange={(e) => setField('Notes', e.target.value)}
              placeholder="Motiu del préstec, condicions especials..."
              rows={2}
              className={`${cls(false)} resize-none`}
            />
          </FormField>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel·lar
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#861414' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Guardant...' : 'Registrar préstec'}
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
