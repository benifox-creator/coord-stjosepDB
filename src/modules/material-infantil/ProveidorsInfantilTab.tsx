import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Trash2, Loader2 } from 'lucide-react'
import { useProveidorsInfantil } from './useProveidorsInfantil'
import { ProveidorInfantilForm } from './ProveidorInfantilForm'
import type { ProveidorInfantil } from './types'

interface Props {
  potGestionar: boolean
}

export function ProveidorsInfantilTab({ potGestionar }: Props) {
  const { proveidors, loading, error, load, crear, editar, eliminar } = useProveidorsInfantil()
  const [cerca, setCerca] = useState('')
  const [formObert, setFormObert] = useState(false)
  const [editant, setEditant] = useState<ProveidorInfantil | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null)
  const [eliminant, setEliminant] = useState(false)

  useEffect(() => { load() }, [load])

  const filtrats = useMemo(() => {
    const q = cerca.toLowerCase()
    return proveidors
      .filter((p) => !q || `${p.Nom} ${p.Contacte} ${p.Email}`.toLowerCase().includes(q))
      .sort((a, b) => a.Nom.localeCompare(b.Nom))
  }, [proveidors, cerca])

  async function handleEliminar(p: ProveidorInfantil) {
    setEliminant(true)
    try {
      await eliminar(p)
      setConfirmEliminar(null)
    } catch (err) {
      useProveidorsInfantil.setState({ error: err instanceof Error ? err.message : 'Error eliminant el proveïdor' })
    } finally {
      setEliminant(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cercar proveïdor..."
            className="input pl-8 text-sm w-full"
          />
        </div>
        {potGestionar && (
          <button
            onClick={() => setFormObert(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
            style={{ backgroundColor: '#861414' }}
          >
            <Plus size={14} /> Nou proveïdor
          </button>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        {!loading && filtrats.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            {proveidors.length === 0 ? 'Encara no hi ha proveïdors registrats.' : 'Cap proveïdor coincideix amb la cerca.'}
          </p>
        )}
        <div className="space-y-2">
          {filtrats.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg p-3">
              <div
                className={`min-w-0 flex-1 ${potGestionar ? 'cursor-pointer' : ''}`}
                onClick={() => potGestionar && setEditant(p)}
              >
                <p className="text-sm font-medium text-text-main">{p.Nom}</p>
                <p className="text-xs text-gray-400 truncate">
                  {[p.Contacte, p.Email, p.Telefon, p.TerminiLliurament].filter(Boolean).join(' · ') || 'Sense dades de contacte'}
                </p>
              </div>
              {potGestionar && (
                confirmEliminar === p.id ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleEliminar(p)}
                      disabled={eliminant}
                      className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded disabled:opacity-60"
                    >
                      {eliminant ? <Loader2 size={12} className="animate-spin" /> : 'Sí'}
                    </button>
                    <button
                      onClick={() => setConfirmEliminar(null)}
                      disabled={eliminant}
                      className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded disabled:opacity-60"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmEliminar(p.id)} className="text-gray-400 hover:text-red-600 shrink-0">
                    <Trash2 size={14} />
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {formObert && (
        <ProveidorInfantilForm onClose={() => setFormObert(false)} onGuardar={crear} />
      )}
      {editant && (
        <ProveidorInfantilForm
          inicial={{
            Nom: editant.Nom, Contacte: editant.Contacte, Email: editant.Email,
            Telefon: editant.Telefon, Web: editant.Web, TerminiLliurament: editant.TerminiLliurament, Notes: editant.Notes,
          }}
          onClose={() => setEditant(null)}
          onGuardar={(data) => editar(editant, data)}
        />
      )}
    </div>
  )
}
