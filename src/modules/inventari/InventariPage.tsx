import { useState, useMemo } from 'react'
import { Plus, Search, RefreshCw, Package } from 'lucide-react'
import { Badge } from '../../components/Badge'
import type { ItemInventari, EstatInventari, CategoriaInventari } from './types'
import { formatDate, garantiaEstat } from './inventari.utils'

// ── Mock temporal — es substituirà per dades reals al punt 6 ─────────────────
const MOCK: ItemInventari[] = [
  {
    ID: 'INV-001', Nom: 'HP EliteBook 840 G8', Categoria: 'Portàtil',
    Marca: 'HP', Model: 'EliteBook 840 G8', 'Núm_sèrie': 'SN-HP-001',
    Ubicació: 'Aula 55', Estat: 'Actiu', 'Data_compra': '2022-09-01',
    'Garantia_fins': '2025-09-01', MAC_LAN: 'AA:BB:CC:DD:EE:01', MAC_WAN: '', IP_LAN: '', IP_WAN: '', Notes: '',
    _rowIndex: 0,
  },
  {
    ID: 'INV-002', Nom: 'iMac 27" 2021', Categoria: 'Ordinador',
    Marca: 'Apple', Model: 'iMac 27" M1', 'Núm_sèrie': 'SN-AP-002',
    Ubicació: 'BAXT-1A', Estat: 'Actiu', 'Data_compra': '2021-06-15',
    'Garantia_fins': '2027-06-15', MAC_LAN: 'AA:BB:CC:DD:EE:02', MAC_WAN: '', IP_LAN: '', IP_WAN: '', Notes: '',
    _rowIndex: 1,
  },
  {
    ID: 'INV-003', Nom: 'Epson EB-X41', Categoria: 'Projector',
    Marca: 'Epson', Model: 'EB-X41', 'Núm_sèrie': 'SN-EP-003',
    Ubicació: 'Aula 32', Estat: 'En reparació', 'Data_compra': '2020-01-10',
    'Garantia_fins': '2023-01-10', MAC_LAN: '', MAC_WAN: '', IP_LAN: '', IP_WAN: '', Notes: 'Cable HDMI defectuós',
    _rowIndex: 2,
  },
  {
    ID: 'INV-004', Nom: 'HP LaserJet Pro M404', Categoria: 'Impressora',
    Marca: 'HP', Model: 'LaserJet Pro M404', 'Núm_sèrie': 'SN-HP-004',
    Ubicació: 'Secretaria', Estat: 'Actiu', 'Data_compra': '2021-03-22',
    'Garantia_fins': '2024-03-22', MAC_LAN: 'AA:BB:CC:DD:EE:04', MAC_WAN: '', IP_LAN: '', IP_WAN: '', Notes: '',
    _rowIndex: 3,
  },
  {
    ID: 'INV-005', Nom: 'MacBook Air M2', Categoria: 'Portàtil',
    Marca: 'Apple', Model: 'MacBook Air M2', 'Núm_sèrie': 'SN-AP-005',
    Ubicació: 'Sala Professors', Estat: 'En préstec', 'Data_compra': '2023-09-01',
    'Garantia_fins': '2026-09-01', MAC_LAN: 'AA:BB:CC:DD:EE:05', MAC_WAN: 'AA:BB:CC:DD:FF:05', IP_LAN: '192.168.1.15', IP_WAN: '', Notes: '',
    _rowIndex: 4,
  },
  {
    ID: 'INV-006', Nom: 'Cisco SG110-16', Categoria: 'Switch/Router',
    Marca: 'Cisco', Model: 'SG110-16', 'Núm_sèrie': 'SN-CI-006',
    Ubicació: 'Rack Principal', Estat: 'Actiu', 'Data_compra': '2019-05-10',
    'Garantia_fins': '2022-05-10', MAC_LAN: 'AA:BB:CC:DD:EE:06', MAC_WAN: 'AA:BB:CC:DD:FF:06', IP_LAN: '192.168.1.1', IP_WAN: '85.123.45.67', Notes: '',
    _rowIndex: 5,
  },
]

