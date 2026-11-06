import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Loader2, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { useMaterialsInfantil } from './useMaterialsInfantil'
import { useProveidorsInfantil } from './useProveidorsInfantil'
import { MaterialInfantilForm } from './MaterialInfantilForm'
import { ImportarMaterialsModal } from './ImportarMaterialsModal'
import { estocDisponible } from './materialInfantil.utils'
import { useConfigStore } from '../../store/configStore'
import type { MaterialInfantil } from './types'
import { BarraFiltres } from '../../components/filtres/BarraFiltres'
import type { DefinicioFiltre } from '../../components/filtres/filtres'
import { opcions } from '../../components/filtres/filtres'
import { useValorsFiltres } from '../../components/filtres/useValorsFiltres'

interface Props {
  potGestionar: boolean
}

export function CatalegInfantilTab({ potGestionar }: Props) {
  const { materials, loading, error, load, crear, editar, eliminar, importarMassiu } = useMaterialsInfantil()
  const { proveidors, load: loadProveidors } = useProveidorsInfantil()
  const categories = useConfigStore((s) => s.getValues('material-infantil.categories'))
  const [cerca, setCerca] = useState('')
  const { valors, canvia, esborra } = useValorsFiltres({ categoria: '' })
  const [nomesEstocBaix, setNomesEstocBaix] = useState(false)
  const [formObert, setFormObert] = useState(false)
  const [importObert, setImportObert] = useState(false)
  const [editant, setEditant] = useState<MaterialInfantil | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null)
  const [eliminant, setEliminant] = useState(false)

  useEffect(() => { load(); loadProveidors() }, [load, loadProveidors])

  const definicions: DefinicioFiltre[] = [
    { clau: 'categoria', label: 'Categoria', tipus: 'select', totes: 'Totes', opcions: opcions(categories) },
  ]

  const filtrats = useMemo(() => {
    const q = cerca.toLowerCase()
    return materials
      .filter((m) => {
        if (valors.categoria && m.Categoria !== valors.categoria) return false
        if (nomesEstocBaix && estocDisponible(m) > 0) return false
        if (!q) return true
        const proveidorNom = proveidors.find((p) => p.id === m.ProveidorId)?.Nom ?? ''
        return `${m.Codi} ${m.Nom} ${m.Categoria} ${proveidorNom}`.toLowerCase().includes(q)
      })
      .sort((a, b) => a.Nom.localeCompare(b.Nom))
  }, [materials, proveidors, cerca, valors, nomesEstocBaix])

  async function handleEliminar(m: MaterialInfantil) {
    setEliminant(true)
    try {
      await eliminar(m)
      setConfirmEliminar(null)
    } catch (err) {
      useMaterialsInfantil.setState({ error: err instanceof Error ? err.message : 'Error eliminant el material' })
    } finally {
      setEliminant(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200">
        <BarraFiltres
          definicions={definicions}
          valors={valors}
          onCanvia={canvia}
          onEsborra={esborra}
          cerca={cerca}
          onCerca={setCerca}
          placeholder="Cercar material..."
        >
          <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap px-1">
            <input
              type="checkbox"
              checked={nomesEstocBaix}
              onChange={(e) => setNomesEstocBaix(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary/30"
            />
            Només amb estoc baix o zero
          </label>
          {potGestionar && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportObert(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
              >
                <FileSpreadsheet size={14} /> Importa des d'Excel
              </button>
              <button
                onClick={() => setFormObert(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
                style={{ backgroundColor: '#861414' }}
              >
                <Plus size={14} /> Nou material
              </button>
            </div>
          )}
        </BarraFiltres>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Codi</th>
              <th className="px-3 py-2.5 font-medium">Material</th>
              <th className="px-3 py-2.5 font-medium">Categoria</th>
              <th className="px-3 py-2.5 font-medium text-right">Preu</th>
              <th className="px-3 py-2.5 font-medium text-right">Estoc disponible</th>
              {potGestionar && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && filtrats.length === 0 && (
              <tr>
                <td colSpan={potGestionar ? 6 : 5} className="px-3 py-8 text-center text-gray-400">
                  {materials.length === 0 ? 'Encara no hi ha materials registrats.' : 'Cap material coincideix amb els filtres.'}
                </td>
              </tr>
            )}
            {filtrats.map((m) => {
              const estoc = estocDisponible(m)
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td
                    className={`px-3 py-2.5 text-primary font-semibold ${potGestionar ? 'cursor-pointer' : ''}`}
                    onClick={() => potGestionar && setEditant(m)}
                  >
                    {m.Codi}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-text-main ${potGestionar ? 'cursor-pointer' : ''}`}
                    onClick={() => potGestionar && setEditant(m)}
                  >
                    {m.Nom}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{m.Categoria}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{m.PreuUnitari.toFixed(2)}€</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`font-medium ${estoc <= 0 ? 'text-red-600' : 'text-text-main'}`}>
                      {estoc <= 0 && <AlertTriangle size={12} className="inline mr-1 -mt-0.5" />}
                      {estoc} {m.Unitat}
                    </span>
                  </td>
                  {potGestionar && (
                    <td className="px-3 py-2.5 text-right">
                      {confirmEliminar === m.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEliminar(m)}
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
                        <button onClick={() => setConfirmEliminar(m.id)} className="text-gray-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {importObert && (
        <ImportarMaterialsModal
          proveidors={proveidors}
          onImportar={importarMassiu}
          onClose={() => setImportObert(false)}
        />
      )}
      {formObert && (
        <MaterialInfantilForm proveidors={proveidors} onClose={() => setFormObert(false)} onGuardar={crear} />
      )}
      {editant && (
        <MaterialInfantilForm
          proveidors={proveidors}
          inicial={{
            Nom: editant.Nom, Categoria: editant.Categoria, Unitat: editant.Unitat, ProveidorId: editant.ProveidorId,
            PreuUnitari: editant.PreuUnitari, UnitatsPerAlumne: editant.UnitatsPerAlumne, ComandaHabitual: editant.ComandaHabitual,
            RecompteManual: editant.RecompteManual, EntradesRebudes: editant.EntradesRebudes, ConsumManual: editant.ConsumManual,
            Notes: editant.Notes,
          }}
          onClose={() => setEditant(null)}
          onGuardar={(data) => editar(editant, data)}
        />
      )}
    </div>
  )
}
