import { AlertTriangle, Calendar, User } from 'lucide-react'
import type { Tasca, Projecte, EstatTasca } from './types'
import { formatDate, isOverdue } from './pla-accio.utils'

const COLUMNES: { estat: EstatTasca; label: string; color: string; bg: string }[] = [
  { estat: 'Pendent',    label: 'Pendent',    color: 'text-gray-600',  bg: 'bg-gray-100'  },
  { estat: 'En curs',   label: 'En curs',    color: 'text-blue-600',  bg: 'bg-blue-100'  },
  { estat: 'Completada',label: 'Completada', color: 'text-green-700', bg: 'bg-green-100' },
  { estat: 'Bloquejada',label: 'Bloquejada', color: 'text-red-600',   bg: 'bg-red-100'   },
]

const PRIORITAT_COLORS: Record<string, string> = {
  Alta:   'text-red-600 bg-red-50 border-red-200',
  Mitjana:'text-amber-600 bg-amber-50 border-amber-200',
  Baixa:  'text-gray-500 bg-gray-50 border-gray-200',
}

interface Props {
  tasques: Tasca[]
  projectes: Projecte[]
  projecteFiltre: string | null
  onVeureTasca: (tasca: Tasca) => void
}

export function KanbanView({ tasques, projectes, projecteFiltre, onVeureTasca }: Props) {
  const projecteMap = Object.fromEntries(projectes.map((p) => [p.ID, p.Nom]))
  const filtrades = projecteFiltre ? tasques.filter((t) => t.Projecte_ID === projecteFiltre) : tasques

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[300px]">
      {COLUMNES.map(({ estat, label, color, bg }) => {
        const columna = filtrades.filter((t) => t.Estat === estat)
        return (
          <div key={estat} className="flex-1 min-w-[220px]">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 ${bg}`}>
              <span className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</span>
              <span className={`ml-auto text-xs font-bold ${color}`}>{columna.length}</span>
            </div>
            <div className="space-y-2.5">
              {columna.map((tasca) => {
                const vencuda = isOverdue(tasca.Data_limit) && tasca.Estat !== 'Completada'
                return (
                  <button
                    key={tasca.ID}
                    onClick={() => onVeureTasca(tasca)}
                    className="w-full text-left bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm hover:shadow-md hover:border-gray-200 transition-all"
                  >
                    <p className="text-xs text-primary font-mono font-semibold mb-1">{tasca.ID}</p>
                    <p className="text-sm font-semibold text-text-main leading-snug mb-2">{tasca.Titol}</p>
                    {projecteMap[tasca.Projecte_ID] && (
                      <p className="text-xs text-gray-400 mb-2 truncate">{projecteMap[tasca.Projecte_ID]}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITAT_COLORS[tasca.Prioritat]}`}>
                        {tasca.Prioritat}
                      </span>
                      {tasca.Data_limit && (
                        <span className={`flex items-center gap-1 text-xs ${vencuda ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                          {vencuda && <AlertTriangle size={10} />}
                          <Calendar size={10} />
                          {formatDate(tasca.Data_limit)}
                        </span>
                      )}
                      {tasca.Responsable && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 ml-auto truncate max-w-[90px]">
                          <User size={10} />
                          {tasca.Responsable.includes('@') ? tasca.Responsable.split('@')[0] : tasca.Responsable}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
              {columna.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-300 border-2 border-dashed border-gray-100 rounded-xl">
                  Cap tasca
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
