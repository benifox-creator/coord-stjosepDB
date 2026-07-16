import { useState } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'
import { formatDateISO } from './reserves.utils'
import type { ReservaFormData } from './types'
import { useConfigStore } from '../../store/configStore'
import { useAuthStore } from '../../store/authStore'
import { useUsuarisStore, potEliminar } from '../../store/usuarisStore'

type Errors = Partial<Record<keyof ReservaFormData | 'general', string>>

interface Props {
  onClose: () => void
  onGuardar: (data: ReservaFormData) => Promise<void>
  inicial?: ReservaFormData
}

export function ReservaForm({ onClose, onGuardar, inicial }: Props) {
  const espais = useConfigStore((s) => s.getValues('reserves.espais'))
  const user = useAuthStore((s) => s.user)
  const rol = useUsuarisStore((s) => s.rol)
  const esCoordinador = potEliminar(rol)
  const avui = formatDateISO(new Date())

  const [form, setForm] = useState<ReservaFormData>({
    Espai: inicial?.Espai ?? '',
    Usuari: inicial?.Usuari ?? user?.displayName ?? '',
    Email: inicial?.Email ?? user?.email ?? '',
    Data: inicial?.Data ?? avui,
    Hora_inici: inicial?.Hora_inici ?? '',
    Hora_fi: inicial?.Hora_fi ?? '',
    Motiu: inicial?.Motiu ?? '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  function setField<K extends keyof ReservaFormData>(key: K, value: ReservaFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const e: Errors = {}
    if (!form.Espai) e.Espai = "Cal seleccionar un espai."
    if (!form.Usuari.trim()) e.Usuari = "El nom de l'usuari és obligatori."
    if (!form.Data) e.Data = "La data és obligatòria."
    if (!form.Hora_inici) e.Hora_inici = "L'hora d'inici és obligatòria."
    if (!form.Hora_fi) e.Hora_fi = "L'hora de fi és obligatòria."
    if (form.Hora_inici && form.Hora_fi && form.Hora_fi <= form.Hora_inici) {
      e.Hora_fi = "L'hora de fi ha de ser posterior a la d'inici."
    }
    if (!form.Motiu.trim()) e.Motiu = "El motiu és obligatori."
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
      await onGuardar(form)
      onClose()
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Error en guardar.' })
    } finally {
      setSaving(false)
    }
  }

  const esEdicio = !!inicial

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-text-main">{esEdicio ? 'Editar reserva' : 'Nova reserva'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {!esEdicio && esCoordinador
                ? 'La reserva es confirmarà automàticament'
                : !esEdicio
                ? 'El coordinador rebrà un avís per confirmar-la'
                : 'Els camps marcats amb * són obligatoris'}
            </p>
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

          {/* Espai */}
          <FormField label="Espai *" error={errors.Espai}>
            <select
              value={form.Espai}
              onChange={(e) => setField('Espai', e.target.value)}
              className={cls(!!errors.Espai)}
              autoFocus
            >
              <option value="">Selecciona un espai...</option>
              {espais.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </FormField>

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

          {/* Data */}
          <FormField label="Data *" error={errors.Data}>
            <input
              type="date"
              value={form.Data}
              onChange={(e) => setField('Data', e.target.value)}
              className={cls(!!errors.Data)}
            />
          </FormField>

          {/* Hores */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Hora d'inici *" error={errors.Hora_inici}>
              <input
                type="time"
                value={form.Hora_inici}
                onChange={(e) => setField('Hora_inici', e.target.value)}
                className={cls(!!errors.Hora_inici)}
              />
            </FormField>
            <FormField label="Hora de fi *" error={errors.Hora_fi}>
              <input
                type="time"
                value={form.Hora_fi}
                onChange={(e) => setField('Hora_fi', e.target.value)}
                min={form.Hora_inici || undefined}
                className={cls(!!errors.Hora_fi)}
              />
            </FormField>
          </div>

          {/* Motiu */}
          <FormField label="Motiu *" error={errors.Motiu}>
            <textarea
              value={form.Motiu}
              onChange={(e) => setField('Motiu', e.target.value)}
              placeholder="Descriu el motiu de la reserva..."
              rows={3}
              className={`${cls(!!errors.Motiu)} resize-none`}
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
            {saving ? 'Guardant...' : esEdicio ? 'Desar canvis' : 'Registrar reserva'}
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
