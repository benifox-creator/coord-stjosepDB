import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { SubstitucioFormData, EtapaSubstitucio, TipusSubstitucio } from './types'
import { ETAPES_SUBSTITUCIO } from './types'
import { formatDateISO } from './substitucions.utils'
import { useUsuarisStore } from '../../store/usuarisStore'

interface Props {
  dataInicial?: string
  onDesar: (data: SubstitucioFormData) => Promise<void>
  onCancel: () => void
}

const TIPUS: TipusSubstitucio[] = ['Classe', 'Pati']

export function SubstitucioForm({ dataInicial, onDesar, onCancel }: Props) {
  const avui = formatDateISO(new Date())
  const usuaris = useUsuarisStore((s) => s.usuaris)


  const [data, setData] = useState<SubstitucioFormData>({
    Data: dataInicial ?? avui,
    Etapa: 'ESO 1r-2n',
    Franja: '',
    Tipus: 'Classe',
    ProfessorAbsent: '',
    ProfessorSubstitut: '',
    Grup: '',
    Materia: '',
    Notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof SubstitucioFormData>(k: K, v: SubstitucioFormData[K]) {
    setData((prev) => ({ ...prev, [k]: v }))
  }

  function handleEtapaChange(etapa: EtapaSubstitucio) {
    setData((prev) => ({ ...prev, Etapa: etapa, Franja: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data.Data) { setError('Cal indicar la data.'); return }
    if (!data.Franja) { setError('Cal seleccionar una franja horària.'); return }
    if (!data.ProfessorAbsent) { setError('Cal indicar el professor absent.'); return }
    if (!data.ProfessorSubstitut) { setError('Cal indicar el professor substitut.'); return }
    if (data.Tipus === 'Classe' && !data.Grup) { setError("Cal indicar el grup."); return }
    if (data.ProfessorAbsent === data.ProfessorSubstitut) { setError('El professor absent i el substitut no poden ser el mateix.'); return }
    setError('')
    setSaving(true)
    try {
      await onDesar(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desant la substitució')
      setSaving(false)
    }
  }

  const professors = usuaris.filter((u) => u.Email)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-text-main">Nova substitució</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Data */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Data *</label>
            <input
              type="date"
              value={data.Data}
              onChange={(e) => set('Data', e.target.value)}
              className="input w-full text-sm"
              required
            />
          </div>

          {/* Tipus */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Tipus *</label>
            <div className="flex gap-2">
              {TIPUS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('Tipus', t)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    data.Tipus === t
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t === 'Pati' ? '🏃 Pati' : '📚 Classe'}
                </button>
              ))}
            </div>
          </div>

          {/* Etapa */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Etapa *</label>
            <select
              value={data.Etapa}
              onChange={(e) => handleEtapaChange(e.target.value as EtapaSubstitucio)}
              className="input w-full text-sm"
            >
              {ETAPES_SUBSTITUCIO.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          {/* Franja */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Franja horària *</label>
            <input
              type="text"
              value={data.Franja}
              onChange={(e) => set('Franja', e.target.value)}
              placeholder="p.ex. 8:00-9:00"
              className="input w-full text-sm"
            />
          </div>

          {/* Professor absent */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Professor absent *</label>
            <select
              value={data.ProfessorAbsent}
              onChange={(e) => set('ProfessorAbsent', e.target.value)}
              className="input w-full text-sm"
            >
              <option value="">Selecciona un professor...</option>
              {professors.map((u) => (
                <option key={u.Email} value={u.Email}>{u.Nom || u.Email}</option>
              ))}
            </select>
          </div>

          {/* Professor substitut */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Professor substitut *</label>
            <select
              value={data.ProfessorSubstitut}
              onChange={(e) => set('ProfessorSubstitut', e.target.value)}
              className="input w-full text-sm"
            >
              <option value="">Selecciona un professor...</option>
              {professors
                .filter((u) => u.Email !== data.ProfessorAbsent)
                .map((u) => (
                  <option key={u.Email} value={u.Email}>{u.Nom || u.Email}</option>
                ))}
            </select>
          </div>

          {/* Grup i Matèria (només Classe) */}
          {data.Tipus === 'Classe' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Grup *</label>
                <input
                  type="text"
                  value={data.Grup}
                  onChange={(e) => set('Grup', e.target.value)}
                  placeholder="p.ex. 3r ESO A"
                  className="input w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Matèria</label>
                <input
                  type="text"
                  value={data.Materia}
                  onChange={(e) => set('Materia', e.target.value)}
                  placeholder="p.ex. Matemàtiques"
                  className="input w-full text-sm"
                />
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
            <textarea
              value={data.Notes}
              onChange={(e) => set('Notes', e.target.value)}
              rows={3}
              placeholder="Indicacions addicionals..."
              className="input w-full text-sm resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </form>

        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 shrink-0 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel·lar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#861414' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Desant...' : 'Desar i notificar'}
          </button>
        </div>
      </div>
    </div>
  )
}
