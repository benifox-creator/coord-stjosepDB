import { useMemo, useState } from 'react'
import { Plus, RefreshCw, Wrench, AlertTriangle } from 'lucide-react'
import type { Manteniment, EstatManteniment, CategoriaManteniment } from './types'
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

const ESTATS_FILTRE: Array<EstatManteniment | 'Tots'> = ['Tots', 'Pendent', 'En gestió', 'Resolt', 'Cancel·lat']

interface Props {
  manteniments: Manteniment[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onNou: () => void
  onVeure: (m: Manteniment) => void
}

export function MantenimentPage({ manteniments, loading, error, onRefresh, onNou, onVeure }: Props) {
  const [filtreEstat, setFiltreEstat] = useState<EstatManteniment | 'Tots'>('Tots')
  const [filtreCat, setFiltreCat] = useState<CategoriaManteniment | 'Tots'>('Tots')

  const stats = useMemo(() => ({
    pendents:   manteniments.filter((m) => m.Estat === 'Pendent').length,
    enGestio:   manteniments.filter((m) => m.Estat === 'En gestió').length,
    resolts:    manteniments.filter((m) => m.Estat === 'Resolt').length,
    urgents:    manteniments.filter((m) => m.Prioritat === 'Urgent' && m.Estat !== 'Resolt' && m.Estat !== 'Cancel·lat').length,
  }), [manteniments])

  const filtrats = useMemo(() => [...manteniments]
    .sort((a, b) => {
      const pOrder = { Urgent: 0, Normal: 1, Baixa: 2 }
      return (pOrder[a.Prioritat] ?? 1) - (pOrder[b.Prioritat] ?? 1)
    })
    .filter((m) => {
      if (filtreEstat !== 'Tots' && m.Estat !== filtreEstat) return false
      if (filtreCat !== 'Tots' && m.Categoria !== filtreCat) return false
      return true
    }), [manteniments, filtreEstat, filtreCat])

  return (
    <div className="flex flex-col gap-6 p-6 bg-surface min-h-full">

      {/* Capçalera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-main">Manteniment</h1>
          <p className="text-sm text-gray-400 mt-0.5">{manteniments.length} reports</p>
        </div>
        <div className="flex items-center gap-2">
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendents',   value: stats.pendents,  color: '#d97706' },
          { label: 'En gestió',  value: stats.enGestio,  color: '#2563eb' },
          { label: 'Resolts',    value: stats.resolts,   color: '#15803d' },
          { label: 'Urgents',    value: stats.urgents,   color: '#dc2626' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            {loading
              ? <div className="space-y-2"><div className="h-7 w-8 bg-gray-200 rounded animate-pulse" /><div className="h-3 w-16 bg-gray-200 rounded animate-pulse" /></div>
              : <><p className="text-2xl font-bold" style={{ color }}>{value}</p><p className="text-xs font-medium text-gray-500 mt-1">{label}</p></>
            }
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {ESTATS_FILTRE.map((e) => (
            <button
              key={e}
              onClick={() => setFiltreEstat(e)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${filtreEstat === e ? 'bg-gray-100 text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {e}
            </button>
          ))}
        </div>
        <select
          value={filtreCat}
          onChange={(e) => setFiltreCat(e.target.value as CategoriaManteniment | 'Tots')}
          className="input text-xs py-1.5 w-auto"
        >
          <option value="Tots">Totes les categories</option>
          {CATEGORIES_MANTENIMENT.map((c) => (
            <option key={c} value={c}>{CATEGORIA_ICONS[c]} {c}</option>
          ))}
        </select>
      </div>

      {/* Llista */}
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
          <p className="text-sm text-gray-400">
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
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
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
  )
}
