import { useState, useMemo } from 'react'
import { Plus, RefreshCw, BookOpen } from 'lucide-react'
import { Badge } from '../../components/Badge'
import { BarraFiltres } from '../../components/filtres/BarraFiltres'
import { PindolesFiltre } from '../../components/filtres/PindolesFiltre'
import type { Pindola } from '../../components/filtres/PindolesFiltre'
import type { DefinicioFiltre } from '../../components/filtres/filtres'
import { opcions } from '../../components/filtres/filtres'
import { useValorsFiltres } from '../../components/filtres/useValorsFiltres'
import type { Prestec } from './types'
import { formatDate, estatEfectiu, diesRestants } from './prestecs.utils'

const AVUI = '2026-06-23'
const MOCK: Prestec[] = [
  {
    ID: 'PRE-001', Dispositiu_ID: 'INV-005', Dispositiu_Nom: 'MacBook Air M2',
    Usuari: 'Pere Fonts', Email: 'pere.fonts@stjosep.org',
    Data_inici: '2026-06-18', Data_fi_prevista: '2026-06-28', Data_fi_real: '',
    Material: 'MAT-001:1:Cable HDMI 2m', Estat: 'Actiu', Notes: '', id: "mock-0",
  },
  {
    ID: 'PRE-002', Dispositiu_ID: 'INV-001', Dispositiu_Nom: 'HP EliteBook 840 G8',
    Usuari: 'Maria López', Email: 'maria.lopez@stjosep.org',
    Data_inici: '2026-06-10', Data_fi_prevista: '2026-06-25', Data_fi_real: '',
    Material: '', Estat: 'Actiu', Notes: 'Per al curs de formació', id: "mock-1",
  },
  {
    ID: 'PRE-003', Dispositiu_ID: 'INV-007', Dispositiu_Nom: 'iPad Air 5',
    Usuari: 'Anna Puig', Email: 'anna.puig@stjosep.org',
    Data_inici: '2026-05-20', Data_fi_prevista: '2026-05-27', Data_fi_real: '2026-05-27',
    Material: '', Estat: 'Retornat', Notes: '', id: "mock-2",
  },
  {
    ID: 'PRE-004', Dispositiu_ID: 'INV-003', Dispositiu_Nom: 'Epson EB-X41',
    Usuari: 'Jordi Mas', Email: 'jordi.mas@stjosep.org',
    Data_inici: '2026-06-01', Data_fi_prevista: '2026-06-20', Data_fi_real: '',
    Material: 'MAT-002:1:Adaptador VGA→HDMI;MAT-006:1:Puntero làser', Estat: 'Actiu', Notes: 'Per a presentació externa', id: "mock-3",
  },
  {
    ID: 'PRE-005', Dispositiu_ID: 'INV-008', Dispositiu_Nom: 'Monitor Dell 27"',
    Usuari: 'Carla Vidal', Email: 'carla.vidal@stjosep.org',
    Data_inici: AVUI, Data_fi_prevista: '2026-07-15', Data_fi_real: '',
    Material: '', Estat: 'Actiu', Notes: '', id: "mock-4",
  },
]

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${50 + (i * 19) % 45}%` }} />
        </td>
      ))}
    </tr>
  )
}

function DiesLabel({ prestec }: { prestec: Prestec }) {
  const estat = estatEfectiu(prestec)
  if (estat === 'Retornat') {
    return <span className="text-xs text-gray-400">Retornat {formatDate(prestec.Data_fi_real)}</span>
  }
  if (!prestec.Data_fi_prevista) {
    return <span className="text-xs text-blue-500 font-medium">Il·limitat</span>
  }
  const dies = diesRestants(prestec.Data_fi_prevista)
  if (dies === null) return <span className="text-xs text-gray-400">—</span>
  if (dies < 0) return <span className="text-xs font-semibold text-red-600">{Math.abs(dies)}d vençut</span>
  if (dies === 0) return <span className="text-xs font-semibold text-amber-600">Avui</span>
  if (dies <= 3) return <span className="text-xs font-semibold text-amber-600">{dies}d restants</span>
  return <span className="text-xs text-gray-500">{dies}d restants</span>
}

interface Props {
  onNou?: () => void
  onVeureDetall: (prestec: Prestec) => void
  loading?: boolean
  prestecs?: Prestec[]
  error?: string | null
  onRefresh?: () => void
}

export function PrestecsPage({
  onNou,
  onVeureDetall,
  loading = false,
  prestecs = MOCK,
  error = null,
  onRefresh,
}: Props) {
  const [cerca, setCerca] = useState('')
  const { valors, canvia, esborra } = useValorsFiltres({ estat: '' })
  const definicions: DefinicioFiltre[] = [
    { clau: 'estat', label: 'Estat', tipus: 'select', totes: 'Tots', opcions: opcions(['Actiu', 'Retornat', 'Vençut']) },
  ]

  const ambEstatEfectiu = useMemo(
    () => prestecs.map((p) => ({ ...p, _estatEfectiu: estatEfectiu(p) })),
    [prestecs]
  )

  const filtrats = useMemo(() => {
    const q = cerca.toLowerCase()
    return [...ambEstatEfectiu]
      .sort((a, b) => b.ID.localeCompare(a.ID))
      .filter((p) => {
        if (valors.estat && p._estatEfectiu !== valors.estat) return false
        if (q) {
          const h = `${p.ID} ${p.Dispositiu_ID} ${p.Dispositiu_Nom} ${p.Usuari} ${p.Email}`.toLowerCase()
          if (!h.includes(q)) return false
        }
        return true
      })
  }, [ambEstatEfectiu, valors, cerca])

  const comptadors = useMemo(() => ({
    actius: ambEstatEfectiu.filter((p) => p._estatEfectiu === 'Actiu').length,
    vençuts: ambEstatEfectiu.filter((p) => p._estatEfectiu === 'Vençut').length,
    retornats: ambEstatEfectiu.filter((p) => p._estatEfectiu === 'Retornat').length,
  }), [ambEstatEfectiu])

  const pindoles: Pindola[] = [
    { label: 'Actius', val: comptadors.actius, color: '#0c71c3', filtre: { clau: 'estat', valor: 'Actiu' } },
    { label: 'Vençuts', val: comptadors.vençuts, color: '#861414', filtre: { clau: 'estat', valor: 'Vençut' } },
    { label: 'Retornats', val: comptadors.retornats, color: '#15803d', filtre: { clau: 'estat', valor: 'Retornat' } },
  ]

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Capçalera */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        {/* Títol, comptadors (que també filtren) i accions */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
            <BookOpen size={20} className="text-primary" />
            <h1 className="text-lg font-semibold text-text-main">Préstecs</h1>
            <span className="text-xs text-gray-500">
              {loading ? 'Carregant...' : `${filtrats.length} de ${prestecs.length} préstecs`}
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
            {onNou && (
              <button
                onClick={onNou}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#861414' }}
              >
                <Plus size={16} />
                Nou préstec
              </button>
            )}
          </div>
        </div>

        <BarraFiltres
          definicions={definicions}
          valors={valors}
          onCanvia={canvia}
          onEsborra={esborra}
          cerca={cerca}
          onCerca={setCerca}
          placeholder="Cercar per dispositiu, usuari, email..."
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Taula */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[650px]">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dispositiu</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Usuari</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Data inici</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Data fi prev.</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading && [...Array(4)].map((_, i) => <SkeletonRow key={i} />)}

            {!loading && filtrats.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-gray-400 text-sm">
                  {prestecs.length === 0
                    ? 'Encara no hi ha préstecs registrats.'
                    : 'Cap préstec coincideix amb els filtres.'}
                </td>
              </tr>
            )}

            {!loading && filtrats.map((p) => {
              const estat = p._estatEfectiu
              return (
                <tr
                  key={p.ID}
                  onClick={() => onVeureDetall(p)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-primary group-hover:underline">{p.ID}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-text-main">{p.Dispositiu_Nom || p.Dispositiu_ID}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.Dispositiu_ID}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-sm text-gray-700">{p.Usuari}</p>
                    <p className="text-xs text-gray-400">{p.Email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                    {formatDate(p.Data_inici)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <p className="text-sm text-gray-600">{formatDate(p.Data_fi_prevista)}</p>
                    <DiesLabel prestec={p} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={estat} variant="prestec-estat" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
