import { useState } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'
import type { ItemInventariFormData, EstatInventari } from './types'
import { useConfigStore } from '../../store/configStore'
const ESTATS: EstatInventari[] = ['Actiu', 'En reparació', 'En préstec', 'De baixa']

type Errors = Partial<Record<keyof ItemInventariFormData, string>>

const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/
const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/

interface Props {
  onClose: () => void
  onGuardar: (data: ItemInventariFormData) => Promise<void>
  inicial?: Partial<ItemInventariFormData>
}

export function InventariForm({ onClose, onGuardar, inicial }: Props) {
  const categories = useConfigStore((s) => s.getValues('inventari.categories'))
  const [form, setForm] = useState<ItemInventariFormData>({
    Nom: inicial?.Nom ?? '',
    Categoria: inicial?.Categoria ?? '' as ItemInventariFormData['Categoria'],
    Marca: inicial?.Marca ?? '',
    Model: inicial?.Model ?? '',
    'Núm_sèrie': inicial?.['Núm_sèrie'] ?? '',
    Ubicació: inicial?.Ubicació ?? '',
    Estat: inicial?.Estat ?? 'Actiu',
    Data_compra: inicial?.Data_compra ?? '',
    Garantia_fins: inicial?.Garantia_fins ?? '',
    MAC_LAN: inicial?.MAC_LAN ?? '',
    MAC_WAN: inicial?.MAC_WAN ?? '',
    IP_LAN: inicial?.IP_LAN ?? '',
    IP_WAN: inicial?.IP_WAN ?? '',
    Notes: inicial?.Notes ?? '',
  })

  const [categoriaAltre, setCategoriaAltre] = useState(inicial?.Categoria === 'Altre')
  const [categoriaAltreText, setCategoriaAltreText] = useState(
    categories.includes(inicial?.Categoria ?? '') || !inicial?.Categoria ? '' : inicial.Categoria
  )
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  function setField<K extends keyof ItemInventariFormData>(key: K, value: ItemInventariFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function handleCategoriaSelect(value: string) {
    if (value === 'Altre') {
      setCategoriaAltre(true)
      setForm((f) => ({ ...f, Categoria: categoriaAltreText as ItemInventariFormData['Categoria'] }))
    } else {
      setCategoriaAltre(false)
      setCategoriaAltreText('')
      setField('Categoria', value as ItemInventariFormData['Categoria'])
    }
  }

  function validate(): boolean {
    const e: Errors = {}
    if (!form.Nom.trim()) e.Nom = 'El nom és obligatori.'
    if (!form.Categoria && !(categoriaAltre && categoriaAltreText.trim())) {
      e.Categoria = categoriaAltre ? 'Escriu la categoria.' : 'La categoria és obligatòria.'
    }
    if (!form.Marca.trim()) e.Marca = 'La marca és obligatòria.'
    if (!form.Model.trim()) e.Model = 'El model és obligatori.'
    if (!form.Ubicació.trim()) e.Ubicació = "La ubicació és obligatòria."
    if (form.MAC_LAN && !MAC_REGEX.test(form.MAC_LAN)) {
      e.MAC_LAN = 'Format invàlid. Exemple: AA:BB:CC:DD:EE:FF'
    }
    if (form.MAC_WAN && !MAC_REGEX.test(form.MAC_WAN)) {
      e.MAC_WAN = 'Format invàlid. Exemple: AA:BB:CC:DD:EE:FF'
    }
    if (form.IP_LAN && !IP_REGEX.test(form.IP_LAN)) {
      e.IP_LAN = 'Format invàlid. Exemple: 192.168.1.10'
    }
    if (form.IP_WAN && !IP_REGEX.test(form.IP_WAN)) {
      e.IP_WAN = 'Format invàlid. Exemple: 85.123.45.67'
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

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-text-main">
              {inicial ? 'Editar dispositiu' : 'Nou dispositiu'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Els camps marcats amb * són obligatoris</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Formulari */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Nom */}
          <FormField label="Nom *" error={errors.Nom}>
            <input
              type="text"
              value={form.Nom}
              onChange={(e) => setField('Nom', e.target.value)}
              placeholder="Ex: HP EliteBook 840 G8"
              className={cls(!!errors.Nom)}
              autoFocus
            />
          </FormField>

          {/* Categoria */}
          <FormField label="Categoria *" error={errors.Categoria}>
            <div className="space-y-2">
              <select
                value={categoriaAltre ? 'Altre' : form.Categoria}
                onChange={(e) => handleCategoriaSelect(e.target.value)}
                className={cls(!!errors.Categoria)}
              >
                <option value="">Selecciona una categoria...</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {categoriaAltre && (
                <input
                  type="text"
                  value={categoriaAltreText}
                  onChange={(e) => {
                    setCategoriaAltreText(e.target.value)
                    setForm((f) => ({ ...f, Categoria: e.target.value as ItemInventariFormData['Categoria'] }))
                    if (errors.Categoria) setErrors((er) => ({ ...er, Categoria: undefined }))
                  }}
                  placeholder="Descriu la categoria..."
                  className={cls(!!errors.Categoria && !categoriaAltreText)}
                  autoFocus
                />
              )}
            </div>
          </FormField>

          {/* Marca + Model */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Marca *" error={errors.Marca}>
              <input
                type="text"
                value={form.Marca}
                onChange={(e) => setField('Marca', e.target.value)}
                placeholder="Ex: HP, Apple..."
                className={cls(!!errors.Marca)}
              />
            </FormField>
            <FormField label="Model *" error={errors.Model}>
              <input
                type="text"
                value={form.Model}
                onChange={(e) => setField('Model', e.target.value)}
                placeholder="Ex: EliteBook 840"
                className={cls(!!errors.Model)}
              />
            </FormField>
          </div>

          {/* Núm. sèrie + Ubicació */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Núm. sèrie" error={errors['Núm_sèrie']}>
              <input
                type="text"
                value={form['Núm_sèrie']}
                onChange={(e) => setField('Núm_sèrie', e.target.value)}
                placeholder="Ex: SN-ABC-001"
                className={cls(false)}
              />
            </FormField>
            <FormField label="Ubicació *" error={errors.Ubicació}>
              <input
                type="text"
                value={form.Ubicació}
                onChange={(e) => setField('Ubicació', e.target.value)}
                placeholder="Ex: Aula 55"
                className={cls(!!errors.Ubicació)}
              />
            </FormField>
          </div>

          {/* Estat */}
          <FormField label="Estat">
            <div className="flex gap-2 flex-wrap">
              {ESTATS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setField('Estat', e)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.Estat === e ? ESTAT_ACTIVE[e] : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </FormField>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Data de compra">
              <input
                type="date"
                value={form.Data_compra}
                onChange={(e) => setField('Data_compra', e.target.value)}
                className={cls(false)}
              />
            </FormField>
            <FormField label="Garantia fins">
              <input
                type="date"
                value={form.Garantia_fins}
                onChange={(e) => setField('Garantia_fins', e.target.value)}
                className={cls(false)}
              />
            </FormField>
          </div>

          {/* MACs */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="MAC LAN" error={errors.MAC_LAN}>
              <input
                type="text"
                value={form.MAC_LAN}
                onChange={(e) => setField('MAC_LAN', e.target.value.toUpperCase())}
                placeholder="AA:BB:CC:DD:EE:FF"
                className={cls(!!errors.MAC_LAN)}
                maxLength={17}
              />
            </FormField>
            <FormField label="MAC WAN" error={errors.MAC_WAN}>
              <input
                type="text"
                value={form.MAC_WAN}
                onChange={(e) => setField('MAC_WAN', e.target.value.toUpperCase())}
                placeholder="AA:BB:CC:DD:EE:FF"
                className={cls(!!errors.MAC_WAN)}
                maxLength={17}
              />
            </FormField>
          </div>

          {/* IPs */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="IP LAN" error={errors.IP_LAN}>
              <input
                type="text"
                value={form.IP_LAN}
                onChange={(e) => setField('IP_LAN', e.target.value)}
                placeholder="192.168.1.10"
                className={cls(!!errors.IP_LAN)}
              />
            </FormField>
            <FormField label="IP WAN" error={errors.IP_WAN}>
              <input
                type="text"
                value={form.IP_WAN}
                onChange={(e) => setField('IP_WAN', e.target.value)}
                placeholder="85.123.45.67"
                className={cls(!!errors.IP_WAN)}
              />
            </FormField>
          </div>

          {/* Notes */}
          <FormField label="Notes">
            <textarea
              value={form.Notes}
              onChange={(e) => setField('Notes', e.target.value)}
              placeholder="Observacions addicionals..."
              rows={2}
              className={`${cls(false)} resize-none`}
            />
          </FormField>
        </form>

        {/* Footer */}
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
            {saving ? 'Guardant...' : inicial ? 'Desar canvis' : 'Afegir dispositiu'}
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

const ESTAT_ACTIVE: Record<EstatInventari, string> = {
  'Actiu':        'bg-green-50 border-green-400 text-green-700',
  'En reparació': 'bg-yellow-50 border-yellow-400 text-yellow-700',
  'En préstec':   'bg-blue-50 border-blue-400 text-blue-700',
  'De baixa':     'bg-red-50 border-red-400 text-red-700',
}
