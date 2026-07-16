import { useState } from 'react'
import {
  X, User, Mail, Calendar, Clock, MapPin,
  ChevronDown, CheckCircle, Loader2, FileText, Trash2, Pencil,
} from 'lucide-react'
import { formatDate, formatTime, isDiaAvui } from './reserves.utils'
import type { Reserva, EstatReserva } from './types'

const ESTATS: EstatReserva[] = ['Pendent', 'Confirmada', 'Cancel·lada']

const ESTAT_COLORS: Record<EstatReserva, string> = {
  Pendent: 'bg-amber-100 text-amber-700 border-amber-200',
  Confirmada: 'bg-green-100 text-green-700 border-green-200',
  'Cancel·lada': 'bg-gray-100 text-gray-500 border-gray-200',
}

function EstatBadge({ estat }: { estat: EstatReserva }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${ESTAT_COLORS[estat]}`}>
      {estat}
    </span>
  )
}

interface Props {
  reserva: Reserva
  onClose: () => void
  isCoordinador?: boolean
  potEliminar?: boolean
  onCanviarEstat: (reserva: Reserva, estat: EstatReserva) => Promise<void>
  onEditar: (reserva: Reserva) => void
  onEliminar: (reserva: Reserva) => Promise<void>
}

export function ReservaDetall({
  reserva,
  onClose,
  isCoordinador = false,
  potEliminar = false,
  onCanviarEstat,
  onEditar,
  onEliminar,
}: Props) {
  const [estatObert, setEstatObert] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  const esAvui = isDiaAvui(reserva.Data)

  async function handleCanviarEstat(nouEstat: EstatReserva) {
    if (nouEstat === reserva.Estat) { setEstatObert(false); return }
    setSaving('estat')
    try {
      await onCanviarEstat(reserva, nouEstat)
    } finally {
      setSaving(null)
      setEstatObert(false)
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
              <span className="text-xs font-mono font-semibold text-primary">{reserva.ID}</span>
              <EstatBadge estat={reserva.Estat} />
              {esAvui && reserva.Estat !== 'Cancel·lada' && (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Avui</span>
              )}
            </div>
            <h2 className="text-sm font-semibold text-text-main leading-snug flex items-center gap-1.5">
              <MapPin size={13} className="text-primary shrink-0" />
              {reserva.Espai}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{reserva.Usuari}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Estat */}
          {isCoordinador && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Estat</p>
              <div className="relative">
                <button
                  onClick={() => setEstatObert((o) => !o)}
                  disabled={saving === 'estat'}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors w-full justify-between disabled:cursor-default disabled:opacity-70"
                >
                  <div className="flex items-center gap-2">
                    {saving === 'estat' && <Loader2 size={14} className="animate-spin text-gray-400" />}
                    <EstatBadge estat={reserva.Estat} />
                  </div>
                  <ChevronDown size={15} className={`text-gray-400 transition-transform ${estatObert ? 'rotate-180' : ''}`} />
                </button>
                {estatObert && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                    {ESTATS.map((e) => (
                      <button
                        key={e}
                        onClick={() => handleCanviarEstat(e)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${e === reserva.Estat ? 'bg-gray-50' : ''}`}
                      >
                        <EstatBadge estat={e} />
                        {e === reserva.Estat && <CheckCircle size={14} className="ml-auto text-gray-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dreceres d'estat */}
              {reserva.Estat === 'Pendent' && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleCanviarEstat('Confirmada')}
                    disabled={saving === 'estat'}
                    className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-800 transition-colors disabled:opacity-50"
                  >
                    {saving === 'estat' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    Confirmar reserva
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    onClick={() => handleCanviarEstat('Cancel·lada')}
                    disabled={saving === 'estat'}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                  >
                    Cancel·lar reserva
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Espai */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Espai</p>
            <InfoRow
              icon={<MapPin size={14} />}
              label="Sala / Espai"
              value={<span className="font-medium">{reserva.Espai}</span>}
            />
          </section>

          {/* Data i hora */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Data i hora</p>
            <InfoRow
              icon={<Calendar size={14} />}
              label="Data"
              value={
                <span className="flex items-center gap-2">
                  {formatDate(reserva.Data)}
                  {esAvui && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Avui</span>}
                </span>
              }
            />
            <InfoRow
              icon={<Clock size={14} />}
              label="Horari"
              value={
                <span className="font-medium text-text-main">
                  {formatTime(reserva.Hora_inici)} – {formatTime(reserva.Hora_fi)}
                </span>
              }
            />
          </section>

          {/* Usuari */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Responsable</p>
            <InfoRow icon={<User size={14} />} label="Nom" value={reserva.Usuari || '—'} />
            {reserva.Email && (
              <InfoRow icon={<Mail size={14} />} label="Correu" value={
                <a href={`mailto:${reserva.Email}`} className="text-primary hover:underline">
                  {reserva.Email}
                </a>
              } />
            )}
          </section>

          {/* Motiu */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <FileText size={12} /> Motiu
            </p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2.5 leading-relaxed whitespace-pre-wrap">
              {reserva.Motiu || <span className="text-gray-400 italic">Sense motiu</span>}
            </p>
          </section>

          {/* Metadades */}
          {reserva.Creat_el && (
            <p className="text-xs text-gray-400">Creada: {reserva.Creat_el}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex justify-between items-center gap-2">
          {potEliminar ? (
            confirmEliminar ? (
              <div className="flex flex-col gap-1">
                {errorEliminar && <p className="text-xs text-red-600">{errorEliminar}</p>}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-600 font-medium">Eliminar reserva?</span>
                  <button
                    onClick={async () => {
                      setSaving('eliminar'); setErrorEliminar(null)
                      try { await onEliminar(reserva); onClose() }
                      catch (err) { setErrorEliminar(err instanceof Error ? err.message : 'Error en eliminar'); setSaving(null) }
                    }}
                    disabled={saving === 'eliminar'}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                  >
                    {saving === 'eliminar' && <Loader2 size={11} className="animate-spin" />}
                    Sí
                  </button>
                  <button onClick={() => { setConfirmEliminar(false); setErrorEliminar(null) }}
                    className="px-2 py-1 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg">
                    No
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

          <div className="flex items-center gap-2">
            {isCoordinador && !confirmEliminar && (
              <button
                onClick={() => onEditar(reserva)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Pencil size={14} /> Editar
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Tancar
            </button>
          </div>
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
