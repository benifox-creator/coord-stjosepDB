import { useState } from 'react'
import {
  X, Monitor, Calendar, User, MessageSquare,
  Clock, ChevronDown, CheckCircle, Loader2, Mail, Trash2,
} from 'lucide-react'
import { Badge } from '../../components/Badge'
import { formatDatetime, formatDate, calcularDiesOberts } from './incidencies.utils'
import type { Incidencia, EstatIncidencia } from './types'

const ESTATS: EstatIncidencia[] = ['Oberta', 'En curs', 'Tancada']

interface Props {
  incidencia: Incidencia
  onClose: () => void
  isCoordinador?: boolean
  onCanviarEstat: (inc: Incidencia, estat: EstatIncidencia) => Promise<{ emailEnviat?: boolean }>
  onAssignar: (inc: Incidencia, assignat: string) => Promise<void>
  onEditarComentaris: (inc: Incidencia, comentaris: string) => Promise<void>
  onEliminar?: (inc: Incidencia) => Promise<void>
  potEliminar?: boolean
}

export function IncidenciaDetall({
  incidencia: inc,
  onClose,
  isCoordinador = false,
  onCanviarEstat,
  onAssignar,
  onEditarComentaris,
  onEliminar,
  potEliminar = false,
}: Props) {
  const [estatObert, setEstatObert] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  const [editAssignat, setEditAssignat] = useState(false)
  const [assignatDraft, setAssignatDraft] = useState(inc['Assignat a'])

  const [editComentaris, setEditComentaris] = useState(false)
  const [comentarisDraft, setComentarisDraft] = useState(inc.Comentaris)

  const [bannerTancat, setBannerTancat] = useState<'enviat' | 'pendent' | null>(null)

  const diesOberts = calcularDiesOberts(inc['Marca de temps'], inc['Data Resolució'])

  async function handleCanviarEstat(estat: EstatIncidencia) {
    if (estat === inc.Estat) { setEstatObert(false); return }
    setSaving('estat')
    try {
      const result = await onCanviarEstat(inc, estat)
      if (estat === 'Tancada') {
        setBannerTancat(result.emailEnviat ? 'enviat' : 'pendent')
      }
    } finally {
      setSaving(null)
      setEstatObert(false)
    }
  }

  async function handleAssignar() {
    setSaving('assignat')
    try {
      await onAssignar(inc, assignatDraft)
      setEditAssignat(false)
    } finally {
      setSaving(null)
    }
  }

  async function handleComentaris() {
    setSaving('comentaris')
    try {
      await onEditarComentaris(inc, comentarisDraft)
      setEditComentaris(false)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panell lateral */}
      <div className="relative bg-white w-full max-w-md flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-200 bg-white">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold text-primary">{inc.Ticket}</span>
              <Badge label={inc.Estat} variant="estat" />
              <Badge label={inc.Prioritat} variant="prioritat" />
            </div>
            <h2 className="text-sm font-semibold text-text-main leading-snug">
              {inc['Tipus de problema']}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{inc.Localització}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Banner notificació (quan es tanca) */}
        {bannerTancat === 'enviat' && (
          <div className="mx-4 mt-3 flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
            <Mail size={15} className="text-green-600 mt-0.5 shrink-0" />
            <p className="text-xs text-green-700">
              Incidència tancada. S'ha enviat un correu de resolució a <span className="font-semibold">{inc.Reporter}</span>.
            </p>
            <button onClick={() => setBannerTancat(null)} className="ml-auto text-green-400 hover:text-green-600">
              <X size={14} />
            </button>
          </div>
        )}
        {bannerTancat === 'pendent' && (
          <div className="mx-4 mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <Mail size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              Incidència tancada. No s'ha pogut enviar el correu a <span className="font-semibold">{inc.Reporter}</span>. Pots reintentar-ho manualment.
            </p>
            <button onClick={() => setBannerTancat(null)} className="ml-auto text-amber-400 hover:text-amber-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Contingut */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Canvi d'estat */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Estat</p>
            <div className="relative">
              <button
                onClick={() => setEstatObert((o) => !o)}
                disabled={saving === 'estat'}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors w-full justify-between"
              >
                <div className="flex items-center gap-2">
                  {saving === 'estat' && <Loader2 size={14} className="animate-spin text-gray-400" />}
                  <Badge label={inc.Estat} variant="estat" />
                </div>
                <ChevronDown size={15} className={`text-gray-400 transition-transform ${estatObert ? 'rotate-180' : ''}`} />
              </button>
              {estatObert && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                  {ESTATS.map((e) => (
                    <button
                      key={e}
                      onClick={() => handleCanviarEstat(e)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${e === inc.Estat ? 'bg-gray-50' : ''}`}
                    >
                      <Badge label={e} variant="estat" />
                      {e === inc.Estat && <CheckCircle size={14} className="ml-auto text-gray-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Informació */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Informació</p>

            <InfoRow icon={<Monitor size={14} />} label="Dispositiu" value={inc.Dispositiu || '—'} />
            <InfoRow icon={<Calendar size={14} />} label="Creat el" value={formatDatetime(inc['Marca de temps'])} />
            <InfoRow
              icon={<Clock size={14} />}
              label="Dies obert"
              value={
                <span className={inc.Estat !== 'Tancada' ? 'font-semibold text-amber-600' : 'text-gray-600'}>
                  {diesOberts} {Number(diesOberts) === 1 ? 'dia' : 'dies'}
                </span>
              }
            />
            {inc['Data Resolució'] && (
              <InfoRow icon={<CheckCircle size={14} />} label="Tancat el" value={formatDate(inc['Data Resolució'])} />
            )}
            <InfoRow icon={<User size={14} />} label="Reporter" value={inc.Reporter || '—'} />
          </section>

          {/* Assignació */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Assignat a</p>
            {isCoordinador ? (
              editAssignat ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={assignatDraft}
                    onChange={(e) => setAssignatDraft(e.target.value)}
                    placeholder="email@stjosep.org"
                    className="input text-sm flex-1"
                    autoFocus
                  />
                  <button
                    onClick={handleAssignar}
                    disabled={saving === 'assignat'}
                    className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 shrink-0"
                    style={{ backgroundColor: '#861414' }}
                  >
                    {saving === 'assignat' ? <Loader2 size={13} className="animate-spin" /> : 'Desar'}
                  </button>
                  <button
                    onClick={() => { setEditAssignat(false); setAssignatDraft(inc['Assignat a']) }}
                    className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditAssignat(true)}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary transition-colors group"
                >
                  <User size={14} className="text-gray-400 group-hover:text-primary" />
                  {inc['Assignat a'] || <span className="text-gray-400 italic">Sense assignar — clic per editar</span>}
                </button>
              )
            ) : (
              <p className="text-sm text-gray-700 flex items-center gap-2">
                <User size={14} className="text-gray-400" />
                {inc['Assignat a'] || <span className="text-gray-400 italic">Sense assignar</span>}
              </p>
            )}
          </section>

          {/* Descripció */}
          {inc['Descripció detallada'] && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Descripció</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2.5 leading-relaxed">
                {inc['Descripció detallada']}
              </p>
            </section>
          )}

          {/* Comentaris */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare size={12} /> Comentaris
              </p>
              {!editComentaris && (
                <button
                  onClick={() => setEditComentaris(true)}
                  className="text-xs text-primary hover:underline"
                >
                  {inc.Comentaris ? 'Editar' : 'Afegir'}
                </button>
              )}
            </div>
            {editComentaris ? (
              <div className="space-y-2">
                <textarea
                  value={comentarisDraft}
                  onChange={(e) => setComentarisDraft(e.target.value)}
                  rows={3}
                  placeholder="Afegeix notes o comentaris..."
                  className="input resize-none text-sm w-full"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setEditComentaris(false); setComentarisDraft(inc.Comentaris) }}
                    className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg"
                  >
                    Cancel·lar
                  </button>
                  <button
                    onClick={handleComentaris}
                    disabled={saving === 'comentaris'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                    style={{ backgroundColor: '#861414' }}
                  >
                    {saving === 'comentaris' && <Loader2 size={12} className="animate-spin" />}
                    Desar
                  </button>
                </div>
              </div>
            ) : (
              <p className={`text-sm leading-relaxed ${inc.Comentaris ? 'text-gray-700 bg-gray-50 rounded-lg px-3 py-2.5 whitespace-pre-wrap' : 'text-gray-400 italic'}`}>
                {inc.Comentaris || 'Sense comentaris'}
              </p>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex justify-between items-center gap-2">
          {potEliminar && onEliminar ? (
            confirmEliminar ? (
              <div className="flex flex-col gap-1">
                {errorEliminar && <p className="text-xs text-red-600">{errorEliminar}</p>}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-600 font-medium">Eliminar incidència?</span>
                  <button
                    onClick={async () => {
                      setSaving('eliminar'); setErrorEliminar(null)
                      try { await onEliminar(inc); onClose() }
                      catch (err) { setErrorEliminar(err instanceof Error ? err.message : 'Error en eliminar'); setSaving(null) }
                    }}
                    disabled={saving === 'eliminar'}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                  >
                    {saving === 'eliminar' && <Loader2 size={11} className="animate-spin" />} Sí
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
          ) : (
            <span className="text-xs text-gray-400">
              {inc.Notificat === 'true' ? '✓ Notificat' : inc.Notificat === 'pending' ? '⏳ Pendent de notificar' : ''}
            </span>
          )}
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
            Tancar
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  icon, label, value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
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
