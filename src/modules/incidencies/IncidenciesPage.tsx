import { useState, useMemo } from 'react'
import { Plus, Search, RefreshCw, AlertTriangle } from 'lucide-react'
import { Badge } from '../../components/Badge'
import type { Incidencia, EstatIncidencia, PrioritatIncidencia, TipusProblema } from './types'
import { formatDatetime, calcularDiesOberts } from './incidencies.utils'

// ── Mock temporal (es substituirà per dades reals al punt 6) ──────────────────
const MOCK: Incidencia[] = [
  {
    Ticket: 'INC-001', 'Marca de temps': '2026-06-20T08:30:00Z', Estat: 'Oberta',
    Prioritat: 'Alta', Reporter: 'professor1@stjosep.org', 'Tipus de problema': 'Maquinari',
    Localització: 'Aula 55', Dispositiu: 'INV-012 HP EliteBook — Aula 55',
    'Descripció detallada': 'El portàtil no arrenca. Sembla que és la bateria.',
    'Assignat a': 'amoreno@stjosep.org', 'Data Resolució': '', 'Dies Tasca Oberta': '',
    Comentaris: '', Notificat: 'false', _rowIndex: 0,
  },
  {
    Ticket: 'INC-002', 'Marca de temps': '2026-06-21T10:15:00Z', Estat: 'En curs',
    Prioritat: 'Mitjana', Reporter: 'professor2@stjosep.org', 'Tipus de problema': 'Xarxa',
    Localització: 'Sala de Professors', Dispositiu: 'Altre',
    'Descripció detallada': 'No hi ha connexió a internet des de primera hora del matí.',
    'Assignat a': 'amoreno@stjosep.org', 'Data Resolució': '', 'Dies Tasca Oberta': '',
    Comentaris: 'Revisada la connexió al switch principal.', Notificat: 'false', _rowIndex: 1,
  },
  {
    Ticket: 'INC-003', 'Marca de temps': '2026-06-19T09:00:00Z', Estat: 'Tancada',
    Prioritat: 'Baixa', Reporter: 'professor3@stjosep.org', 'Tipus de problema': 'Programari',
    Localització: 'BAXT-1A', Dispositiu: 'INV-005 iMac — BAXT-1A',
    'Descripció detallada': 'El navegador no obre certs webs de la plataforma Moodle.',
    'Assignat a': '', 'Data Resolució': '2026-06-20T11:00:00Z', 'Dies Tasca Oberta': '1',
    Comentaris: 'Esborrat caché i cookies. Solucionat.', Notificat: 'true', _rowIndex: 2,
  },
  {
    Ticket: 'INC-004', 'Marca de temps': '2026-06-22T07:45:00Z', Estat: 'Oberta',
    Prioritat: 'Alta', Reporter: 'professor4@stjosep.org', 'Tipus de problema': 'Projector/Pantalla',
    Localització: 'Aula 32', Dispositiu: 'Projector Aula 32',
    'Descripció detallada': 'El projector no detecta el cable HDMI del portàtil del professor.',
    'Assignat a': '', 'Data Resolució': '', 'Dies Tasca Oberta': '',
    Comentaris: '', Notificat: 'false', _rowIndex: 3,
  },
  {
    Ticket: 'INC-005', 'Marca de temps': '2026-06-18T14:20:00Z', Estat: 'Tancada',
    Prioritat: 'Mitjana', Reporter: 'professor5@stjosep.org', 'Tipus de problema': 'Impressora',
    Localització: 'Secretaria', Dispositiu: 'Impressora HP LaserJet',
    'Descripció detallada': 'La impressora fa un soroll estrany i no imprimeix correctament.',
    'Assignat a': 'amoreno@stjosep.org', 'Data Resolució': '2026-06-19T10:00:00Z', 'Dies Tasca Oberta': '1',
    Comentaris: 'Canviat el tòner. Funcionant.', Notificat: 'true', _rowIndex: 4,
  },
]

const ESTATS: Array<EstatIncidencia | ''> = ['', 'Oberta', 'En curs', 'Tancada']
const PRIORITATS: Array<PrioritatIncidencia | ''> = ['', 'Alta', 'Mitjana', 'Baixa']
const TIPUS: Array<TipusProblema | ''> = [
  '', 'Maquinari', 'Programari', 'Xarxa', 'Projector/Pantalla', 'Impressora', 'Altre',
]

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
  incidencies = MOCK,
  error = null,
  onRefresh,
}: Props) {
  const [cerca, setCerca] = useState('')
  const [filtreEstat, setFiltreEstat] = useState<EstatIncidencia | ''>('')
  const [filtrePrioritat, setFiltrePrioritat] = useState<PrioritatIncidencia | ''>('')
  const [filtreTipus, setFiltreTipus] = useState<TipusProblema | ''>('')

  const filtrades = useMemo(() => {
    const q = cerca.toLowerCase()
    return [...incidencies]
      .sort((a, b) => b['Marca de temps'].localeCompare(a['Marca de temps']))
      .filter((inc) => {
        if (filtreEstat && inc.Estat !== filtreEstat) return false
        if (filtrePrioritat && inc.Prioritat !== filtrePrioritat) return false
        if (filtreTipus && inc['Tipus de problema'] !== filtreTipus) return false
        if (q) {
          const haystack = `${inc.Ticket} ${inc.Localització} ${inc['Descripció detallada']}`.toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
  }, [incidencies, filtreEstat, filtrePrioritat, filtreTipus, cerca])

  const comptadors = useMemo(() => ({
    oberta: incidencies.filter((i) => i.Estat === 'Oberta').length,
    enCurs: incidencies.filter((i) => i.Estat === 'En curs').length,
    tancada: incidencies.filter((i) => i.Estat === 'Tancada').length,
  }), [incidencies])

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Capçalera */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-text-main">Incidències</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading ? 'Carregant...' : `${filtrades.length} de ${incidencies.length} incidències`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        {/* KPIs ràpids */}
        <div className="flex gap-4 mb-4">
          {[
            { label: 'Obertes', val: comptadors.oberta, color: '#861414' },
            { label: 'En curs', val: comptadors.enCurs, color: '#ff9c02' },
            { label: 'Tancades', val: comptadors.tancada, color: '#6b7280' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xl font-bold" style={{ color }}>{val}</span>
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder="Cercar per ticket, localització o descripció..."
              className="input pl-8 text-sm w-full"
            />
          </div>
          <select value={filtreEstat} onChange={(e) => setFiltreEstat(e.target.value as EstatIncidencia | '')} className="input text-sm w-36">
            <option value="">Tots els estats</option>
            {ESTATS.slice(1).map((e) => <option key={e}>{e}</option>)}
          </select>
          <select value={filtrePrioritat} onChange={(e) => setFiltrePrioritat(e.target.value as PrioritatIncidencia | '')} className="input text-sm w-40">
            <option value="">Totes les prioritats</option>
            {PRIORITATS.slice(1).map((p) => <option key={p}>{p}</option>)}
          </select>
          <select value={filtreTipus} onChange={(e) => setFiltreTipus(e.target.value as TipusProblema | '')} className="input text-sm w-48">
            <option value="">Tots els tipus</option>
            {TIPUS.slice(1).map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
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
