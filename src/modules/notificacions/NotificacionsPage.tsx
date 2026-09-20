import { useMemo, useState } from 'react'
import { RefreshCw, RotateCcw, Ban, ChevronDown } from 'lucide-react'
import type { Notificacio } from './types'
import { ESTATS_NOTIFICACIO, ESTAT_LABELS, ESTAT_COLORS } from './types'
import { potReintentar, potCancellar, quan } from './notificacions.utils'

interface Props {
  notificacions: Notificacio[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onReintentar: (id: string) => Promise<void>
  onCancellar: (id: string) => Promise<void>
}

export function NotificacionsPage({ notificacions, loading, error, onRefresh, onReintentar, onCancellar }: Props) {
  const [estat, setEstat] = useState('')
  const [obert, setObert] = useState<string | null>(null)
  const [ocupat, setOcupat] = useState<string | null>(null)
  const [errorAccio, setErrorAccio] = useState('')

  const visibles = useMemo(
    () => notificacions.filter((n) => !estat || n.Estat === estat),
    [notificacions, estat],
  )

  const resum = useMemo(() => {
    const r: Record<string, number> = {}
    for (const n of notificacions) r[n.Estat] = (r[n.Estat] ?? 0) + 1
    return r
  }, [notificacions])

  async function fes(id: string, accio: (id: string) => Promise<void>) {
    setOcupat(id)
    setErrorAccio('')
    try {
      await accio(id)
    } catch (err) {
      setErrorAccio(err instanceof Error ? err.message : 'No s’ha pogut fer.')
    } finally {
      setOcupat(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-text-main">Correus</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {(resum.failed ?? 0) > 0
                ? `${resum.failed} ${resum.failed === 1 ? 'ha fallat' : 'han fallat'}`
                : (resum.pending ?? 0) > 0
                  ? `${resum.pending} a la cua`
                  : 'Res pendent'}
            </p>
          </div>
          <button onClick={onRefresh} className="p-2 text-gray-400 hover:text-gray-600" aria-label="Actualitza">
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <select
            value={estat}
            onChange={(e) => setEstat(e.target.value)}
            aria-label="Filtra per estat"
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
          >
            <option value="">Tots els estats</option>
            {ESTATS_NOTIFICACIO.map((e) => (
              <option key={e} value={e}>{ESTAT_LABELS[e]}{resum[e] ? ` (${resum[e]})` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading && <p className="text-xs text-gray-400">Carregant…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {errorAccio && <p className="text-xs text-red-600 mb-2">{errorAccio}</p>}
        {!loading && !error && visibles.length === 0 && (
          <p className="text-sm text-gray-400 italic">Cap correu amb aquest filtre.</p>
        )}

        <div className="space-y-2">
          {visibles.map((n) => (
            <div key={n.id} className="bg-white border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className={`px-2 py-0.5 text-xs rounded-full shrink-0 ${ESTAT_COLORS[n.Estat]}`}>
                  {ESTAT_LABELS[n.Estat]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-main truncate">{n.Assumpte}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {n.Destinatari} · {quan(n.CreatEl)}
                    {n.Intents > 0 && ` · ${n.Intents} ${n.Intents === 1 ? 'intent' : 'intents'}`}
                    {n.EnviatEl && ` · enviat ${quan(n.EnviatEl)}`}
                  </p>
                </div>
                {potReintentar(n) && (
                  <button
                    onClick={() => fes(n.id, onReintentar)}
                    disabled={ocupat === n.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg disabled:opacity-50"
                  >
                    <RotateCcw size={12} /> Reintenta
                  </button>
                )}
                {potCancellar(n) && (
                  <button
                    onClick={() => fes(n.id, onCancellar)}
                    disabled={ocupat === n.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 disabled:opacity-50"
                  >
                    <Ban size={12} /> Cancel·la
                  </button>
                )}
                <button
                  onClick={() => setObert(obert === n.id ? null : n.id)}
                  aria-label={`Detall de ${n.Assumpte}`}
                  className="p-1 text-gray-300 hover:text-gray-500"
                >
                  <ChevronDown size={16} className={obert === n.id ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
              </div>
              {obert === n.id && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-2 text-xs">
                  {n.UltimError && (
                    <p className="text-red-600">
                      <span className="font-medium">Error:</span> {n.UltimError}
                    </p>
                  )}
                  {n.Estat === 'failed' && n.ProperIntent && (
                    <p className="text-gray-500">Proper intent: {quan(n.ProperIntent)}</p>
                  )}
                  <p className="text-gray-400">Generat per {n.CreatPer}</p>
                  <p className="text-gray-600 whitespace-pre-wrap">{n.Cos}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