const ESTATS: Array<EstatInventari | ''> = ['', 'Actiu', 'En reparació', 'En préstec', 'De baixa']
const CATEGORIES: Array<CategoriaInventari | ''> = [
  '', 'Portàtil', 'Ordinador', 'Tauleta', 'Projector', 'Impressora', 'Switch/Router', 'Monitor', 'Servidor', 'Altre',
]

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${55 + (i * 17) % 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

interface Props {
  onNou?: () => void
  onVeureDetall: (item: ItemInventari) => void
  loading?: boolean
  items?: ItemInventari[]
  error?: string | null
  onRefresh?: () => void
}

export function InventariPage({
  onNou,
  onVeureDetall,
  loading = false,
  items = MOCK,
  error = null,
  onRefresh,
}: Props) {
  const [cerca, setCerca] = useState('')
  const [filtreEstat, setFiltreEstat] = useState<EstatInventari | ''>('')
  const [filtreCategoria, setFiltreCategoria] = useState<CategoriaInventari | ''>('')

  const filtrats = useMemo(() => {
    const q = cerca.toLowerCase()
    return [...items]
      .sort((a, b) => a.ID.localeCompare(b.ID))
      .filter((item) => {
        if (filtreEstat && item.Estat !== filtreEstat) return false
        if (filtreCategoria && item.Categoria !== filtreCategoria) return false
        if (q) {
          const h = `${item.ID} ${item.Nom} ${item.Marca} ${item.Model} ${item.Ubicació} ${item['Núm_sèrie']}`.toLowerCase()
          if (!h.includes(q)) return false
        }
        return true
      })
  }, [items, filtreEstat, filtreCategoria, cerca])

  const comptadors = useMemo(() => ({
    actiu: items.filter((i) => i.Estat === 'Actiu').length,
    reparacio: items.filter((i) => i.Estat === 'En reparació').length,
    prestec: items.filter((i) => i.Estat === 'En préstec').length,
    baixa: items.filter((i) => i.Estat === 'De baixa').length,
  }), [items])

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Capçalera */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Package size={20} className="text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-text-main">Inventari</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading ? 'Carregant...' : `${filtrats.length} de ${items.length} dispositius`}
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
            {onNou && (
              <button
                onClick={onNou}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#861414' }}
              >
                <Plus size={16} />
                Nou dispositiu
              </button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="flex gap-5 mb-4">
          {[
            { label: 'Actius',       val: comptadors.actiu,    color: '#15803d' },
            { label: 'En reparació', val: comptadors.reparacio, color: '#ca8a04' },
            { label: 'En préstec',   val: comptadors.prestec,  color: '#0c71c3' },
            { label: 'De baixa',     val: comptadors.baixa,    color: '#861414' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex items-center gap-1.5">
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
              placeholder="Cercar per nom, marca, ubicació, núm. sèrie..."
              className="input pl-8 text-sm w-full"
            />
          </div>
          <select
            value={filtreEstat}
            onChange={(e) => setFiltreEstat(e.target.value as EstatInventari | '')}
            className="input text-sm w-40"
          >
            <option value="">Tots els estats</option>
            {ESTATS.slice(1).map((e) => <option key={e}>{e}</option>)}
          </select>
          <select
            value={filtreCategoria}
            onChange={(e) => setFiltreCategoria(e.target.value as CategoriaInventari | '')}
            className="input text-sm w-44"
          >
            <option value="">Totes les categories</option>
            {CATEGORIES.slice(1).map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Taula */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Categoria</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Marca / Model</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Ubicació</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estat</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Garantia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading && [...Array(5)].map((_, i) => <SkeletonRow key={i} />)}

            {!loading && filtrats.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-gray-400 text-sm">
                  {items.length === 0
                    ? "Encara no hi ha dispositius a l'inventari."
                    : 'Cap dispositiu coincideix amb els filtres.'}
                </td>
              </tr>
            )}

            {!loading && filtrats.map((item) => {
              const gEstat = garantiaEstat(item['Garantia_fins'])
              return (
                <tr
                  key={item.ID}
                  onClick={() => onVeureDetall(item)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-primary group-hover:underline">{item.ID}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-text-main">{item.Nom}</p>
                    <p className="text-xs text-gray-400 mt-0.5 md:hidden">{item.Categoria}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{item.Categoria}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <p className="text-sm text-gray-700">{item.Marca}</p>
                    <p className="text-xs text-gray-400">{item.Model}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{item.Ubicació || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge label={item.Estat} variant="inventari-estat" />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-col gap-1">
                      <Badge
                        label={gEstat === 'vigent' ? 'vigent' : gEstat === 'caducada' ? 'caducada' : 'desconegut'}
                        variant="garantia"
                      />
                      {item['Garantia_fins'] && (
                        <span className="text-xs text-gray-400">{formatDate(item['Garantia_fins'])}</span>
                      )}
                    </div>
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
