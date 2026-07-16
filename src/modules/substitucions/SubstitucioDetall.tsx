import { useState } from 'react'
import { X, ChevronDown, CheckCircle, Loader2, Trash2, User, Calendar, Clock, BookOpen, Users } from 'lucide-react'
import type { Substitucio, EstatSubstitucio } from './types'
import { formatDate } from './substitucions.utils'
import { useUsuarisStore } from '../../store/usuarisStore'

const ESTATS: EstatSubstitucio[] = ['Pendent', 'Realitzada', 'Cancel·lada']

const ESTAT_COLORS: Record<EstatSubstitucio, string> = {
  Pendent:      'text-amber-700 bg-amber-100',
  Realitzada:   'text-green-700 bg-green-100',
  'Cancel·lada':'text-gray-500 bg-gray-100',
}

interface Props {
  substitucio: Substitucio
  canGestionar: boolean
  onClose: () => void
  onCanviarEstat: (s: Substitucio, estat: EstatSubstitucio) => Promise<void>
  onEliminar: (s: Substitucio) => Promise<void>
}

export function SubstitucioDetall({ substitucio: s, canGestionar, onClose, onCanviarEstat, onEliminar }: Props) {
  const usuaris = useUsuarisStore((st) => st.usuaris)
  const [estatObert, setEstatObert] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [eliminant, setEliminant] = useState(false)

  function nomUsuari(email: string): string {
    const u = usuaris.find((x) => x.Email === email)
    return u?.Nom || email
  }

  async function handleCanviarEstat(estat: EstatSubstitucio) {
    if (estat === s.Estat) { setEstatObert(false); return }
    setSaving(true)
    try {
      await onCanviarEstat(s, estat)
    } finally {
      setSaving(false)
      setEstatObert(false)
    }
  }

  async function handleEliminar() {
    setEliminant(true)
    try {
      await onEliminar(s)
      onClose()
    } catch {
      setEliminant(false)
      setConfirmEliminar(false)
    }
  }

  const canMarcarRealitzada = !canGestionar && s.Estat !== 'Realitzada' && s.Estat !== 'Cancel·lada'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full">

        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono font-semibold text-primary">{s.ID}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTAT_COLORS[s.Estat]}`}>
                {s.Estat}
              </span>
              {s.Tipus === 'Pati' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                  🏃 Pati
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-text-main">
              {formatDate(s.Data)} · {s.Franja}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{s.Etapa}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">
            <X size={20} />
          </button>
        </div>

        {/* Cos */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Estat — gestió */}
          {canGestionar && (
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTAT_COLORS[s.Estat]}`}>
                      {s.Estat}
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
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${e === s.Estat ? 'bg-gray-50' : ''}`}
                      >
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTAT_COLORS[e]}`}>{e}</span>
                        {e === s.Estat && <CheckCircle size={14} className="ml-auto text-gray-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Marcar com a realitzada — professorat */}
          {canMarcarRealitzada && (
            <button
              onClick={() => handleCanviarEstat('Realitzada')}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#15803d' }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Marcar com a realitzada
            </button>
          )}

          {/* Professors */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Professors</p>
            <div className="flex items-start gap-2.5">
              <User size={14} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Professor absent</p>
                <p className="text-sm text-gray-700 font-medium">{nomUsuari(s.ProfessorAbsent)}</p>
                <p className="text-xs text-gray-400">{s.ProfessorAbsent}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <User size={14} className="text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Professor substitut</p>
                <p className="text-sm text-gray-700 font-medium">{nomUsuari(s.ProfessorSubstitut)}</p>
                <p className="text-xs text-gray-400">{s.ProfessorSubstitut}</p>
              </div>
            </div>
          </section>

          {/* Detalls */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Detalls</p>

            <div className="flex items-start gap-2.5">
              <Calendar size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Data</p>
                <p className="text-sm text-gray-700">{formatDate(s.Data)}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Clock size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Franja · Etapa</p>
                <p className="text-sm text-gray-700">{s.Franja} · {s.Etapa}</p>
              </div>
            </div>

            {s.Tipus === 'Classe' && s.Grup && (
              <div className="flex items-start gap-2.5">
                <Users size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Grup</p>
                  <p className="text-sm text-gray-700">{s.Grup}</p>
                </div>
              </div>
            )}

            {s.Tipus === 'Classe' && s.Materia && (
              <div className="flex items-start gap-2.5">
                <BookOpen size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Matèria</p>
                  <p className="text-sm text-gray-700">{s.Materia}</p>
                </div>
              </div>
            )}
          </section>

          {s.Notes && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 leading-relaxed">
                {s.Notes}
              </p>
            </section>
          )}

          {s.Creat_per && (
            <p className="text-xs text-gray-300">Creat per {s.Creat_per} · {s.Creat_el}</p>
          )}
        </div>

        {/* Footer */}
        {canGestionar && (
          <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 shrink-0 flex items-center justify-end">
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
