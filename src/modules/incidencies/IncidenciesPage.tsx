import { useState, useMemo } from 'react'
import { Plus, RefreshCw, AlertTriangle } from 'lucide-react'
import { Badge } from '../../components/Badge'
import { BarraFiltres } from '../../components/filtres/BarraFiltres'
import { PindolesFiltre } from '../../components/filtres/PindolesFiltre'
import type { Pindola } from '../../components/filtres/PindolesFiltre'
import type { DefinicioFiltre } from '../../components/filtres/filtres'
import { opcions } from '../../components/filtres/filtres'
import { useValorsFiltres } from '../../components/filtres/useValorsFiltres'
import { useConfigStore } from '../../store/configStore'
import type { Incidencia, PrioritatIncidencia } from './types'
import { formatDatetime, calcularDiesOberts } from './incidencies.utils'

const PRIORITATS: Array<PrioritatIncidencia | ''> = ['', 'Alta', 'Mitjana', 'Baixa']
function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + (i * 13) % 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

interface Props {
  onNova: () => void
  onVeureDetall: (inc: Incidencia) => void
  loading?: boolean
  incidencies?: Incidencia[]
  error?: string | null
  onRefresh?: () => void
}

export function IncidenciesPage({
  onNova,
  onVeureDetall,
  loading = false,
  incidencies = [],
  error = null,
  onRefresh,
}: Props) {
  const tipus = useConfigStore((s) => s.getValues('incidencies.tipus'))
  const [cerca, setCerca] = useState('')
  const { valors, canvia, esborra } = useValorsFiltres({ estat: '', prioritat: '', tipus: '' })
  const definicions: DefinicioFiltre[] = [
    { clau: 'estat', label: 'Estat', tipus: 'select', totes: 'Tots', opcions: opcions(['Oberta', 'En curs', 'Tancada']) },
    { clau: 'prioritat', label: 'Prioritat', tipus: 'select', totes: 'Totes', opcions: opcions(PRIORITATS.slice(1) as string[]) },
    { clau: 'tipus', label: 'Tipus', tipus: 'select', totes: 'Tots', opcions: opcions(tipus) },
  ]

  const filtrades = useMemo(() => {
    const q = cerca.toLowerCase()
    return [...incidencies]
      .sort((a, b) => b['Marca de temps'].localeCompare(a['Marca de temps']))
      .filter((inc) => {
        if (valors.estat && inc.Estat !== valors.estat) return false
        if (valors.prioritat && inc.Prioritat !== valors.prioritat) return false
        if (valors.tipus && inc['Tipus de problema'] !== valors.tipus) return false
        if (q) {
          const haystack = `${inc.Ticket} ${inc.Localització} ${inc['Descripció detallada']}`.toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
  }, [incidencies, valors, cerca])

  const comptadors = useMemo(() => ({
    oberta: incidencies.filter((i) => i.Estat === 'Oberta').length,
    enCurs: incidencies.filter((i) => i.Estat === 'En curs').length,
    tancada: incidencies.filter((i) => i.Estat === 'Tancada').length,
  }), [incidencies])

  const pindoles: Pindola[] = [
    { label: 'Obertes', val: comptadors.oberta, color: '#861414', filtre: { clau: 'estat', valor: 'Oberta' } },
    { label: 'En curs', val: comptadors.enCurs, color: '#ff9c02', filtre: { clau: 'estat', valor: 'En curs' } },
    { label: 'Tancades', val: comptadors.tancada, color: '#6b7280', filtre: { clau: 'estat', valor: 'Tancada' } },
  ]

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Capçalera */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        {/* Títol, comptadors (que també filtren) i accions */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={20} className="text-primary" />
            <h1 className="text-lg font-semibold text-text-main">Incidències</h1>
            <span className="text-xs text-gray-500">
              {loading ? 'Carregant...' : `${filtrades.length} de ${incidencies.length} incidències`}
            </span>
          </div>
          <PindolesFiltre pindoles={pindoles} valors={valors} onCanvia={canvia} />
          <div className="flex items-center gap-2 ml-auto">
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Actualitzar"
                className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
            <button
              onClick={onNova}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#861414' }}
            >
              <Plus size={16} />
              Nova incidència
            </button>
          </div>
        </div>

        <BarraFiltres
          definicions={definicions}
          valors={valors}
          onCanvia={canvia}
          onEsborra={esborra}
          cerca={cerca}
          onCerca={setCerca}
          placeholder="Cercar per ticket, localització o descripció..."
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Taula — desktop */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticket</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Data</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estat</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prioritat</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Tipus</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Localització</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Assignat a</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dies</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading && [...Array(5)].map((_, i) => <SkeletonRow key={i} />)}

            {!loading && filtrades.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-gray-400 text-sm">
                  {incidencies.length === 0
                    ? 'Encara no hi ha incidències. Crea-ne una!'
                    : 'Cap incidència coincideix amb els filtres actuals.'}
                </td>
              </tr>
            )}

            {!loading && filtrades.map((inc) => (
              <tr
                key={inc.Ticket}
                onClick={() => onVeureDetall(inc)}
                className="hover:bg-gray-50 cursor-pointer transition-colors group"
              >
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold text-primary group-hover:underline">{inc.Ticket}</span>
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px] md:hidden">{inc['Tipus de problema']}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell whitespace-nowrap">
                  {formatDatetime(inc['Marca de temps'])}
                </td>
                <td className="px-4 py-3">
                  <Badge label={inc.Estat} variant="estat" />
                </td>
                <td className="px-4 py-3">
                  <Badge label={inc.Prioritat} variant="prioritat" />
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{inc['Tipus de problema']}</td>
                <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">{inc.Localització || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                  {inc['Assignat a']
                    ? <span className="truncate block max-w-[140px]">{inc['Assignat a']}</span>
                    : <span className="text-gray-300 italic">Sense assignar</span>}
                </td>
                <td className="px-4 py-3 text-sm text-center text-gray-500">
                  {inc.Estat !== 'Tancada'
                    ? <span className="font-medium text-amber-600">{calcularDiesOberts(inc['Marca de temps'], '')}</span>
                    : <span className="text-gray-400">{inc['Dies Tasca Oberta']}</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
