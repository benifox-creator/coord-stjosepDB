import { useState, useMemo } from 'react'
import { Plus, Search, RefreshCw, Archive, AlertTriangle } from 'lucide-react'
import type { ItemMaterial, CategoriaMaterial } from './types'

const CATEGORIES: CategoriaMaterial[] = [
  'Cable', 'Adaptador', 'Àudio/Vídeo', 'Perifèric',
  'Emmagatzematge', 'Bateria/Carregador', 'Projecció', 'Altre',
]

const MOCK: ItemMaterial[] = [
  { ID: 'MAT-001', Nom: 'Cable HDMI 2m', Categoria: 'Cable', Descripció: 'Cables HDMI estàndard per a projectors i monitors', Quantitat_total: 20, Quantitat_disponible: 15, Ubicació: 'Armari TIC', Notes: '', _rowIndex: 0 },
  { ID: 'MAT-002', Nom: 'Adaptador VGA→HDMI', Categoria: 'Adaptador', Descripció: '', Quantitat_total: 8, Quantitat_disponible: 6, Ubicació: 'Armari TIC', Notes: '', _rowIndex: 1 },
  { ID: 'MAT-003', Nom: 'Ratolí sense fils', Categoria: 'Perifèric', Descripció: 'Ratolins USB sense fils', Quantitat_total: 12, Quantitat_disponible: 10, Ubicació: 'Armari TIC', Notes: '', _rowIndex: 2 },
  { ID: 'MAT-004', Nom: 'Teclat USB', Categoria: 'Perifèric', Descripció: '', Quantitat_total: 5, Quantitat_disponible: 4, Ubicació: 'Armari TIC', Notes: '', _rowIndex: 3 },
  { ID: 'MAT-005', Nom: 'Pendrive 32GB', Categoria: 'Emmagatzematge', Descripció: '', Quantitat_total: 15, Quantitat_disponible: 12, Ubicació: 'Calaix Coordinació', Notes: '', _rowIndex: 4 },
  { ID: 'MAT-006', Nom: 'Puntero làser', Categoria: 'Projecció', Descripció: '', Quantitat_total: 6, Quantitat_disponible: 5, Ubicació: 'Armari TIC', Notes: '', _rowIndex: 5 },
]

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${50 + (i * 17) % 45}%` }} />
        </td>
      ))}
    </tr>
  )
}

function StockBar({ total, disponible }: { total: number; disponible: number }) {
  if (total === 0) return <span className="text-xs text-gray-400">—</span>
  const pct = Math.round((disponible / total) * 100)
  const color = pct <= 20 ? 'bg-red-400' : pct <= 50 ? 'bg-amber-400' : 'bg-green-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 shrink-0">{disponible}/{total}</span>
    </div>
  )
}

interface Props {
  onNou: () => void
  onVeureDetall: (item: ItemMaterial) => void
  loading?: boolean
  items?: ItemMaterial[]
  error?: string | null
  onRefresh?: () => void
}

export function MaterialPage({
  onNou,
  onVeureDetall,
  loading = false,
  items = MOCK,
  error = null,
  onRefresh,
}: Props) {
  const [cerca, setCerca] = useState('')
  const [filtreCategoria, setFiltreCategoria] = useState<CategoriaMaterial | ''>('')

  const filtrats = useMemo(() => {
    const q = cerca.toLowerCase()
    return [...items]
      .sort((a, b) => a.ID.localeCompare(b.ID))
      .filter((item) => {
        if (filtreCategoria && item.Categoria !== filtreCategoria) return false
        if (q) {
          const h = `${item.ID} ${item.Nom} ${item.Categoria} ${item.Ubicació} ${item.Descripció}`.toLowerCase()
          if (!h.includes(q)) return false
        }
        return true
      })
  }, [items, filtreCategoria, cerca])

  const stats = useMemo(() => ({
    totalItems: items.length,
    totalUnitats: items.reduce((s, i) => s + i.Quantitat_total, 0),
    enPrestec: items.reduce((s, i) => s + (i.Quantitat_total - i.Quantitat_disponible), 0),
    stockBaix: items.filter((i) => i.Quantitat_total > 0 && i.Quantitat_disponible / i.Quantitat_total <= 0.2).length,
  }), [items])

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Archive size={20} className="text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-text-main">Material i Stock</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading ? 'Carregant...' : `${filtrats.length} de ${items.length} ítems`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button onClick={onRefresh} title="Actualitzar" className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors">
                <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
            <button
              onClick={onNou}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#861414' }}
            >
              <Plus size={16} />
              Nou material
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="flex gap-5 mb-4 flex-wrap">
          {[
            { label: 'Ítems',      val: stats.totalItems,  color: '#374151' },
            { label: 'Unitats',    val: stats.totalUnitats, color: '#0c71c3' },
            { label: 'En préstec', val: stats.enPrestec,   color: '#ca8a04' },
            { label: 'Stock baix', val: stats.stockBaix,   color: '#861414' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-xl font-bold" style={{ color }}>{val}</span>
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>

        {/* Alerta stock baix */}
        {stats.stockBaix > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700">
              {stats.stockBaix} {stats.stockBaix === 1 ? 'ítem té' : 'ítems tenen'} stock per sota del 20%.
            </p>
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder="Cercar per nom, categoria, ubicació..."
              className="input pl-8 text-sm w-full"
            />
          </div>
          <select
            value={filtreCategoria}
            onChange={(e) => setFiltreCategoria(e.target.value as CategoriaMaterial | '')}
            className="input text-sm w-48"
          >
            <option value="">Totes les categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Categoria</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Ubicació</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading && [...Array(4)].map((_, i) => <SkeletonRow key={i} />)}

            {!loading && filtrats.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-gray-400 text-sm">
                  {items.length === 0 ? 'Encara no hi ha material registrat.' : 'Cap ítem coincideix amb els filtres.'}
                </td>
              </tr>
            )}

            {!loading && filtrats.map((item) => {
              const pct = item.Quantitat_total > 0 ? item.Quantitat_disponible / item.Quantitat_total : 1
              const stockBaix = pct <= 0.2 && item.Quantitat_total > 0
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
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-text-main">{item.Nom}</p>
                      {stockBaix && <AlertTriangle size={13} className="text-amber-500 shrink-0" />}
                    </div>
                    {item.Descripció && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{item.Descripció}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{item.Categoria}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{item.Ubicació || '—'}</td>
                  <td className="px-4 py-3 min-w-[140px]">
                    <StockBar total={item.Quantitat_total} disponible={item.Quantitat_disponible} />
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
