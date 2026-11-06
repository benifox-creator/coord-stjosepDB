import { useState, useMemo } from 'react'
import { Plus, RefreshCw, Package } from 'lucide-react'
import { Badge } from '../../components/Badge'
import { BarraFiltres } from '../../components/filtres/BarraFiltres'
import { PindolesFiltre } from '../../components/filtres/PindolesFiltre'
import type { Pindola } from '../../components/filtres/PindolesFiltre'
import type { DefinicioFiltre } from '../../components/filtres/filtres'
import { opcions } from '../../components/filtres/filtres'
import { useConfigStore } from '../../store/configStore'
import type { ItemInventari } from './types'
import { ESTATS_INVENTARI, esAvariat } from './estats'
import type { Ubicacio } from './ubicacions'
import { formatDate, garantiaEstat } from './inventari.utils'
import { ubicacioCompleta } from './ubicacions'
import type { FiltresInventari } from './filtres'
import { FILTRES_BUITS, filtraInventari } from './filtres'

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

  const filtrats = useMemo(() => filtraInventari(items, filtres), [items, filtres])

  const definicions: DefinicioFiltre[] = useMemo(() => [
    { clau: 'estat', label: 'Estat', tipus: 'select', totes: 'Tots', opcions: [{ valor: 'avariats', etiqueta: 'Avariats o en reparació' }, ...opcions(ESTATS_INVENTARI)] },
    { clau: 'categoria', label: 'Tipus', tipus: 'select', totes: 'Tots', opcions: opcions(categories) },
    { clau: 'ubicacio', label: 'Ubicació', tipus: 'select', totes: 'Totes', opcions: ubicacions.map((u) => ({ valor: u.Codi, etiqueta: ubicacioCompleta(u.Codi, ubicacions) })) },
    { clau: 'accio', label: 'Acció pendent', tipus: 'select', totes: 'Totes', opcions: [{ valor: 'qualsevol', etiqueta: 'Amb alguna acció pendent' }, ...opcions(accions)] },
  ], [categories, ubicacions, accions])

  const pindoles: Pindola[] = useMemo(() => [
    { label: 'Actius', val: items.filter((i) => i.Estat === 'Actiu').length, color: '#15803d', filtre: { clau: 'estat', valor: 'Actiu' } },
    { label: 'Avariats o en reparació', val: items.filter((i) => esAvariat(i.Estat)).length, color: '#ca8a04', filtre: { clau: 'estat', valor: 'avariats' } },
    { label: 'En préstec', val: items.filter((i) => i.Estat === 'En préstec').length, color: '#0c71c3', filtre: { clau: 'estat', valor: 'En préstec' } },
    { label: 'De baixa', val: items.filter((i) => i.Estat === 'De baixa').length, color: '#861414', filtre: { clau: 'estat', valor: 'De baixa' } },
  ], [items])

  function canvia(clau: string, valor: string) {
    setFiltres((f) => ({ ...f, [clau]: valor }))
  }
  function esborraFiltres() {
    setFiltres((f) => ({ ...FILTRES_BUITS, cerca: f.cerca }))
  }

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
          <PindolesFiltre pindoles={pindoles} valors={filtres} onCanvia={canvia} />
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

        <BarraFiltres
          definicions={definicions}
          valors={filtres}
          onCanvia={canvia}
          onEsborra={esborraFiltres}
          cerca={filtres.cerca}
          onCerca={(t) => canvia('cerca', t)}
          placeholder="Cercar per nom, marca, ubicació, núm. sèrie..."
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
