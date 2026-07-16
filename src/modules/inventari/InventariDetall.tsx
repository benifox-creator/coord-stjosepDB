import { useState } from 'react'
import {
  X, Package, Calendar, MapPin, Hash, Cpu, Wifi,
  ChevronDown, CheckCircle, Loader2, Pencil, MessageSquare, Trash2,
} from 'lucide-react'
import { Badge } from '../../components/Badge'
import { formatDate, garantiaEstat } from './inventari.utils'
import type { ItemInventari, EstatInventari } from './types'

const ESTATS: EstatInventari[] = ['Actiu', 'En reparació', 'En préstec', 'De baixa']

interface Props {
  item: ItemInventari
  onClose: () => void
  isCoordinador?: boolean
  onCanviarEstat: (item: ItemInventari, estat: EstatInventari) => Promise<void>
  onEditarUbicacio: (item: ItemInventari, ubicacio: string) => Promise<void>
  onEditarNotes: (item: ItemInventari, notes: string) => Promise<void>
  onEditar: (item: ItemInventari) => void
  onEliminar?: (item: ItemInventari) => Promise<void>
  potEliminar?: boolean
}

export function InventariDetall({
  item,
  onClose,
  isCoordinador = false,
  onCanviarEstat,
  onEditarUbicacio,
  onEditarNotes,
  onEditar,
  onEliminar,
  potEliminar = false,
}: Props) {
  const [estatObert, setEstatObert] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  const [editUbicacio, setEditUbicacio] = useState(false)
  const [ubicacioDraft, setUbicacioDraft] = useState(item.Ubicació)

  const [editNotes, setEditNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(item.Notes)

  const gEstat = garantiaEstat(item['Garantia_fins'])

  const teXarxa = item.MAC_LAN || item.MAC_WAN || item.IP_LAN || item.IP_WAN

  async function handleCanviarEstat(estat: EstatInventari) {
    if (estat === item.Estat) { setEstatObert(false); return }
    setSaving('estat')
    try {
      await onCanviarEstat(item, estat)
    } finally {
      setSaving(null)
      setEstatObert(false)
    }
  }

  async function handleUbicacio() {
    setSaving('ubicacio')
    try {
      await onEditarUbicacio(item, ubicacioDraft)
      setEditUbicacio(false)
    } finally {
      setSaving(null)
    }
  }

  async function handleNotes() {
    setSaving('notes')
    try {
      await onEditarNotes(item, notesDraft)
      setEditNotes(false)
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
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono font-semibold text-primary">{item.ID}</span>
              <Badge label={item.Estat} variant="inventari-estat" />
              <Badge
                label={gEstat === 'vigent' ? 'vigent' : gEstat === 'caducada' ? 'caducada' : 'desconegut'}
                variant="garantia"
              />
            </div>
            <h2 className="text-sm font-semibold text-text-main leading-snug">{item.Nom}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{item.Categoria} · {item.Marca} {item.Model}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Contingut */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Estat */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Estat</p>
            <div className="relative">
              <button
                onClick={() => setEstatObert((o) => !o)}
                disabled={!isCoordinador || saving === 'estat'}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors w-full justify-between disabled:cursor-default"
              >
                <div className="flex items-center gap-2">
                  {saving === 'estat' && <Loader2 size={14} className="animate-spin text-gray-400" />}
                  <Badge label={item.Estat} variant="inventari-estat" />
                </div>
                {isCoordinador && (
                  <ChevronDown size={15} className={`text-gray-400 transition-transform ${estatObert ? 'rotate-180' : ''}`} />
                )}
              </button>
              {estatObert && isCoordinador && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                  {ESTATS.map((e) => (
                    <button
                      key={e}
                      onClick={() => handleCanviarEstat(e)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${e === item.Estat ? 'bg-gray-50' : ''}`}
                    >
                      <Badge label={e} variant="inventari-estat" />
                      {e === item.Estat && <CheckCircle size={14} className="ml-auto text-gray-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Identificació */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Identificació</p>
            <InfoRow icon={<Package size={14} />} label="Categoria" value={item.Categoria} />
            <InfoRow icon={<Cpu size={14} />} label="Marca / Model" value={`${item.Marca} ${item.Model}`} />
            {item['Núm_sèrie'] && (
              <InfoRow icon={<Hash size={14} />} label="Núm. sèrie" value={item['Núm_sèrie']} />
            )}
          </section>

          {/* Ubicació */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ubicació</p>
            {isCoordinador ? (
              editUbicacio ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ubicacioDraft}
                    onChange={(e) => setUbicacioDraft(e.target.value)}
                    placeholder="Ex: Aula 55"
                    className="input text-sm flex-1"
                    autoFocus
                  />
                  <button
                    onClick={handleUbicacio}
                    disabled={saving === 'ubicacio'}
                    className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 shrink-0"
                    style={{ backgroundColor: '#861414' }}
                  >
                    {saving === 'ubicacio' ? <Loader2 size={13} className="animate-spin" /> : 'Desar'}
                  </button>
                  <button
                    onClick={() => { setEditUbicacio(false); setUbicacioDraft(item.Ubicació) }}
                    className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditUbicacio(true)}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary transition-colors group"
                >
                  <MapPin size={14} className="text-gray-400 group-hover:text-primary shrink-0" />
                  {item.Ubicació || <span className="text-gray-400 italic">Sense ubicació — clic per editar</span>}
                  <Pencil size={11} className="text-gray-300 group-hover:text-primary ml-1" />
                </button>
              )
            ) : (
              <p className="text-sm text-gray-700 flex items-center gap-2">
                <MapPin size={14} className="text-gray-400 shrink-0" />
                {item.Ubicació || <span className="text-gray-400 italic">Sense ubicació</span>}
              </p>
            )}
          </section>

          {/* Dates */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Dates</p>
            {item['Data_compra'] && (
              <InfoRow icon={<Calendar size={14} />} label="Data de compra" value={formatDate(item['Data_compra'])} />
            )}
            <InfoRow
              icon={<Calendar size={14} />}
              label="Garantia fins"
              value={
                item['Garantia_fins'] ? (
                  <span className="flex items-center gap-2 flex-wrap">
                    <span>{formatDate(item['Garantia_fins'])}</span>
                    <Badge
                      label={gEstat === 'vigent' ? 'vigent' : gEstat === 'caducada' ? 'caducada' : 'desconegut'}
                      variant="garantia"
                    />
                  </span>
                ) : (
                  <span className="text-gray-400 italic">No registrada</span>
                )
              }
            />
          </section>

          {/* Xarxa */}
          {teXarxa && (
            <section className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <Wifi size={12} /> Xarxa
              </p>
              {item.MAC_LAN && <InfoRow icon={<Wifi size={14} />} label="MAC LAN" value={<code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{item.MAC_LAN}</code>} />}
              {item.MAC_WAN && <InfoRow icon={<Wifi size={14} />} label="MAC WAN" value={<code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{item.MAC_WAN}</code>} />}
              {item.IP_LAN && <InfoRow icon={<Wifi size={14} />} label="IP LAN" value={<code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{item.IP_LAN}</code>} />}
              {item.IP_WAN && <InfoRow icon={<Wifi size={14} />} label="IP WAN" value={<code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{item.IP_WAN}</code>} />}
            </section>
          )}

          {/* Notes */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare size={12} /> Notes
              </p>
              {isCoordinador && !editNotes && (
                <button
                  onClick={() => setEditNotes(true)}
                  className="text-xs text-primary hover:underline"
                >
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
                  placeholder="Observacions, incidències passades, manteniment..."
                  className="input resize-none text-sm w-full"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setEditNotes(false); setNotesDraft(item.Notes) }}
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
              <p className={`text-sm leading-relaxed ${item.Notes ? 'text-gray-700 bg-gray-50 rounded-lg px-3 py-2.5 whitespace-pre-wrap' : 'text-gray-400 italic'}`}>
                {item.Notes || 'Sense notes'}
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
                  <span className="text-xs text-red-600 font-medium">Eliminar dispositiu?</span>
                  <button
                    onClick={async () => {
                      setSaving('eliminar'); setErrorEliminar(null)
                      try { await onEliminar(item); onClose() }
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
          ) : <span />}
          <div className="flex items-center gap-2">
            {isCoordinador && (
              <button
                onClick={() => onEditar(item)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#861414' }}
              >
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
