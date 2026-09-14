import { useState, useMemo } from 'react'
import { X, Loader2 } from 'lucide-react'
import type {
  ComandaInfantilFormData, EtapaInfantil, EstatComandaInfantil, MaterialInfantil, ComandaInfantil,
} from './types'
import { ESTATS_COMANDA_INFANTIL, COMANDA_HABITUAL_VALORS } from './types'
import { estocDisponible, necessitatBase, suggeriEstocAplicat, nreAlumnesFromConfig } from './materialInfantil.utils'
import { useConfigStore } from '../../store/configStore'

interface Props {
  etapa: EtapaInfantil
  cursEscolar: string
  materials: MaterialInfantil[]
  comandesExistents: ComandaInfantil[]
  onDesar: (data: ComandaInfantilFormData) => Promise<void>
  onCancel: () => void
}

export function ComandaInfantilForm({ etapa, cursEscolar, materials, comandesExistents, onDesar, onCancel }: Props) {
  const config = useConfigStore((s) => s.config)
  const getValues = useConfigStore((s) => s.getValues)
  const nAlumnes = nreAlumnesFromConfig(config, etapa, cursEscolar)
  const margePct = Number(getValues('material-infantil.marge-seguretat-pct')[0]) || 0

  const materialsDisponibles = useMemo(() => {
    const jaUsats = new Set(
      comandesExistents.filter((c) => c.CursEscolar === cursEscolar && c.Etapa === etapa && c.Estat !== 'Cancel·lat').map((c) => c.MaterialId),
    )
    return materials
      .filter((m) => !jaUsats.has(m.id))
      .sort((a, b) =>
        COMANDA_HABITUAL_VALORS.indexOf(a.ComandaHabitual) - COMANDA_HABITUAL_VALORS.indexOf(b.ComandaHabitual)
        || a.Nom.localeCompare(b.Nom),
      )
  }, [materials, comandesExistents, cursEscolar, etapa])

  const [materialId, setMaterialId] = useState(materialsDisponibles[0]?.id ?? '')
  const material = materials.find((m) => m.id === materialId) ?? null

  function suggerits(m: MaterialInfantil | null) {
    const estoc = m ? suggeriEstocAplicat(estocDisponible(m), comandesExistents, m.id, cursEscolar) : 0
    const marge = m ? Math.round(necessitatBase(m.UnitatsPerAlumne, nAlumnes) * (margePct / 100)) : 0
    return { estoc, marge }
  }

  const inicials = suggerits(material)
  const [estocAplicat, setEstocAplicat] = useState(inicials.estoc)
  const [margeSeguretat, setMargeSeguretat] = useState(inicials.marge)
  const [estat, setEstat] = useState<EstatComandaInfantil>('Pendent')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleMaterialChange(id: string) {
    setMaterialId(id)
    const m = materials.find((x) => x.id === id) ?? null
    const s = suggerits(m)
    setEstocAplicat(s.estoc)
    setMargeSeguretat(s.marge)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!materialId) { setError('Cal seleccionar un material.'); return }
    setError('')
    setSaving(true)
    try {
      await onDesar({
        CursEscolar: cursEscolar,
        Etapa: etapa,
        MaterialId: materialId,
        EstocAplicat: estocAplicat,
        MargeSeguretat: margeSeguretat,
        Estat: estat,
        Notes: notes,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desant la línia')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-text-main">Afegeix línia — {etapa} · {cursEscolar}</h2>
          <button
            onClick={() => { if (!saving) onCancel() }}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Material *</label>
            {materialsDisponibles.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Tots els materials del catàleg ja tenen línia per {etapa} al curs {cursEscolar}.
              </p>
            ) : (
              <select value={materialId} onChange={(e) => handleMaterialChange(e.target.value)} className="input">
                {materialsDisponibles.map((m) => (
                  <option key={m.id} value={m.id}>{m.Nom}</option>
                ))}
              </select>
            )}
          </div>

          {material && (
            <p className="text-xs text-gray-500">
              Necessitat base: <span className="font-semibold text-text-main">{necessitatBase(material.UnitatsPerAlumne, nAlumnes)}</span>
              {' '}({material.UnitatsPerAlumne} ud./alumne × {nAlumnes} alumnes) · Estoc disponible:{' '}
              <span className="font-semibold text-text-main">{estocDisponible(material)}</span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Estoc aplicat</label>
              <input
                type="number"
                min={0}
                value={estocAplicat}
                onChange={(e) => setEstocAplicat(Number(e.target.value))}
                className="input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-600">Marge seguretat</label>
              <input
                type="number"
                min={0}
                value={margeSeguretat}
                onChange={(e) => setMargeSeguretat(Number(e.target.value))}
                className="input"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Estat</label>
            <select value={estat} onChange={(e) => setEstat(e.target.value as EstatComandaInfantil)} className="input">
              {ESTATS_COMANDA_INFANTIL.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input resize-none" />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel·la
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || materialsDisponibles.length === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#861414' }}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Afegeix línia
          </button>
        </div>
      </div>
    </div>
  )
}
