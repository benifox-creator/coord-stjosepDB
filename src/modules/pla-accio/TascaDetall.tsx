import { useState } from 'react'
import { X, Calendar, User, Folder, ChevronDown, CheckCircle, Loader2, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import type { Tasca, Projecte, EstatTasca } from './types'
import { formatDate, isOverdue } from './pla-accio.utils'

const ESTATS: EstatTasca[] = ['Pendent', 'En curs', 'Completada', 'Bloquejada']

const ESTAT_COLORS: Record<EstatTasca, string> = {
  'Pendent':    'text-gray-600 bg-gray-100',
  'En curs':   'text-blue-600 bg-blue-100',
  'Completada':'text-green-700 bg-green-100',
  'Bloquejada':'text-red-600 bg-red-100',
}

const PRIORITAT_COLORS: Record<string, string> = {
  Alta:    'text-red-600 bg-red-50 border border-red-200',
  Mitjana: 'text-amber-600 bg-amber-50 border border-amber-200',
  Baixa:   'text-gray-500 bg-gray-50 border border-gray-200',
}

interface Props {
  tasca: Tasca
  projecte: Projecte | undefined
  canGestionar: boolean
  onClose: () => void
  onEditar: () => void
  onEliminar: (tasca: Tasca) => Promise<void>
  onCanviarEstat: (tasca: Tasca, estat: EstatTasca) => Promise<void>
}

export function TascaDetall({ tasca, projecte, canGestionar, onClose, onEditar, onEliminar, onCanviarEstat }: Props) {
  const [estatObert, setEstatObert] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [eliminant, setEliminant] = useState(false)

  const vencuda = isOverdue(tasca.Data_limit) && tasca.Estat !== 'Completada'

  async function handleCanviarEstat(estat: EstatTasca) {
    if (estat === tasca.Estat) { setEstatObert(false); return }
    setSaving(true)
    try {
      await onCanviarEstat(tasca, estat)
    } finally {
      setSaving(false)
      setEstatObert(false)
    }
  }

  async function handleEliminar() {
    setEliminant(true)
    try {
      await onEliminar(tasca)
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
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold text-primary">{tasca.ID}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITAT_COLORS[tasca.Prioritat]}`}>
                {tasca.Prioritat}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-text-main leading-snug">{tasca.Titol}</h2>
            {projecte && <p className="text-xs text-gray-400 mt-0.5">{projecte.Nom}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">
            <X size={20} />
          </button>
        </div>

        {/* Cos */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Estat */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Estat</p>
            <div className="relative">
              <button
                onClick={() => canGestionar && setEstatObert((o) => !o)}
                disabled={!canGestionar || saving}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full justify-between border transition-colors ${
                  canGestionar
                    ? 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    : 'bg-gray-50 border-gray-100 cursor-default'
                }`}
              >
                <div className="flex items-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin text-gray-400" />}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTAT_COLORS[tasca.Estat]}`}>
                    {tasca.Estat}
                  </span>
                </div>
                {canGestionar && (
                  <ChevronDown size={15} className={`text-gray-400 transition-transform ${estatObert ? 'rotate-180' : ''}`} />
                )}
              </button>
              {estatObert && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                  {ESTATS.map((e) => (
                    <button
                      key={e}
                      onClick={() => handleCanviarEstat(e)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${e === tasca.Estat ? 'bg-gray-50' : ''}`}
                    >
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTAT_COLORS[e]}`}>{e}</span>
                      {e === tasca.Estat && <CheckCircle size={14} className="ml-auto text-gray-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Informació */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Informació</p>
            {projecte && (
              <div className="flex items-start gap-2.5">
                <Folder size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Projecte</p>
                  <p className="text-sm text-gray-700">{projecte.Nom}</p>
                </div>
              </div>
            )}
            {tasca.Responsable && (
              <div className="flex items-start gap-2.5">
                <User size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Responsable</p>
                  <p className="text-sm text-gray-700">{tasca.Responsable}</p>
                </div>
              </div>
            )}
            {tasca.Data_limit && (
              <div className="flex items-start gap-2.5">
                {vencuda
                  ? <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                  : <Calendar size={14} className="text-gray-400 mt-0.5 shrink-0" />
                }
                <div>
                  <p className="text-xs text-gray-400">Data límit</p>
                  <p className={`text-sm font-medium ${vencuda ? 'text-red-500' : 'text-gray-700'}`}>
                    {formatDate(tasca.Data_limit)}{vencuda ? ' — Vençuda' : ''}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Descripció */}
          {tasca.Descripcio && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Descripció</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2.5 leading-relaxed">
                {tasca.Descripcio}
              </p>
            </section>
          )}
        </div>

        {/* Footer */}
        {canGestionar && (
          <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 shrink-0 flex items-center justify-between gap-2">
            {confirmEliminar ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Eliminar tasca?</span>
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
            <button
              onClick={onEditar}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#861414' }}
            >
              <Pencil size={14} /> Editar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
