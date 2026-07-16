import { useState, useMemo } from 'react'
import { Plus, RefreshCw, LayoutGrid, List, FolderKanban, Trash2, Loader2 } from 'lucide-react'
import type { Projecte, Tasca } from './types'
import { progressPercent, formatDate } from './pla-accio.utils'
import { KanbanView } from './KanbanView'
import { LlistaView } from './LlistaView'

type Tab = 'kanban' | 'llista'

const ESTAT_PROJECTE_COLORS: Record<string, string> = {
  Actiu:     'text-green-600 bg-green-100',
  Completat: 'text-gray-500 bg-gray-100',
  Arxivat:   'text-amber-600 bg-amber-100',
}

interface Props {
  projectes: Projecte[]
  tasques: Tasca[]
  loading: boolean
  error: string | null
  canGestionar: boolean
  onRefresh: () => void
  onNouProjecte: () => void
  onEditarProjecte: (p: Projecte) => void
  onEliminarProjecte: (p: Projecte) => Promise<void>
  onNovaTasca: (projecteId?: string) => void
  onVeureTasca: (t: Tasca) => void
}

export function PlaAccioPage({
  projectes, tasques, loading, error, canGestionar,
  onRefresh, onNouProjecte, onEditarProjecte, onEliminarProjecte, onNovaTasca, onVeureTasca,
}: Props) {
  const [tab, setTab] = useState<Tab>('kanban')
  const [projecteFiltre, setProjecteFiltre] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [eliminant, setEliminant] = useState(false)

  const stats = useMemo(() => ({
    pendents:    tasques.filter((t) => t.Estat === 'Pendent').length,
    enCurs:     tasques.filter((t) => t.Estat === 'En curs').length,
    completades: tasques.filter((t) => t.Estat === 'Completada').length,
    bloquejades: tasques.filter((t) => t.Estat === 'Bloquejada').length,
  }), [tasques])

  const projectesActius = projectes.filter((p) => p.Estat === 'Actiu').length

  return (
    <div className="flex flex-col gap-6 p-6 bg-surface min-h-full">

      {/* Capçalera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-main">Pla d'Acció</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {projectesActius} projecte{projectesActius !== 1 ? 's' : ''} actiu{projectesActius !== 1 ? 's' : ''} · {tasques.length} tasques
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          {canGestionar && (
            <>
              <button
                onClick={() => onNovaTasca()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Plus size={14} /> Tasca
              </button>
              <button
                onClick={onNouProjecte}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#861414' }}
              >
                <Plus size={14} /> Projecte
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* KPIs de tasques */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendents',    value: stats.pendents,    color: '#6b7280' },
          { label: 'En curs',    value: stats.enCurs,     color: '#2563eb' },
          { label: 'Completades', value: stats.completades, color: '#15803d' },
          { label: 'Bloquejades', value: stats.bloquejades, color: '#dc2626' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            {loading ? (
              <div className="space-y-2">
                <div className="h-7 w-8 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                <p className="text-xs font-medium text-gray-500 mt-1">{label}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Cards de projectes */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
              <div className="h-2 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
      ) : projectes.length > 0 ? (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Projectes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectes.map((p) => {
              const tasquesP = tasques.filter((t) => t.Projecte_ID === p.ID)
              const progress = progressPercent(tasquesP)
              const isSelected = projecteFiltre === p.ID
              return (
                <div
                  key={p.ID}
                  className={`bg-white rounded-xl border shadow-sm p-4 transition-all hover:shadow-md ${
                    isSelected ? 'border-primary/40 ring-1 ring-primary/20' : 'border-gray-100'
                  }`}
                >
                  <button
                    className="w-full text-left"
                    onClick={() => setProjecteFiltre(isSelected ? null : p.ID)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-primary/70 font-semibold">{p.ID}</p>
                        <p className="text-sm font-semibold text-text-main truncate">{p.Nom}</p>
                        {p.Categoria && <p className="text-xs text-gray-400 mt-0.5">{p.Categoria}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ESTAT_PROJECTE_COLORS[p.Estat]}`}>
                        {p.Estat}
                      </span>
                    </div>
                    <div className="space-y-1 mb-2">
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>{progress}% completat</span>
                        <span>{tasquesP.length} tasques</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${progress}%`, backgroundColor: '#861414' }}
                        />
                      </div>
                    </div>
                    {p.Data_fi_prevista && (
                      <p className="text-xs text-gray-400">Fi: {formatDate(p.Data_fi_prevista)}</p>
                    )}
                  </button>
                  {canGestionar && (
                    <div className="mt-2 pt-2 border-t border-gray-50">
                      {confirmDeleteId === p.ID ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-red-600 font-medium">Eliminar projecte?</span>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={async () => {
                                setEliminant(true)
                                try {
                                  await onEliminarProjecte(p)
                                  if (projecteFiltre === p.ID) setProjecteFiltre(null)
                                } finally {
                                  setEliminant(false)
                                  setConfirmDeleteId(null)
                                }
                              }}
                              disabled={eliminant}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                            >
                              {eliminant && <Loader2 size={10} className="animate-spin" />} Sí
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg"
                            >
                              No
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => onNovaTasca(p.ID)}
                            className="text-xs text-gray-400 hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <Plus size={11} /> Tasca
                          </button>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setConfirmDeleteId(p.ID)}
                              className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                            >
                              <Trash2 size={11} /> Eliminar
                            </button>
                            <button
                              onClick={() => onEditarProjecte(p)}
                              className="text-xs text-gray-400 hover:text-primary transition-colors"
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : !loading && (
        <div className="text-center py-8 text-sm text-gray-400">
          Cap projecte creat. {canGestionar && (
            <button onClick={onNouProjecte} className="text-primary hover:underline">
              Crea el primer projecte.
            </button>
          )}
        </div>
      )}

      {/* Vista de tasques */}
      {(projectes.length > 0 || tasques.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              {projecteFiltre && (
                <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                  <FolderKanban size={12} />
                  {projectes.find((p) => p.ID === projecteFiltre)?.Nom}
                  <button onClick={() => setProjecteFiltre(null)} className="hover:text-primary/60 ml-0.5">×</button>
                </div>
              )}
            </div>
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setTab('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  tab === 'kanban' ? 'bg-white text-text-main shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LayoutGrid size={13} /> Kanban
              </button>
              <button
                onClick={() => setTab('llista')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  tab === 'llista' ? 'bg-white text-text-main shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <List size={13} /> Llista
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex-1 min-w-[200px] space-y-3">
                  <div className="h-8 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="bg-white rounded-xl border border-gray-100 p-3.5 animate-pulse space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : tab === 'kanban' ? (
            <KanbanView
              tasques={tasques}
              projectes={projectes}
              projecteFiltre={projecteFiltre}
              onVeureTasca={onVeureTasca}
            />
          ) : (
            <LlistaView
              projectes={projectes}
              tasques={tasques}
              projecteFiltre={projecteFiltre}
              canGestionar={canGestionar}
              onVeureTasca={onVeureTasca}
              onNovaTasca={(id) => onNovaTasca(id)}
            />
          )}
        </div>
      )}
    </div>
  )
}
