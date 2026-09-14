import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useConfigStore } from '../../store/configStore'

interface CampConfig { clau: string; label: string; type: 'text' | 'number' }

const CAMPS: CampConfig[] = [
  { clau: 'material-infantil.curs-actiu', label: 'Curs escolar actiu', type: 'text' },
  { clau: 'material-infantil.alumnes-i3', label: 'Alumnes I3', type: 'number' },
  { clau: 'material-infantil.alumnes-i4', label: 'Alumnes I4', type: 'number' },
  { clau: 'material-infantil.alumnes-i5', label: 'Alumnes I5', type: 'number' },
  { clau: 'material-infantil.marge-seguretat-pct', label: 'Marge de seguretat (%)', type: 'number' },
  { clau: 'material-infantil.pressupost-objectiu', label: 'Pressupost objectiu (€)', type: 'number' },
]

interface Props {
  potGestionar: boolean
}

export function ConfiguracioCursInfantilTab({ potGestionar }: Props) {
  const update = useConfigStore((s) => s.update)
  const getValues = useConfigStore((s) => s.getValues)
  const [valors, setValors] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPS.map((c) => [c.clau, getValues(c.clau)[0]])),
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<string | null>(null)

  async function handleDesar(clau: string) {
    setError('')
    setSaving(clau)
    try {
      await update(clau, [valors[clau]])
      setSaved(clau)
      setTimeout(() => setSaved(null), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desant la configuració')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-6">
      <div className="max-w-md space-y-4">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {CAMPS.map(({ clau, label, type }) => (
          <div key={clau} className="flex flex-col gap-1.5">
            <label htmlFor={clau} className="text-sm font-medium text-gray-600">{label}</label>
            <div className="flex gap-2">
              <input
                id={clau}
                min={type === 'number' ? 0 : undefined}
                type={type}
                value={valors[clau]}
                disabled={!potGestionar}
                onChange={(e) => setValors((v) => ({ ...v, [clau]: e.target.value }))}
                className="input text-sm flex-1 disabled:bg-gray-50 disabled:text-gray-500"
              />
              {potGestionar && (
                <button
                  onClick={() => handleDesar(clau)}
                  disabled={saving === clau}
                  className="px-3 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                  style={{ backgroundColor: '#861414' }}
                >
                  {saving === clau ? <Loader2 size={12} className="animate-spin" /> : saved === clau ? '✓' : 'Desar'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
