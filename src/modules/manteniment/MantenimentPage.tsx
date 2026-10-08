import { useMemo } from 'react'
import { Plus, RefreshCw, Wrench, AlertTriangle } from 'lucide-react'
import { BarraFiltres } from '../../components/filtres/BarraFiltres'
import { PindolesFiltre } from '../../components/filtres/PindolesFiltre'
import type { Pindola } from '../../components/filtres/PindolesFiltre'
import type { DefinicioFiltre } from '../../components/filtres/filtres'
import { opcions } from '../../components/filtres/filtres'
import { useValorsFiltres } from '../../components/filtres/useValorsFiltres'
import type { Manteniment, EstatManteniment } from './types'
import { formatDate, CATEGORIES_MANTENIMENT } from './manteniment.utils'

const ESTAT_COLORS: Record<EstatManteniment, string> = {
  'Pendent':    'text-amber-700 bg-amber-100',
  'En gestió':  'text-blue-600 bg-blue-100',
  'Resolt':     'text-green-700 bg-green-100',
  'Cancel·lat': 'text-gray-500 bg-gray-100',
}

const PRIORITAT_COLORS: Record<string, string> = {
  Urgent: 'text-red-600 bg-red-50 border border-red-200',
  Normal: 'text-amber-600 bg-amber-50 border border-amber-200',
  Baixa:  'text-gray-500 bg-gray-50 border border-gray-200',
}

const CATEGORIA_ICONS: Record<string, string> = {
  'Persianes/Stores': '🪟', 'Portes/Finestres': '🚪', 'Mobiliari': '🪑',
  'Electricitat': '⚡', 'Fontaneria': '🔧', 'Pintura': '🎨', 'Altres': '🔩',
}

interface Props {
  manteniments: Manteniment[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onNou: () => void
  onVeure: (m: Manteniment) => void
}

export function MantenimentPage({ manteniments, loading, error, onRefresh, onNou, onVeure }: Props) {
  const { valors, canvia, esborra } = useValorsFiltres({ estat: '', categoria: '' })

  const definicions: DefinicioFiltre[] = [
    { clau: 'estat', label: 'Estat', tipus: 'select', totes: 'Tots', opcions: opcions(['Pendent', 'En gestió', 'Resolt', 'Cancel·lat']) },
    { clau: 'categoria', label: 'Categoria', tipus: 'select', totes: 'Totes', opcions: CATEGORIES_MANTENIMENT.map((c) => ({ valor: c, etiqueta: `${CATEGORIA_ICONS[c]} ${c}` })) },
  ]

  const stats = useMemo(() => ({
    pendents:   manteniments.filter((m) => m.Estat === 'Pendent').length,
    enGestio:   manteniments.filter((m) => m.Estat === 'En gestió').length,
    resolts:    manteniments.filter((m) => m.Estat === 'Resolt').length,
    urgents:    manteniments.filter((m) => m.Prioritat === 'Urgent' && m.Estat !== 'Resolt' && m.Estat !== 'Cancel·lat').length,
  }), [manteniments])

  // Mentre carrega, les píndoles mostren «…» en lloc del comptador.
  const pindoles = useMemo(() => [
    { label: 'Pendents',  val: loading ? '…' : stats.pendents, color: '#d97706', filtre: { clau: 'estat', valor: 'Pendent' } },
    { label: 'En gestió', val: loading ? '…' : stats.enGestio, color: '#2563eb', filtre: { clau: 'estat', valor: 'En gestió' } },
    { label: 'Resolts',   val: loading ? '…' : stats.resolts,  color: '#15803d', filtre: { clau: 'estat', valor: 'Resolt' } },
    { label: 'Urgents',   val: loading ? '…' : stats.urgents,  color: '#dc2626' },
  ], [loading, stats])

  const filtrats = useMemo(() => [...manteniments]
    .sort((a, b) => {
      const pOrder = { Urgent: 0, Normal: 1, Baixa: 2 }
      return (pOrder[a.Prioritat] ?? 1) - (pOrder[b.Prioritat] ?? 1)
    })
    .filter((m) => {
      if (valors.estat && m.Estat !== valors.estat) return false
      if (valors.categoria && m.Categoria !== valors.categoria) return false
      return true
    }), [manteniments, valors])

  return (
    <div className="flex flex-col h-full bg-surface">

      {/* Capçalera */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
            <Wrench size={20} className="text-primary" />
            <h1 className="text-lg font-semibold text-text-main">Manteniment</h1>
            <span className="text-xs text-gray-500">
              {loading ? 'Carregant...' : `${filtrats.length} de ${manteniments.length} reports`}
            </span>
          </div>
          <PindolesFiltre pindoles={pindoles as Pindola[]} valors={valors} onCanvia={canvia} />
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onRefresh} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <RefreshCw size={16} />
            </button>
            <button
              onClick={onNou}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#861414' }}
            >
              <Plus size={14} /> Reportar desperfecte
            </button>
          </div>
        </div>

        <BarraFiltres definicions={definicions} valors={valors} onCanvia={canvia} onEsborra={esborra} />
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Llista */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-4 bg-gray-200 rounded w-16" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="ml-auto h-4 bg-gray-200 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filtrats.length === 0 ? (
          <div className="text-center py-12">
            <Wrench size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {manteniments.length === 0
                ? <>Cap desperfecte reportat. <button onClick={onNou} className="text-primary hover:underline">Reporta el primer.</button></>
                : 'Cap resultat amb els filtres actuals.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtrats.map((m) => (
              <button
                key={m.ID}
                onClick={() => onVeure(m)}
                className="w-full bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5 shrink-0">{CATEGORIA_ICONS[m.Categoria] ?? '🔩'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-primary/70 font-semibold">{m.ID}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITAT_COLORS[m.Prioritat]}`}>
                        {m.Prioritat === 'Urgent' && <AlertTriangle size={10} className="inline mr-0.5" />}
                        {m.Prioritat}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-text-main truncate">{m.Titol}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      {m.Localitzacio && <span>{m.Localitzacio}</span>}
                      {m.Reporter && <span>{m.Reporter}</span>}
                      {m.Data_report && <span>{formatDate(m.Data_report)}</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ESTAT_COLORS[m.Estat]}`}>
                    {m.Estat}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
