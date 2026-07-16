import { useState, useEffect } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'
import type { IncidenciaFormData, TipusProblema, PrioritatIncidencia } from './types'
import { useConfigStore } from '../../store/configStore'

// Mock d'inventari — es substituirà per dades reals al punt 6
const INVENTARI_MOCK = [
  { id: 'INV-001', nom: 'HP EliteBook 840', ubicacio: 'Aula 55' },
  { id: 'INV-002', nom: 'iMac 27"', ubicacio: 'BAXT-1A' },
  { id: 'INV-003', nom: 'MacBook Air M2', ubicacio: 'Sala Professors' },
  { id: 'INV-004', nom: 'Projector Epson EB-X41', ubicacio: 'Aula 32' },
  { id: 'INV-005', nom: 'Impressora HP LaserJet', ubicacio: 'Secretaria' },
]


const PRIORITAT_OPTIONS: PrioritatIncidencia[] = ['Alta', 'Mitjana', 'Baixa']

interface ItemInventari {
  id: string
  nom: string
  ubicacio: string
}

interface Errors {
  'Tipus de problema'?: string
  Localització?: string
  Dispositiu?: string
  'Descripció detallada'?: string
}

interface Props {
  onClose: () => void
  onGuardar: (data: IncidenciaFormData) => Promise<void>
  isCoordinador?: boolean
  inventari?: ItemInventari[]
}

