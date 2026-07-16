import { useState } from 'react'
import { ChevronDown, ChevronRight, Calendar, User, AlertTriangle, Plus } from 'lucide-react'
import type { Projecte, Tasca } from './types'
import { formatDate, isOverdue, progressPercent } from './pla-accio.utils'

const ESTAT_COLORS: Record<string, string> = {
  'Pendent':    'text-gray-600 bg-gray-100',
  'En curs':   'text-blue-600 bg-blue-100',
  'Completada':'text-green-700 bg-green-100',
  'Bloquejada':'text-red-600 bg-red-100',
}

const PRIORITAT_COLORS: Record<string, string> = {
  Alta:    'text-red-600 bg-red-50 border border-red-200',
  Mitjana: 'text-amber-600 bg-amber-50 border border-amber-200',
  Baixa:   'text-gray-500 bg-gray-50 border border-gray-200',
}

interface Props {
  projectes: Projecte[]
  tasques: Tasca[]
  projecteFiltre: string | null
  canGestionar: boolean
  onVeureTasca: (tasca: Tasca) => void
  onNovaTasca: (projecteId: string) => void
}

export function LlistaView({ projectes, tasques, projecteFiltre, canGestionar, onVeureTasca, onNovaTasca }: Props) {
  const [expandits, setExpandits] = useState<Set<string>>(
    new Set(projectes.map((p) => p.ID))
  )

  const projectesFiltrats = projecteFiltre
    ? projectes.filter((p) => p.ID === projecteFiltre)
    : projectes

  function toggle(id: string) {
    setExpandits((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {projectesFiltrats.map((projecte) => {
        const tasquesP = tasques.filter((t) => t.Projecte_ID === projecte.ID)
        const progress = progressPercent(tasquesP)
        const expandit = expandits.has(projecte.ID)

        return (
          <div key={projecte.ID} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Capçalera projecte */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(projecte.ID)} className="text-gray-400 hover:text-gray-600 shrink-0">
                  {expandit ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-primary font-semibold">{projecte.ID}</span>
                    <span className="text-sm font-semibold text-text-main">{projecte.Nom}</span>
                    {projecte.Categoria && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{projecte.Categoria}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-auto ${
                      projecte.Estat === 'Actiu'     ? 'text-green-600 bg-green-100'  :
                      projecte.Estat === 'Completat' ? 'text-gray-500 bg-gray-100'   :
                                                       'text-amber-600 bg-amber-100'
                    }`}>
                      {projecte.Estat}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${progress}%`, backgroundColor: '#861414' }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{progress}% · {tasquesP.length} tasques</span>
                  </div>
                </div>
                {canGestionar && (
                  <button
                    onClick={() => onNovaTasca(projecte.ID)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0 ml-2"
                  >
                    <Plus size={12} /> Tasca
                  </button>
                )}
              </div>
            </div>

            {/* Tasques */}
            {expandit && (
              tasquesP.length === 0 ? (
                <p className="px-10 py-4 text-xs text-gray-400 italic border-t border-gray-50">
                  Cap tasca. {canGestionar && (
                    <button onClick={() => onNovaTasca(projecte.ID)} className="text-primary hover:underline">
                      Afegir-ne una
                    </button>
                  )}
                </p>
              ) : (
                <table className="w-full border-t border-gray-50">
                  <thead>
                    <tr className="text-left bg-gray-50 border-b border-gray-100">
                      <th className="pl-10 pr-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Tasca</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Prioritat</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Responsable</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Data límit</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tasquesP.map((tasca) => {
                      const vencuda = isOverdue(tasca.Data_limit) && tasca.Estat !== 'Completada'
                      return (
                        <tr
                          key={tasca.ID}
                          onClick={() => onVeureTasca(tasca)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="pl-10 pr-3 py-2.5">
                            <p className="text-xs font-mono text-gray-400">{tasca.ID}</p>
                            <p className="text-sm text-text-main font-medium">{tasca.Titol}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITAT_COLORS[tasca.Prioritat]}`}>
                              {tasca.Prioritat}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <User size={11} />
                              {tasca.Responsable
                                ? (tasca.Responsable.includes('@') ? tasca.Responsable.split('@')[0] : tasca.Responsable)
                                : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 hidden md:table-cell">
                            <span className={`text-xs flex items-center gap-1 ${vencuda ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                              {vencuda && <AlertTriangle size={11} />}
                              <Calendar size={11} />
                              {formatDate(tasca.Data_limit)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTAT_COLORS[tasca.Estat]}`}>
                              {tasca.Estat}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            )}
          </div>
        )
      })}

      {projectesFiltrats.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">Cap projecte trobat.</div>
      )}
    </div>
  )
}
