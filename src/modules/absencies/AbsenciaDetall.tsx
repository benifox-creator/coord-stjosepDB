import { useState } from 'react'
import { X, Check, XCircle, Trash2, ClipboardPlus } from 'lucide-react'
import type { Absencia } from './types'
import { formatDate } from '../substitucions/substitucions.utils'
import { useUsuarisStore } from '../../store/usuarisStore'

const ESTAT_COLORS: Record<Absencia['Estat'], string> = {
  'Pendent revisió': 'text-amber-700 bg-amber-100 border-amber-200',
  'Aprovada': 'text-green-700 bg-green-100 border-green-200',
  'Rebutjada': 'text-red-700 bg-red-100 border-red-200',
}

interface Props {
  absencia: Absencia
  potAprovar: boolean
  potGestionar: boolean
  potEliminar: boolean
  onClose: () => void
  onAprovar: (a: Absencia) => Promise<void>
  onRebutjar: (a: Absencia, motiu: string) => Promise<void>
  onEliminar: (a: Absencia) => Promise<void>
  onCrearSubstitucio: (a: Absencia) => void
}

export function AbsenciaDetall({
  absencia, potAprovar, potGestionar, potEliminar,
  onClose, onAprovar, onRebutjar, onEliminar, onCrearSubstitucio,
}: Props) {
  const usuaris = useUsuarisStore((s) => s.usuaris)
  const nomProfessor = usuaris.find((u) => u.Email === absencia.Professor)?.Nom || absencia.Professor
  const [rebutjant, setRebutjant] = useState(false)
  const [motiuRebuig, setMotiuRebuig] = useState('')
  const [working, setWorking] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [eliminant, setEliminant] = useState(false)

  async function handleAprovar() {
    setWorking(true)
    try {
      await onAprovar(absencia)
    } finally {
      setWorking(false)
    }
  }

  async function handleRebutjar() {
    setWorking(true)
    try {
      await onRebutjar(absencia, motiuRebuig.trim())
    } finally {
      setWorking(false)
      setRebutjant(false)
    }
  }

  async function handleEliminarClick() {
    setEliminant(true)
    try {
      await onEliminar(absencia)
      onClose()
    } catch {
      setEliminant(false)
      setConfirmEliminar(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={() => { if (!working) onClose() }} />
      <div className="relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-text-main">Absència — {absencia.ID}</h2>
          <button onClick={() => { if (!working) onClose() }} disabled={working} className="text-gray-400 hover:text-gray-600 disabled:opacity-60">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${ESTAT_COLORS[absencia.Estat]}`}>
            {absencia.Estat}
          </span>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-gray-400">Professor</p><p className="text-text-main font-medium">{nomProfessor}</p></div>
            <div><p className="text-gray-400">Data</p><p className="text-text-main font-medium">{formatDate(absencia.Data)}</p></div>
            <div><p className="text-gray-400">Horari</p><p className="text-text-main font-medium">{absencia.HoraInici}–{absencia.HoraFi}</p></div>
            <div><p className="text-gray-400">Hores</p><p className="text-text-main font-medium">{absencia.Hores.toString().replace('.', ',')}</p></div>
            <div className="col-span-2"><p className="text-gray-400">Motiu</p><p className="text-text-main font-medium">{absencia.Motiu}</p></div>
          </div>

          {absencia.Notes && (
            <div><p className="text-xs text-gray-400 mb-1">Notes</p><p className="text-text-main">{absencia.Notes}</p></div>
          )}

          {absencia.Estat === 'Rebutjada' && absencia.MotiuRebuig && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              Motiu del rebuig: {absencia.MotiuRebuig}
            </div>
          )}

          {rebutjant && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">Motiu del rebuig (opcional)</label>
              <textarea
                value={motiuRebuig}
                onChange={(e) => setMotiuRebuig(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 shrink-0 flex flex-col gap-2">
          {absencia.Estat === 'Pendent revisió' && potAprovar && !rebutjant && (
            <div className="flex gap-2">
              <button
                onClick={() => setRebutjant(true)}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <XCircle size={15} /> Rebutja
              </button>
              <button
                onClick={handleAprovar}
                disabled={working}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 bg-green-600 hover:bg-green-700"
              >
                <Check size={15} /> Aprova
              </button>
            </div>
          )}

          {rebutjant && (
            <div className="flex gap-2">
              <button
                onClick={() => setRebutjant(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel·la
              </button>
              <button
                onClick={handleRebutjar}
                disabled={working}
                className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 bg-red-600 hover:bg-red-700"
              >
                Confirma el rebuig
              </button>
            </div>
          )}

          {absencia.Estat === 'Aprovada' && potGestionar && (
            <button
              onClick={() => onCrearSubstitucio(absencia)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg"
              style={{ backgroundColor: '#861414' }}
            >
              <ClipboardPlus size={15} /> Crea la substitució
            </button>
          )}

          {potEliminar && (
            confirmEliminar ? (
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-red-600 font-medium">Eliminar aquesta absència?</span>
                <button
                  onClick={handleEliminarClick}
                  disabled={eliminant}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-60"
                >
                  Sí, elimina
                </button>
                <button
                  onClick={() => setConfirmEliminar(false)}
                  disabled={eliminant}
                  className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-60"
                >
                  Cancel·la
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmEliminar(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-500 hover:text-red-600"
              >
                <Trash2 size={13} /> Elimina
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
