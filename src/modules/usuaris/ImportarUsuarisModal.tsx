import { useState } from 'react'
import { X, Loader2, Download, Upload, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { Usuari } from './types'
import { generarPlantillaExcel, parsejaExcelUsuaris, type FilaImportUsuari, type DadesUsuariImportat } from './excelImport.utils'

export interface ResultatImportacio {
  creats: number
  errors: { correu: string; error: string }[]
}

interface Props {
  usuarisExistents: Usuari[]
  onImportar: (dades: DadesUsuariImportat[]) => Promise<ResultatImportacio>
  onClose: () => void
}

export function ImportarUsuarisModal({ usuarisExistents, onImportar, onClose }: Props) {
  const [resultat, setResultat] = useState<FilaImportUsuari[] | null>(null)
  const [parsing, setParsing] = useState(false)
  const [important, setImportant] = useState(false)
  const [error, setError] = useState('')
  const [fallits, setFallits] = useState<ResultatImportacio | null>(null)

  async function handlePlantilla() {
    try {
      await generarPlantillaExcel()
    } catch {
      setError('No s’ha pogut generar la plantilla.')
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setFallits(null)
    setParsing(true)
    try {
      setResultat(await parsejaExcelUsuaris(file, usuarisExistents))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error llegint el fitxer.')
      setResultat(null)
    } finally {
      setParsing(false)
    }
  }

  const valides = resultat?.filter((f) => f.valid) ?? []
  const jaHiSon = resultat?.filter((f) => f.jaExisteix) ?? []
  const ambError = resultat?.filter((f) => !f.valid && !f.jaExisteix) ?? []

  async function handleImportar() {
    if (valides.length === 0) return
    setImportant(true)
    setError('')
    try {
      const res = await onImportar(valides.map((f) => f.data as DadesUsuariImportat))
      // Només es tanca si han entrat tots. Si algun ha fallat, val més
      // ensenyar quins que no pas donar l'alta per bona i deixar-ho passar.
      if (res.errors.length === 0) {
        onClose()
        return
      }
      setFallits(res)
      setResultat(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error important els usuaris.')
    } finally {
      setImportant(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-text-main">Importa usuaris des d’Excel</h2>
          <button onClick={() => { if (!important) onClose() }} disabled={important} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Cal una columna <strong>Correu</strong> i una de <strong>Nom</strong>. Rol, Etapa i Pot gestionar material són opcionals; sense rol, la persona entra com a Professorat.
            </p>
            <button type="button" onClick={handlePlantilla} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 shrink-0">
              <Download size={13} /> Plantilla
            </button>
          </div>

          {!fallits && (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg py-6 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
              <Upload size={20} className="text-gray-400" />
              <span className="text-sm text-gray-500">{parsing ? 'Llegint el fitxer...' : 'Selecciona un fitxer .xlsx'}</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} disabled={parsing || important} />
            </label>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          {fallits && (
            <div className="space-y-3">
              <p className="text-sm text-text-main">
                S’han donat d’alta <strong>{fallits.creats}</strong> {fallits.creats === 1 ? 'usuari' : 'usuaris'}.
                {' '}Aquests {fallits.errors.length === 1 ? 'no ha entrat' : 'no han entrat'}:
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-100">
                    {fallits.errors.map((e) => (
                      <tr key={e.correu}>
                        <td className="px-3 py-2 text-text-main">{e.correu}</td>
                        <td className="px-3 py-2 text-red-600">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500">
                Els que sí han entrat ja consten a la llista. Pots corregir el full i tornar a importar-lo: els que ja hi són se saltaran.
              </p>
            </div>
          )}

          {resultat && !fallits && (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                {valides.length} {valides.length === 1 ? 'fila es donarà' : 'files es donaran'} d’alta
                {jaHiSon.length > 0 && <> · {jaHiSon.length} ja {jaHiSon.length === 1 ? 'hi és' : 'hi són'}</>}
                {ambError.length > 0 && <> · {ambError.length} amb {ambError.length === 1 ? 'error' : 'errors'}</>}
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-left text-gray-500 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 font-medium">Fila</th>
                        <th className="px-3 py-2 font-medium">Correu</th>
                        <th className="px-3 py-2 font-medium">Estat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {resultat.map((f) => (
                        <tr key={f.fila}>
                          <td className="px-3 py-2 text-gray-400">{f.fila}</td>
                          <td className="px-3 py-2 text-text-main">{f.correu || f.nom || '—'}</td>
                          <td className="px-3 py-2">
                            {f.valid ? (
                              <span className="flex items-center gap-1 text-green-700"><CheckCircle2 size={12} /> {f.nom}</span>
                            ) : f.jaExisteix ? (
                              <span className="flex items-center gap-1 text-amber-700"><AlertTriangle size={12} /> {f.avis}</span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-600"><XCircle size={12} /> {f.error}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button type="button" onClick={onClose} disabled={important} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
            {fallits ? 'Tanca' : 'Cancel·la'}
          </button>
          {!fallits && (
            <button
              onClick={handleImportar}
              disabled={important || valides.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
              style={{ backgroundColor: '#861414' }}
            >
              {important && <Loader2 size={15} className="animate-spin" />}
              Dona d’alta{valides.length > 0 ? ` ${valides.length}` : ''} {valides.length === 1 ? 'usuari' : 'usuaris'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
