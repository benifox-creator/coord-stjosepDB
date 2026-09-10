import { useEffect, useMemo } from 'react'
import { useComandesInfantil } from './useComandesInfantil'
import { useMaterialsInfantil } from './useMaterialsInfantil'
import { useConfigStore } from '../../store/configStore'
import { ETAPES_INFANTIL } from './types'
import { necessitatBase, quantitatADemanar, costEstimat, nreAlumnesFromConfig } from './materialInfantil.utils'

export function ConsolidatInfantilTab() {
  const { comandes, loading, error, load } = useComandesInfantil()
  const { materials, load: loadMaterials } = useMaterialsInfantil()
  const config = useConfigStore((s) => s.config)
  const getValues = useConfigStore((s) => s.getValues)
  const cursActiu = getValues('material-infantil.curs-actiu')[0]

  useEffect(() => { load(); loadMaterials() }, [load, loadMaterials])

  const linies = useMemo(() => {
    return comandes
      .filter((c) => c.CursEscolar === cursActiu)
      .map((c) => {
        const material = materials.find((m) => m.id === c.MaterialId)
        const nAlumnes = nreAlumnesFromConfig(config, c.Etapa)
        const nb = material ? necessitatBase(material.UnitatsPerAlumne, nAlumnes) : 0
        const quantitat = quantitatADemanar(nb, c.MargeSeguretat, c.EstocAplicat)
        const cost = material ? costEstimat(quantitat, material.PreuUnitari) : 0
        return { comanda: c, material, quantitat, cost }
      })
      .sort((a, b) => a.comanda.Etapa.localeCompare(b.comanda.Etapa) || (a.material?.Nom ?? '').localeCompare(b.material?.Nom ?? ''))
  }, [comandes, materials, config, cursActiu])

  const totalsPerEtapa = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of ETAPES_INFANTIL) map.set(e, 0)
    for (const l of linies) map.set(l.comanda.Etapa, (map.get(l.comanda.Etapa) ?? 0) + l.cost)
    return map
  }, [linies])

  const totalGeneral = linies.reduce((s, l) => s + l.cost, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200">
        <p className="text-sm text-gray-500">
          Consolidat del curs <span className="font-semibold text-text-main">{cursActiu}</span> —{' '}
          {ETAPES_INFANTIL.map((e) => `${e}: ${(totalsPerEtapa.get(e) ?? 0).toFixed(2)}€`).join(' · ')}
        </p>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Etapa</th>
              <th className="px-3 py-2.5 font-medium">Material</th>
              <th className="px-3 py-2.5 font-medium">Categoria</th>
              <th className="px-3 py-2.5 font-medium text-right">Quantitat a demanar</th>
              <th className="px-3 py-2.5 font-medium text-right">Cost</th>
              <th className="px-3 py-2.5 font-medium">Estat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && linies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  Encara no hi ha línies de comanda pel curs {cursActiu}.
                </td>
              </tr>
            )}
            {linies.map(({ comanda, material, quantitat, cost }) => (
              <tr key={comanda.id}>
                <td className="px-3 py-2.5 font-medium text-text-main">{comanda.Etapa}</td>
                <td className="px-3 py-2.5 text-text-main">{material?.Nom ?? '(material eliminat)'}</td>
                <td className="px-3 py-2.5 text-gray-600">{material?.Categoria ?? '—'}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-text-main">{quantitat}</td>
                <td className="px-3 py-2.5 text-right text-gray-600">{cost.toFixed(2)}€</td>
                <td className="px-3 py-2.5 text-gray-600">{comanda.Estat}</td>
              </tr>
            ))}
          </tbody>
          {linies.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-200">
                <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">Total general</td>
                <td className="px-3 py-2.5 text-right font-bold text-text-main">{totalGeneral.toFixed(2)}€</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
