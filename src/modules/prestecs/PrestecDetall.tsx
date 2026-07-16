import { useState } from 'react'
import {
  X, User, Mail, Calendar, ChevronDown,
  CheckCircle, Loader2, MessageSquare, RotateCcw, Archive, Trash2, Infinity,
} from 'lucide-react'
import { Badge } from '../../components/Badge'
import { formatDate, estatEfectiu, diesRestants } from './prestecs.utils'
import { parseMaterial } from '../material/material.utils'
import type { Prestec, EstatPrestec } from './types'

const ESTATS: EstatPrestec[] = ['Actiu', 'Retornat', 'Vençut']

interface Props {
  prestec: Prestec
  onClose: () => void
  isCoordinador?: boolean
  onCanviarEstat: (prestec: Prestec, estat: EstatPrestec) => Promise<void>
  onEditarNotes: (prestec: Prestec, notes: string) => Promise<void>
  onEliminar: (prestec: Prestec) => Promise<void>
  potEliminar?: boolean
}

export function PrestecDetall({
  prestec,
  onClose,
  isCoordinador = false,
  onCanviarEstat,
  onEditarNotes,
  onEliminar,
  potEliminar = false,
}: Props) {
  const [estatObert, setEstatObert] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState(prestec.Notes)

  const estat = estatEfectiu(prestec)
  const dies = diesRestants(prestec.Data_fi_prevista)
  const materialItems = parseMaterial(prestec.Material)

  async function handleCanviarEstat(nouEstat: EstatPrestec) {
    if (nouEstat === estat) { setEstatObert(false); return }
    setSaving('estat')
    try {
      await onCanviarEstat(prestec, nouEstat)
    } finally {
      setSaving(null)
      setEstatObert(false)
    }
  }

  async function handleRetornarAra() {
    setSaving('retornar')
    try {
      await onCanviarEstat(prestec, 'Retornat')
    } finally {
      setSaving(null)
    }
  }

  async function handleNotes() {
    setSaving('notes')
    try {
      await onEditarNotes(prestec, notesDraft)
      setEditNotes(false)
    } finally {
      setSaving(null)
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
              <span className="text-xs font-mono font-semibold text-primary">{prestec.ID}</span>
              <Badge label={estat} variant="prestec-estat" />
            </div>
            <h2 className="text-sm font-semibold text-text-main leading-snug">
              {prestec.Dispositiu_Nom || prestec.Dispositiu_ID}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{prestec.Dispositiu_ID} · {prestec.Usuari}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Alerta vençut */}
          {estat === 'Vençut' && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <span className="text-red-500 text-sm font-semibold mt-0.5">⚠</span>
              <p className="text-xs text-red-700">
                Préstec vençut fa {dies !== null ? Math.abs(dies) : '?'} dies. Cal contactar amb l'usuari.
              </p>
            </div>
          )}

          {/* Estat */}
          {isCoordinador && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Estat</p>
              <div className="relative">
                <button
                  onClick={() => setEstatObert((o) => !o)}
                  disabled={saving === 'estat' || prestec.Estat === 'Retornat'}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors w-full justify-between disabled:cursor-default disabled:opacity-70"
                >
                  <div className="flex items-center gap-2">
                    {saving === 'estat' && <Loader2 size={14} className="animate-spin text-gray-400" />}
                    <Badge label={estat} variant="prestec-estat" />
                  </div>
                  {prestec.Estat !== 'Retornat' && (
                    <ChevronDown size={15} className={`text-gray-400 transition-transform ${estatObert ? 'rotate-180' : ''}`} />
                  )}
                </button>
                {estatObert && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                    {ESTATS.map((e) => (
                      <button
                        key={e}
                        onClick={() => handleCanviarEstat(e)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${e === estat ? 'bg-gray-50' : ''}`}
                      >
                        <Badge label={e} variant="prestec-estat" />
                        {e === estat && <CheckCircle size={14} className="ml-auto text-gray-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Retornar ara */}
              {estat !== 'Retornat' && (
                <button
                  onClick={handleRetornarAra}
                  disabled={saving === 'retornar'}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-800 transition-colors disabled:opacity-50"
                >
                  {saving === 'retornar'
                    ? <Loader2 size={13} className="animate-spin" />
                    : <RotateCcw size={13} />}
                  Marcar com a retornat ara
                </button>
              )}
            </section>
          )}

          {/* Dispositiu */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Dispositiu</p>
            <InfoRow
              icon={<span className="text-xs font-mono font-semibold text-primary">{prestec.Dispositiu_ID}</span>}
              label="ID"
              value={prestec.Dispositiu_Nom || '—'}
            />
          </section>

          {/* Usuari */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Usuari</p>
            <InfoRow icon={<User size={14} />} label="Nom" value={prestec.Usuari || '—'} />
            {prestec.Email && (
              <InfoRow icon={<Mail size={14} />} label="Correu" value={
                <a href={`mailto:${prestec.Email}`} className="text-primary hover:underline">
                  {prestec.Email}
                </a>
              } />
            )}
          </section>

          {/* Dates */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Dates</p>
            <InfoRow icon={<Calendar size={14} />} label="Data d'inici" value={formatDate(prestec.Data_inici)} />
            <InfoRow
              icon={<Calendar size={14} />}
              label="Data retorn prev."
              value={
                !prestec.Data_fi_prevista ? (
                  <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                    <Infinity size={14} /> Temps il·limitat
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>{formatDate(prestec.Data_fi_prevista)}</span>
                    {estat !== 'Retornat' && dies !== null && (
                      <span className={`text-xs font-medium ${dies < 0 ? 'text-red-600' : dies <= 3 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {dies < 0 ? `${Math.abs(dies)}d vençut` : dies === 0 ? 'avui' : `${dies}d restants`}
                      </span>
                    )}
                  </span>
                )
              }
            />
            {prestec.Data_fi_real && (
              <InfoRow icon={<Calendar size={14} />} label="Data retorn real" value={formatDate(prestec.Data_fi_real)} />
            )}
          </section>

          {/* Material prestat */}
          {materialItems.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <Archive size={12} /> Material inclòs
              </p>
              <div className="space-y-1.5">
                {materialItems.map((m) => (
                  <div key={m.ID} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-primary">{m.ID}</span>
                      <span className="text-sm text-gray-700">{m.Nom}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">× {m.Quantitat}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notes */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare size={12} /> Notes
              </p>
              {isCoordinador && !editNotes && (
                <button onClick={() => setEditNotes(true)} className="text-xs text-primary hover:underline">
                  {prestec.Notes ? 'Editar' : 'Afegir'}
                </button>
              )}
            </div>
            {editNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={3}
                  placeholder="Afegeix notes o comentaris..."
                  className="input resize-none text-sm w-full"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setEditNotes(false); setNotesDraft(prestec.Notes) }}
                    className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg"
                  >
                    Cancel·lar
                  </button>
                  <button
                    onClick={handleNotes}
                    disabled={saving === 'notes'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                    style={{ backgroundColor: '#861414' }}
                  >
                    {saving === 'notes' && <Loader2 size={12} className="animate-spin" />}
                    Desar
                  </button>
                </div>
              </div>
            ) : (
              <p className={`text-sm leading-relaxed ${prestec.Notes ? 'text-gray-700 bg-gray-50 rounded-lg px-3 py-2.5 whitespace-pre-wrap' : 'text-gray-400 italic'}`}>
                {prestec.Notes || 'Sense notes'}
              </p>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex justify-between items-center gap-2">
          {potEliminar ? (
            confirmEliminar ? (
              <div className="flex flex-col gap-1">
                {errorEliminar && <p className="text-xs text-red-600">{errorEliminar}</p>}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-600 font-medium">Eliminar préstec?</span>
                  <button
                    onClick={async () => {
                      setSaving('eliminar'); setErrorEliminar(null)
                      try { await onEliminar(prestec); onClose() }
                      catch (err) { setErrorEliminar(err instanceof Error ? err.message : 'Error en eliminar'); setSaving(null) }
                    }}
                    disabled={saving === 'eliminar'}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                  >
                    {saving === 'eliminar' && <Loader2 size={11} className="animate-spin" />}
                    Sí, eliminar
                  </button>
                  <button onClick={() => { setConfirmEliminar(false); setErrorEliminar(null) }}
                    className="px-2 py-1 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg">
                    Cancel·lar
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmEliminar(true)}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors">
                <Trash2 size={13} /> Eliminar
              </button>
            )
          ) : <span />}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Tancar
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <div className="text-sm text-gray-700">{value}</div>
      </div>
    </div>
  )
}
