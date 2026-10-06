import { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Search, RefreshCw, Package, SlidersHorizontal, X } from 'lucide-react'
import { Badge } from '../../components/Badge'
import { useConfigStore } from '../../store/configStore'
import type { ItemInventari } from './types'
import { ESTATS_INVENTARI, esAvariat } from './estats'
import type { Ubicacio } from './ubicacions'
import { formatDate, garantiaEstat } from './inventari.utils'
import { ubicacioCompleta } from './ubicacions'
import type { FiltresInventari, FiltreEstat, ClauFiltre } from './filtres'
import { FILTRES_BUITS, filtraInventari, filtresActius } from './filtres'

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

function CampFiltre({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  )
}

interface Props {
  onNou?: () => void
  onVeureDetall: (item: ItemInventari) => void
  loading?: boolean
  items?: ItemInventari[]
  error?: string | null
  onRefresh?: () => void
  ubicacions?: Ubicacio[]
}

export function InventariPage({
  onNou,
  onVeureDetall,
  loading = false,
  items = [],
  error = null,
  onRefresh,
  ubicacions = [],
}: Props) {
  const categories = useConfigStore((s) => s.getValues('inventari.categories'))
  const accions = useConfigStore((s) => s.getValues('inventari.accions'))
  const [filtres, setFiltres] = useState<FiltresInventari>(FILTRES_BUITS)
  const [panellObert, setPanellObert] = useState(false)
  const panellRef = useRef<HTMLDivElement>(null)

  const filtrats = useMemo(() => filtraInventari(items, filtres), [items, filtres])
  const actius = filtresActius(filtres)

  function canvia<K extends keyof FiltresInventari>(clau: K, valor: FiltresInventari[K]) {
    setFiltres((f) => ({ ...f, [clau]: valor }))
  }
  function treu(clau: ClauFiltre) {
    canvia(clau, '')
  }
  function esborraFiltres() {
    setFiltres((f) => ({ ...FILTRES_BUITS, cerca: f.cerca }))
  }

  // El panell es tanca clicant fora o amb Esc, com qualsevol menú.
  useEffect(() => {
    if (!panellObert) return
    function clic(e: MouseEvent) {
      if (panellRef.current && !panellRef.current.contains(e.target as Node)) setPanellObert(false)
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setPanellObert(false)
    }
    document.addEventListener('mousedown', clic)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', clic)
      document.removeEventListener('keydown', tecla)
    }
  }, [panellObert])

  // Les píndoles comptadores són també el filtre ràpid d'estat.
  const pindoles: { valor: FiltreEstat; label: string; val: number; color: string }[] = useMemo(() => [
    { valor: 'Actiu', label: 'Actius', val: items.filter((i) => i.Estat === 'Actiu').length, color: '#15803d' },
    { valor: 'avariats', label: 'Avariats o en reparació', val: items.filter((i) => esAvariat(i.Estat)).length, color: '#ca8a04' },
    { valor: 'En préstec', label: 'En préstec', val: items.filter((i) => i.Estat === 'En préstec').length, color: '#0c71c3' },
    { valor: 'De baixa', label: 'De baixa', val: items.filter((i) => i.Estat === 'De baixa').length, color: '#861414' },
  ], [items])

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Capçalera */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        {/* Títol, comptadors (que també filtren) i accions */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
            <Package size={20} className="text-primary" />
            <h1 className="text-lg font-semibold text-text-main">Inventari</h1>
            <span className="text-xs text-gray-500">
              {loading ? 'Carregant...' : `${filtrats.length} de ${items.length} dispositius`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {pindoles.map(({ valor, label, val, color }) => {
              const actiu = filtres.estat === valor
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={actiu}
                  onClick={() => canvia('estat', actiu ? '' : valor)}
                  title={actiu ? 'Treu aquest filtre' : `Mostra només: ${label}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-colors ${
                    actiu ? 'border-transparent text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                  style={actiu ? { backgroundColor: color } : undefined}
                >
                  <span className="font-bold" style={actiu ? undefined : { color }}>{val}</span>
                  {label}
                </button>
              )
            })}
          </div>
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
                Nou dispositiu
              </button>
            )}
          </div>
        </div>

        {/* Cerca i botó de filtres */}
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filtres.cerca}
              onChange={(e) => canvia('cerca', e.target.value)}
              placeholder="Cercar per nom, marca, ubicació, núm. sèrie..."
              className="input pl-8 text-sm w-full"
            />
          </div>
          <div ref={panellRef} className="relative">
            <button
              type="button"
              aria-expanded={panellObert}
              onClick={() => setPanellObert((o) => !o)}
              className={`flex items-center gap-1.5 h-full px-3 text-sm font-medium border rounded-lg transition-colors ${
                actius.length > 0 ? 'border-primary/40 text-primary bg-primary/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal size={14} />
              Filtres
              {actius.length > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                  {actius.length}
                </span>
              )}
            </button>
            {panellObert && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-20 space-y-2.5">
                <CampFiltre label="Estat">
                  <select value={filtres.estat} onChange={(e) => canvia('estat', e.target.value as FiltreEstat)} className="input text-sm w-full">
                    <option value="">Tots</option>
                    <option value="avariats">Avariats o en reparació</option>
                    {ESTATS_INVENTARI.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </CampFiltre>
                <CampFiltre label="Tipus">
                  <select value={filtres.categoria} onChange={(e) => canvia('categoria', e.target.value)} className="input text-sm w-full">
                    <option value="">Tots</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </CampFiltre>
                <CampFiltre label="Ubicació">
                  <select value={filtres.ubicacio} onChange={(e) => canvia('ubicacio', e.target.value)} className="input text-sm w-full">
                    <option value="">Totes</option>
                    {ubicacions.map((u) => <option key={u.id} value={u.Codi}>{ubicacioCompleta(u.Codi, ubicacions)}</option>)}
                  </select>
                </CampFiltre>
                <CampFiltre label="Acció pendent">
                  <select value={filtres.accio} onChange={(e) => canvia('accio', e.target.value)} className="input text-sm w-full">
                    <option value="">Totes</option>
                    <option value="qualsevol">Amb alguna acció pendent</option>
                    {accions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </CampFiltre>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={esborraFiltres}
                    disabled={actius.length === 0}
                    className="text-xs text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                  >
                    Esborra filtres
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Xips dels filtres actius */}
        {actius.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {actius.map(({ clau, etiqueta }) => (
              <span key={clau} className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-gray-100 text-xs text-gray-700">
                {etiqueta}
                <button
                  type="button"
                  onClick={() => treu(clau)}
                  aria-label={`Treu el filtre ${etiqueta}`}
                  className="p-0.5 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {actius.length > 1 && (
              <button type="button" onClick={esborraFiltres} className="text-xs text-primary hover:underline ml-1">
                Esborra-ho tot
              </button>
            )}
          </div>
        )}
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
                    {item.Accio && <p className="text-xs text-amber-700 mt-0.5">Acció pendent: {item.Accio}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{item.Categoria}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <p className="text-sm text-gray-700">{item.Marca}</p>
                    <p className="text-xs text-gray-400">{item.Model}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{ubicacioCompleta(item.Ubicació, ubicacions) || '—'}</td>
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
