import { useState } from 'react'
import { X, MapPin, User, Calendar, ChevronDown, CheckCircle, Loader2, Trash2, Tag } from 'lucide-react'
import type { Manteniment, EstatManteniment } from './types'
import { formatDate } from './manteniment.utils'

const ESTATS: EstatManteniment[] = ['Pendent', 'En gestió', 'Resolt', 'Cancel·lat']

const ESTAT_COLORS: Record<EstatManteniment, string> = {
  'Pendent':    'text-amber-700 bg-amber-100',
  'En gestió':  'text-blue-600 bg-blue-100',
  'Resolt':     'text-green-700 bg-green-100',
  'Cancel·lat': 'text-gray-500 bg-gray-100',
}

const PRIORITAT_COLORS: Record<string, string> = {
  Urgent: 'text-red-600 bg-red-50 border border-red-200',
  Normal: 'text-amber-600 bg-amber-50 border border-amber-200',
  Baixa:  'text-gray-500 bg-gray-50 border border-gray-200',
}

const CATEGORIA_ICONS: Record<string, string> = {
  'Persianes/Stores': '🪟',
  'Portes/Finestres': '🚪',
  'Mobiliari': '🪑',
  'Electricitat': '⚡',
  'Fontaneria': '🔧',
  'Pintura': '🎨',
  'Altres': '🔩',
}

interface Props {
  manteniment: Manteniment
  canGestionar: boolean
  onClose: () => void
  onEliminar: (m: Manteniment) => Promise<void>
  onCanviarEstat: (m: Manteniment, estat: EstatManteniment) => Promise<void>
}

export function MantenimentDetall({ manteniment: m, canGestionar, onClose, onEliminar, onCanviarEstat }: Props) {
  const [estatObert, setEstatObert] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [eliminant, setEliminant] = useState(false)

  async function handleCanviarEstat(estat: EstatManteniment) {
    if (estat === m.Estat) { setEstatObert(false); return }
    setSaving(true)
    try {
      await onCanviarEstat(m, estat)
    } finally {
      setSaving(false)
      setEstatObert(false)
    }
  }

  async function handleEliminar() {
    setEliminant(true)
    try {
      await onEliminar(m)
      onClose()
    } catch {
      setEliminant(false)
      setConfirmEliminar(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full">

        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono font-semibold text-primary">{m.ID}</span>
              <span className="text-sm">{CATEGORIA_ICONS[m.Categoria] ?? '🔩'}</span>
              <span className="text-xs text-gray-500">{m.Categoria}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITAT_COLORS[m.Prioritat]}`}>
                {m.Prioritat}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-text-main leading-snug">{m.Titol}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">
            <X size={20} />
          </button>
        </div>

        {/* Cos */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Estat */}
          {canGestionar ? (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Estat</p>
              <div className="relative">
                <button
                  onClick={() => setEstatObert((o) => !o)}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full justify-between border bg-gray-50 border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {saving && <Loader2 size={14} className="animate-spin text-gray-400" />}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTAT_COLORS[m.Estat]}`}>
                      {m.Estat}
                    </span>
                  </div>
                  <ChevronDown size={15} className={`text-gray-400 transition-transform ${estatObert ? 'rotate-180' : ''}`} />
                </button>
                {estatObert && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                    {ESTATS.map((e) => (
                      <button
                        key={e}
                        onClick={() => handleCanviarEstat(e)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${e === m.Estat ? 'bg-gray-50' : ''}`}
                      >
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTAT_COLORS[e]}`}>{e}</span>
                        {e === m.Estat && <CheckCircle size={14} className="ml-auto text-gray-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Estat</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTAT_COLORS[m.Estat]}`}>
                {m.Estat}
              </span>
            </section>
          )}

          {/* Informació */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Informació</p>

            {m.Localitzacio && (
              <div className="flex items-start gap-2.5">
                <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Localització</p>
                  <p className="text-sm text-gray-700">{m.Localitzacio}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2.5">
              <User size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Reportat per</p>
                <p className="text-sm text-gray-700">{m.Reporter || '—'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Calendar size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Data del report</p>
                <p className="text-sm text-gray-700">{formatDate(m.Data_report)}</p>
              </div>
            </div>

            {m.Data_resolucio && (
              <div className="flex items-start gap-2.5">
                <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Data resolució</p>
                  <p className="text-sm text-gray-700">{formatDate(m.Data_resolucio)}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2.5">
              <Tag size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Categoria</p>
                <p className="text-sm text-gray-700">{CATEGORIA_ICONS[m.Categoria]} {m.Categoria}</p>
              </div>
            </div>
          </section>

          {m.Descripcio && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Descripció</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2.5 leading-relaxed">
                {m.Descripcio}
              </p>
            </section>
          )}

          {m.Notes && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 leading-relaxed">
                {m.Notes}
              </p>
            </section>
          )}
        </div>

        {/* Footer */}
        {canGestionar && (
          <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 shrink-0 flex items-center justify-end gap-2">
            {confirmEliminar ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Eliminar?</span>
                <button
                  onClick={handleEliminar}
                  disabled={eliminant}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                >
                  {eliminant && <Loader2 size={11} className="animate-spin" />} Sí
                </button>
                <button
                  onClick={() => setConfirmEliminar(false)}
                  className="px-2 py-1 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmEliminar(true)}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                <Trash2 size={13} /> Eliminar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
