import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { getAll } from '../../services/db'
import { dataTrasladada, TAULA_EXCURSIONS, type ExcursioRow } from './excursions.utils'

interface Props {
  cursOrigen: string
  cursDesti: string
  onCopiar: (cursOrigen: string, ids: string[]) => Promise<void>
  onClose: () => void
}

export function CopiarCursAnterior({ cursOrigen, cursDesti, onCopiar, onClose }: Props) {
  const [files, setFiles] = useState<ExcursioRow[] | null>(null)
  const [triades, setTriades] = useState<string[]>([])
  const [copiant, setCopiant] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let viu = true
    getAll<ExcursioRow>(TAULA_EXCURSIONS, 'data', { curs_escolar: cursOrigen })
      .then((f) => {
        if (!viu) return
        // Les cancel·lades no es repeteixen: si es va anul·lar, no és un patró
        // que calgui tornar a proposar.
        const utils = f.filter((x) => x.estat !== 'Cancel·lada')
        setFiles(utils)
        setTriades(utils.map((x) => x.id))
      })
      .catch((err) => { if (viu) setError(err instanceof Error ? err.message : 'Error carregant el curs anterior') })
    return () => { viu = false }
  }, [cursOrigen])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-text-main">Copia les excursions del curs {cursOrigen}</h2>
          <button onClick={onClose} disabled={copiant} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {!files && !error && <p className="text-xs text-gray-400">Carregant…</p>}
          {files?.length === 0 && (
            <p className="text-sm text-gray-400 italic">El curs {cursOrigen} no té cap excursió per copiar.</p>
          )}
          {files && files.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Es crearan com a esborranys al curs {cursDesti}, amb les dates un any més tard i els mateixos grups.
                El responsable i els acompanyants no es copien.
              </p>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {files.map((f) => (
                  <label key={f.id} className="flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={triades.includes(f.id)}
                      onChange={(e) => setTriades((s) => e.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id))}
                    />
                    <span className="text-gray-400 w-24 shrink-0">{dataTrasladada(f.data, cursOrigen, cursDesti) ?? 'sense data'}</span>
                    <span className="w-20 shrink-0">{f.etapa}</span>
                    <span className="flex-1 text-text-main truncate">{f.activitat || f.lloc}</span>
                    <span className="text-gray-400 truncate">{f.lloc}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} disabled={copiant} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel·la
          </button>
          <button
            disabled={copiant || triades.length === 0}
            onClick={async () => {
              setCopiant(true)
              setError('')
              try {
                await onCopiar(cursOrigen, triades)
                onClose()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No s’han pogut copiar.')
                setCopiant(false)
              }
            }}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#861414' }}
          >
            {copiant && <Loader2 size={15} className="animate-spin" />}
            Copia{triades.length > 0 ? ` ${triades.length}` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