export function IncidenciaForm({
  onClose,
  onGuardar,
  isCoordinador = false,
  inventari = INVENTARI_MOCK,
}: Props) {
  const tipusOptions = useConfigStore((s) => s.getValues('incidencies.tipus')) as TipusProblema[]
  const localitzacionsConfig = useConfigStore((s) => s.getValues('incidencies.localitzacions'))
  const [form, setForm] = useState<IncidenciaFormData>({
    'Tipus de problema': '' as TipusProblema,
    Localització: '',
    Dispositiu: '',
    'Descripció detallada': '',
    Prioritat: 'Mitjana',
    'Assignat a': '',
    Comentaris: '',
  })
  const [tipusAltreSeleccionat, setTipusAltreSeleccionat] = useState(false)
  const [tipusAltreText, setTipusAltreText] = useState('')
  const [disposituiAltre, setDisposituiAltre] = useState(false)
  const [disposituiText, setDisposituiText] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  // Sincronitza Tipus de problema quan l'usuari escriu text lliure
  useEffect(() => {
    if (tipusAltreSeleccionat) {
      setForm((f) => ({ ...f, 'Tipus de problema': tipusAltreText as TipusProblema }))
    }
  }, [tipusAltreSeleccionat, tipusAltreText])

  // Sincronitza el camp Dispositiu quan canvia la selecció o el text lliure
  useEffect(() => {
    if (disposituiAltre) {
      setForm((f) => ({ ...f, Dispositiu: disposituiText }))
    }
  }, [disposituiAltre, disposituiText])

  function setField<K extends keyof IncidenciaFormData>(key: K, value: IncidenciaFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key as keyof Errors]) {
      setErrors((e) => ({ ...e, [key]: undefined }))
    }
  }

  function handleDispositiuSelect(value: string) {
    if (value === '__altre__') {
      setDisposituiAltre(true)
      setForm((f) => ({ ...f, Dispositiu: disposituiText }))
    } else {
      setDisposituiAltre(false)
      setForm((f) => ({ ...f, Dispositiu: value }))
      if (errors.Dispositiu) setErrors((e) => ({ ...e, Dispositiu: undefined }))
    }
  }

  function validate(): boolean {
    const e: Errors = {}
    if (!form['Tipus de problema'] || (tipusAltreSeleccionat && !tipusAltreText.trim())) {
      e['Tipus de problema'] = tipusAltreSeleccionat
        ? 'Escriu el tipus de problema.'
        : 'Selecciona un tipus de problema.'
    }
    if (!form.Localització.trim()) e.Localització = 'La localització és obligatòria.'
    if (!form.Dispositiu.trim()) e.Dispositiu = 'Indica el dispositiu afectat.'
    if (!form['Descripció detallada'].trim()) {
      e['Descripció detallada'] = 'La descripció és obligatòria.'
    } else if (form['Descripció detallada'].trim().length < 20) {
      e['Descripció detallada'] = 'La descripció ha de tenir com a mínim 20 caràcters.'
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
      setErrors({ 'Tipus de problema': err instanceof Error ? err.message : 'Error en guardar.' })
    } finally {
      setSaving(false)
    }
  }

  const descLength = form['Descripció detallada'].trim().length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-text-main">Nova incidència</h2>
            <p className="text-xs text-gray-400 mt-0.5">Els camps marcats amb * són obligatoris</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Formulari */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Tipus de problema */}
          <FormField label="Tipus de problema *" error={errors['Tipus de problema']}>
            <div className="space-y-2">
              <select
                value={tipusAltreSeleccionat ? 'Altre' : form['Tipus de problema']}
                onChange={(e) => {
                  if (e.target.value === 'Altre') {
                    setTipusAltreSeleccionat(true)
                    setForm((f) => ({ ...f, 'Tipus de problema': tipusAltreText as TipusProblema }))
                  } else {
                    setTipusAltreSeleccionat(false)
                    setTipusAltreText('')
                    setField('Tipus de problema', e.target.value as TipusProblema)
                  }
                }}
                className={inputCls(!!errors['Tipus de problema'])}
              >
                <option value="">Selecciona un tipus...</option>
                {tipusOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {tipusAltreSeleccionat && (
                <input
                  type="text"
                  value={tipusAltreText}
                  onChange={(e) => {
                    setTipusAltreText(e.target.value)
                    if (errors['Tipus de problema']) setErrors((err) => ({ ...err, 'Tipus de problema': undefined }))
                  }}
                  placeholder="Descriu el tipus de problema..."
                  className={inputCls(!!errors['Tipus de problema'] && !tipusAltreText)}
                  autoFocus
                />
              )}
            </div>
          </FormField>

          {/* Localització */}
          <FormField label="Localització *" error={errors.Localització}>
            <input
              type="text"
              list="localitzacions-list"
              value={form.Localització}
              onChange={(e) => setField('Localització', e.target.value)}
              placeholder="Exemple: Aula informàtica, Sala Professors..."
              className={inputCls(!!errors.Localització)}
            />
            <datalist id="localitzacions-list">
              {localitzacionsConfig.map((l) => <option key={l} value={l} />)}
            </datalist>
          </FormField>

          {/* Dispositiu */}
          <FormField label="Dispositiu *" error={errors.Dispositiu}>
            {inventari.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={disposituiAltre ? '__altre__' : form.Dispositiu}
                  onChange={(e) => handleDispositiuSelect(e.target.value)}
                  className={inputCls(!!errors.Dispositiu)}
                >
                  <option value="">Selecciona un dispositiu...</option>
                  {inventari.map((item) => (
                    <option key={item.id} value={`${item.id} ${item.nom} — ${item.ubicacio}`}>
                      {item.id} {item.nom} — {item.ubicacio}
                    </option>
                  ))}
                  <option value="__altre__">Altre (escriu-ho manualment)</option>
                </select>
                {disposituiAltre && (
                  <input
                    type="text"
                    value={disposituiText}
                    onChange={(e) => setDisposituiText(e.target.value)}
                    placeholder="Descriu el dispositiu..."
                    className={inputCls(!!errors.Dispositiu && !disposituiText)}
                    autoFocus
                  />
                )}
              </div>
            ) : (
              <input
                type="text"
                value={form.Dispositiu}
                onChange={(e) => setField('Dispositiu', e.target.value)}
                placeholder="Descriu el dispositiu afectat"
                className={inputCls(!!errors.Dispositiu)}
              />
            )}
          </FormField>

          {/* Prioritat */}
          <FormField label="Prioritat">
            <div className="flex gap-2">
              {PRIORITAT_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setField('Prioritat', p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.Prioritat === p
                      ? PRIORITAT_ACTIVE[p]
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </FormField>

          {/* Descripció */}
          <FormField label="Descripció detallada *" error={errors['Descripció detallada']}>
            <div className="relative">
              <textarea
                value={form['Descripció detallada']}
                onChange={(e) => setField('Descripció detallada', e.target.value)}
                placeholder="Descriu la incidència amb el màxim de detall possible..."
                rows={4}
                className={`${inputCls(!!errors['Descripció detallada'])} resize-none`}
              />
              <span className={`absolute bottom-2 right-3 text-xs ${
                descLength === 0 ? 'text-gray-300' : descLength < 20 ? 'text-amber-500' : 'text-green-500'
              }`}>
                {descLength}/20 mín.
              </span>
            </div>
          </FormField>

          {/* Camps de coordinador */}
          {isCoordinador && (
            <div className="border-t border-dashed border-gray-200 pt-5 space-y-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Camps del coordinador
              </p>
              <FormField label="Assignat a">
                <input
                  type="email"
                  value={form['Assignat a'] ?? ''}
                  onChange={(e) => setField('Assignat a', e.target.value)}
                  placeholder="email@stjosep.org"
                  className={inputCls(false)}
                />
              </FormField>
              <FormField label="Comentaris">
                <textarea
                  value={form.Comentaris ?? ''}
                  onChange={(e) => setField('Comentaris', e.target.value)}
                  placeholder="Notes internes..."
                  rows={2}
                  className={`${inputCls(false)} resize-none`}
                />
              </FormField>
            </div>
          )}
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
            {saving ? 'Guardant...' : 'Crear incidència'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers visuals ────────────────────────────────────────────────────────────

function inputCls(hasError: boolean) {
  return `input ${hasError ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : ''}`
}

function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-600">{label}</label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  )
}

const PRIORITAT_ACTIVE: Record<PrioritatIncidencia, string> = {
  Alta:    'bg-red-50 border-red-400 text-red-700',
  Mitjana: 'bg-amber-50 border-amber-400 text-amber-700',
  Baixa:   'bg-blue-50 border-blue-400 text-blue-700',
}
