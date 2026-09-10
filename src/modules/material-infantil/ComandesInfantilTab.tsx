import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { useComandesInfantil } from './useComandesInfantil'
import { useMaterialsInfantil } from './useMaterialsInfantil'
import { useConfigStore } from '../../store/configStore'
import { ETAPES_INFANTIL } from './types'
import type { ComandaInfantil, EtapaInfantil } from './types'
import { necessitatBase, quantitatADemanar, costEstimat, nreAlumnesFromConfig } from './materialInfantil.utils'
import { ComandaInfantilForm } from './ComandaInfantilForm'

interface Props {
  potGestionar: boolean
}

export function ComandesInfantilTab({ potGestionar }: Props) {
  const { comandes, loading, error, load, crear, eliminar } = useComandesInfantil()
  const { materials, load: loadMaterials } = useMaterialsInfantil()
  const config = useConfigStore((s) => s.config)
  const getValues = useConfigStore((s) => s.getValues)
  const cursActiu = getValues('material-infantil.curs-actiu')[0]
  const [etapa, setEtapa] = useState<EtapaInfantil>('I3')
  const [formObert, setFormObert] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null)
  const [eliminant, setEliminant] = useState(false)

  useEffect(() => { load(); loadMaterials() }, [load, loadMaterials])

  const nAlumnes = nreAlumnesFromConfig(config, etapa)

  const linies = useMemo(() => {
    return comandes
      .filter((c) => c.CursEscolar === cursActiu && c.Etapa === etapa)
      .map((c) => {
        const material = materials.find((m) => m.id === c.MaterialId)
        const nb = material ? necessitatBase(material.UnitatsPerAlumne, nAlumnes) : 0
        const quantitat = quantitatADemanar(nb, c.MargeSeguretat, c.EstocAplicat)
        const cost = material ? costEstimat(quantitat, material.PreuUnitari) : 0
        return { comanda: c, material, necessitatBase: nb, quantitat, cost }
      })
      .sort((a, b) => (a.material?.Nom ?? '').localeCompare(b.material?.Nom ?? ''))
  }, [comandes, materials, cursActiu, etapa, nAlumnes])

  const totalCost = linies.reduce((s, l) => s + l.cost, 0)

  async function handleEliminar(c: ComandaInfantil) {
    setEliminant(true)
    try {
      await eliminar(c)
      setConfirmEliminar(null)
    } catch (err) {
      useComandesInfantil.setState({ error: err instanceof Error ? err.message : 'Error eliminant la línia' })
    } finally {
      setEliminant(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {ETAPES_INFANTIL.map((e) => (
              <button
                key={e}
                onClick={() => setEtapa(e)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  etapa === e ? 'bg-white text-text-main shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">Curs {cursActiu} · {nAlumnes} alumnes</span>
        </div>
        {potGestionar && (
          <button
            onClick={() => setFormObert(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
            style={{ backgroundColor: '#861414' }}
          >
            <Plus size={14} /> Afegeix línia
          </button>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Material</th>
              <th className="px-3 py-2.5 font-medium text-right">Necessitat</th>
              <th className="px-3 py-2.5 font-medium text-right">Estoc aplicat</th>
              <th className="px-3 py-2.5 font-medium text-right">Marge</th>
              <th className="px-3 py-2.5 font-medium text-right">A demanar</th>
              <th className="px-3 py-2.5 font-medium text-right">Cost</th>
              <th className="px-3 py-2.5 font-medium">Estat</th>
              {potGestionar && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && linies.length === 0 && (
              <tr>
                <td colSpan={potGestionar ? 8 : 7} className="px-3 py-8 text-center text-gray-400">
                  Encara no hi ha línies per {etapa} al curs {cursActiu}.
                </td>
              </tr>
            )}
            {linies.map(({ comanda, material, necessitatBase: nb, quantitat, cost }) => (
              <tr key={comanda.id}>
                <td className="px-3 py-2.5 text-text-main">{material?.Nom ?? '(material eliminat)'}</td>
                <td className="px-3 py-2.5 text-right text-gray-600">{nb}</td>
                <td className="px-3 py-2.5 text-right text-gray-600">{comanda.EstocAplicat}</td>
                <td className="px-3 py-2.5 text-right text-gray-600">{comanda.MargeSeguretat}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-text-main">{quantitat}</td>
                <td className="px-3 py-2.5 text-right text-gray-600">{cost.toFixed(2)}€</td>
                <td className="px-3 py-2.5 text-gray-600">{comanda.Estat}</td>
                {potGestionar && (
                  <td className="px-3 py-2.5 text-right">
                    {confirmEliminar === comanda.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEliminar(comanda)}
                          disabled={eliminant}
                          className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded disabled:opacity-60"
                        >
                          {eliminant ? <Loader2 size={12} className="animate-spin" /> : 'Sí'}
                        </button>
                        <button
                          onClick={() => setConfirmEliminar(null)}
                          disabled={eliminant}
                          className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded disabled:opacity-60"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmEliminar(comanda.id)} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {linies.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-200">
                <td colSpan={5} className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">Total</td>
                <td className="px-3 py-2.5 text-right font-bold text-text-main">{totalCost.toFixed(2)}€</td>
                <td colSpan={potGestionar ? 2 : 1} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {formObert && (
        <ComandaInfantilForm
          etapa={etapa}
          cursEscolar={cursActiu}
          materials={materials}
          comandesExistents={comandes}
          onDesar={async (data) => { await crear(data); setFormObert(false) }}
          onCancel={() => setFormObert(false)}
        />
      )}
    </div>
  )
}
