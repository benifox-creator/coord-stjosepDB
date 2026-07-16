import { useState } from 'react'
import { X, Archive, MapPin, Loader2, Pencil, MessageSquare, AlertTriangle, Trash2 } from 'lucide-react'
import type { ItemMaterial } from './types'

interface Props {
  item: ItemMaterial
  onClose: () => void
  isCoordinador?: boolean
  onEditarNotes: (item: ItemMaterial, notes: string) => Promise<void>
  onEditar: (item: ItemMaterial) => void
  onEliminar: (item: ItemMaterial) => Promise<void>
  potEliminar?: boolean
}

export function MaterialDetall({ item, onClose, isCoordinador = false, onEditarNotes, onEditar, onEliminar, potEliminar = false }: Props) {
  const [editNotes, setEditNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(item.Notes)
  const [saving, setSaving] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  const enPrestec = item.Quantitat_total - item.Quantitat_disponible
  const pct = item.Quantitat_total > 0 ? Math.round((item.Quantitat_disponible / item.Quantitat_total) * 100) : 100
  const stockBaix = pct <= 20 && item.Quantitat_total > 0
  const barColor = pct <= 20 ? 'bg-red-400' : pct <= 50 ? 'bg-amber-400' : 'bg-green-400'

  async function handleNotes() {
    setSaving(true)
    try {
      await onEditarNotes(item, notesDraft)
      setEditNotes(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative bg-white w-full max-w-md flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-200 bg-white">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold text-primary">{item.ID}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.Categoria}</span>
            </div>
            <h2 className="text-sm font-semibold text-text-main leading-snug">{item.Nom}</h2>
            {item.Descripció && <p className="text-xs text-gray-400 mt-0.5">{item.Descripció}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Alerta stock baix */}
          {stockBaix && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">Stock per sota del 20%. Considera reposar unitats.</p>
            </div>
          )}

          {/* Stock */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Stock</p>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-semibold text-gray-800">{item.Quantitat_total} unitats</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">En préstec</span>
                <span className={`font-semibold ${enPrestec > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{enPrestec}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Disponibles</span>
                <span className={`font-semibold text-lg ${item.Quantitat_disponible === 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {item.Quantitat_disponible}
                </span>
              </div>
              <div className="pt-1">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Disponibilitat</span>
                  <span>{pct}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          </section>

          {/* Info */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Informació</p>
            <div className="flex items-start gap-2.5">
              <Archive size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Categoria</p>
                <p className="text-sm text-gray-700">{item.Categoria}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Ubicació</p>
                <p className="text-sm text-gray-700">{item.Ubicació || '—'}</p>
              </div>
            </div>
          </section>

          {/* Notes */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare size={12} /> Notes
              </p>
              {isCoordinador && !editNotes && (
                <button onClick={() => setEditNotes(true)} className="text-xs text-primary hover:underline">
                  {item.Notes ? 'Editar' : 'Afegir'}
                </button>
              )}
            </div>
            {editNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={3}
                  placeholder="Observacions..."
                  className="input resize-none text-sm w-full"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setEditNotes(false); setNotesDraft(item.Notes) }}
                    className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg">
                    Cancel·lar
                  </button>
                  <button onClick={handleNotes} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                    style={{ backgroundColor: '#861414' }}>
                    {saving && <Loader2 size={12} className="animate-spin" />}
                    Desar
                  </button>
                </div>
              </div>
            ) : (
              <p className={`text-sm leading-relaxed ${item.Notes ? 'text-gray-700 bg-gray-50 rounded-lg px-3 py-2.5 whitespace-pre-wrap' : 'text-gray-400 italic'}`}>
                {item.Notes || 'Sense notes'}
              </p>
            )}
          </section>
        </div>

        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex justify-between items-center gap-2">
          {potEliminar ? (
            confirmEliminar ? (
              <div className="flex flex-col gap-1">
                {errorEliminar && <p className="text-xs text-red-600">{errorEliminar}</p>}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-600 font-medium">Eliminar ítem?</span>
                  <button
                    onClick={async () => {
                      setSaving(true); setErrorEliminar(null)
                      try { await onEliminar(item); onClose() }
                      catch (err) { setErrorEliminar(err instanceof Error ? err.message : 'Error en eliminar'); setSaving(false) }
                    }}
                    disabled={saving}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                  >
                    {saving && <Loader2 size={11} className="animate-spin" />} Sí
                  </button>
                  <button onClick={() => { setConfirmEliminar(false); setErrorEliminar(null) }}
                    className="px-2 py-1 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg">No</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmEliminar(true)}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors">
                <Trash2 size={13} /> Eliminar
              </button>
            )
          ) : <span />}
          <div className="flex items-center gap-2">
            {isCoordinador && (
              <button onClick={() => onEditar(item)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#861414' }}>
                <Pencil size={12} /> Editar
              </button>
            )}
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
              Tancar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
