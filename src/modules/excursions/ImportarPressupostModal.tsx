import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Loader2, Upload, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { Excursio } from './types'
import {
  parsejaExcelPressupost, COLUMNES_DE_PREU,
  type FilaPressupost, type PreusImportats,
} from './pressupostImport.utils'
import { ambIva } from './preu'
import type { ResultatImportPressupostos } from './useFinances'

interface Props {
  excursions: Excursio[]
  ambAutocars: ReadonlyMap<string, { quants: number; total: number }>
  ivaPct: number
  onImportar: (items: { excursioId: string; codi: string; dades: PreusImportats }[]) => Promise<ResultatImportPressupostos>
  onClose: () => void
}

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })

/** El que aquesta fila portarà a la fitxa, en net i, quan el full ve amb IVA, també en brut al costat. */
function queEntra(dades: PreusImportats, portaIva: boolean, ivaPct: number): string {
  const parts: string[] = []
  if (dades.autocars.length > 0) {
    const n = dades.autocars.length
    const total = dades.autocars.reduce((s, a) => s + a.preu, 0)
    parts.push(`${n} ${n === 1 ? 'autocar' : 'autocars'} · ${eur(total)}${portaIva ? ` net (${eur(ambIva(total, ivaPct))} brut)` : ''}`)
  }
  if (dades.preuActivitat !== undefined) {
    const unitat = dades.preuActivitatTipus === 'per_alumne' ? 'per alumne' : 'del grup'
    parts.push(`activitat ${eur(dades.preuActivitat)} ${unitat}${portaIva ? ` net (${eur(ambIva(dades.preuActivitat, ivaPct))} brut)` : ''}`)
  }
  return parts.join(' · ')
}

function esValidaCompleta(f: FilaPressupost): f is FilaPressupost & { excursioId: string; data: PreusImportats } {
  return f.valid && !!f.excursioId && !!f.data
}

export function ImportarPressupostModal({ excursions, ambAutocars, ivaPct, onImportar, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [portaIva, setPortaIva] = useState(false)
  const [important, setImportant] = useState(false)
  const [error, setError] = useState('')
  const [errorFull, setErrorFull] = useState('')
  const [analitzat, setAnalitzat] = useState<{ columnes: string[]; files: FilaPressupost[] } | null>(null)
  const [fallits, setFallits] = useState<ResultatImportPressupostos | null>(null)
  const [llegint, setLlegint] = useState(false)

  // Comptador de generació: si es tria un fitxer i tot seguit es toca la
  // casella de l'IVA, hi ha dues lectures en curs i la primera pot arribar
  // després de la segona. Cada gestor que engega una lectura nova l'ha de
  // guanyar, així que només s'escriu l'estat si la resposta és de la darrera
  // crida (mateix patró que `generacio` a useExcursions.ts).
  const generacioRef = useRef(0)

  // `analitzat`, `errorFull` i `llegint` es netegen als gestors (handleFile
  // i el canvi de casella), no aquí: aquest efecte només fa l'E/S i, en
  // resoldre's, escriu el resultat. Cap `setState` al cos de l'efecte.
  useEffect(() => {
    if (!file) return
    const meva = ++generacioRef.current
    parsejaExcelPressupost(file, excursions, ambAutocars, portaIva, ivaPct)
      .then((res) => {
        if (meva !== generacioRef.current) return
        setAnalitzat(res)
        setErrorFull('')
        setLlegint(false)
      })
      .catch((err) => {
        if (meva !== generacioRef.current) return
        setAnalitzat(null)
        setErrorFull(err instanceof Error ? err.message : 'Error llegint el fitxer.')
        setLlegint(false)
      })
  }, [file, excursions, ambAutocars, portaIva, ivaPct])

  const resultat = analitzat?.files ?? null
  const columnesReconegudes = analitzat?.columnes ?? []
  const columnesAbsents = COLUMNES_DE_PREU.filter((c) => !columnesReconegudes.includes(c))

  const valides = useMemo(() => (resultat ?? []).filter(esValidaCompleta), [resultat])
  const ambAvis = valides.filter((f) => f.substitueix)
  const ambError = (resultat ?? []).filter((f) => !f.valid)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const nou = e.target.files?.[0]
    e.target.value = ''
    if (!nou) return
    setError('')
    setFallits(null)
    setAnalitzat(null)
    setErrorFull('')
    setLlegint(true)
    setFile(nou)
  }

  // La lectura només es torna a disparar si ja hi ha un fitxer triat (l'efecte
  // no fa res sense fitxer): si es netegés i es marqués "llegint" igualment
  // sense fitxer, la pantalla es quedaria carregant per sempre, perquè
  // l'efecte mai respondria per apagar-ho.
  function handleIva(e: React.ChangeEvent<HTMLInputElement>) {
    const marcada = e.target.checked
    if (file) {
      setAnalitzat(null)
      setErrorFull('')
      setLlegint(true)
    }
    setPortaIva(marcada)
  }

  async function handleImportar() {
    if (valides.length === 0) return
    setImportant(true)
    setError('')
    try {
      const res = await onImportar(valides.map((f) => ({ excursioId: f.excursioId, codi: f.codi, dades: f.data })))
      // Només es tanca si totes han entrat. Si alguna ha fallat, val més
      // ensenyar quines que no pas donar la importació per bona a mitges.
      if (res.errors.length === 0) {
        onClose()
        return
      }
      setFallits(res)
      setFile(null)
      setAnalitzat(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error important els pressupostos.')
    } finally {
      setImportant(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-text-main">Importa els preus d’un pressupost</h2>
          <button onClick={() => { if (!important) onClose() }} disabled={important} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {!fallits && (
            <>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={portaIva} onChange={handleIva} disabled={important} />
                Els preus d’aquest fitxer porten IVA
              </label>
              <p className="text-xs text-gray-500 -mt-2">Es desarà sempre el net, tingui IVA o no el full.</p>

              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg py-6 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <Upload size={20} className="text-gray-400" />
                <span className="text-sm text-gray-500">{llegint ? 'Llegint el fitxer...' : 'Selecciona un fitxer .xlsx'}</span>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} disabled={llegint || important} />
              </label>
            </>
          )}

          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          {!llegint && errorFull && <p role="alert" className="text-xs text-red-700">{errorFull}</p>}

          {!llegint && analitzat && !errorFull && (
            <div className="text-xs text-gray-500 space-y-1">
              {/* Les quatre columnes surten sempre, trobades o no: quan una
                  empresa reanomena tota una parella, l'única pista que en
                  queda és veure-les totes dues en vermell una al costat de
                  l'altra, no una llista que només diu què hi ha. */}
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Columnes de preu:</span>
                {COLUMNES_DE_PREU.map((c) => {
                  const trobada = columnesReconegudes.includes(c)
                  return (
                    <span key={c} className={`flex items-center gap-1 ${trobada ? 'text-emerald-700' : 'text-red-700'}`}>
                      {trobada ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {c}
                    </span>
                  )
                })}
              </p>
              {columnesAbsents.length > 0 && (
                <p>Si n’hi falta alguna que esperaves, revisa que l’empresa no l’hagi reanomenat.</p>
              )}
            </div>
          )}

          {fallits && (
            <div className="space-y-3">
              <p className="text-sm text-text-main">
                S’han escrit els preus de <strong>{fallits.escrites}</strong> {fallits.escrites === 1 ? 'sortida' : 'sortides'}.
                {' '}Aquestes {fallits.errors.length === 1 ? 'no ha entrat' : 'no han entrat'}:
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-100">
                    {fallits.errors.map((e) => (
                      <tr key={e.codi}>
                        <td className="px-3 py-2 text-text-main">{e.codi}</td>
                        <td className="px-3 py-2 text-red-700">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500">
                Pots tornar a importar el mateix fitxer: les sortides que ja han entrat no es duplicaran.
              </p>
            </div>
          )}

          {!llegint && resultat && !fallits && (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                {valides.length} {valides.length === 1 ? 'fila s’importarà' : 'files s’importaran'}
                {ambAvis.length > 0 && <> · {ambAvis.length} amb {ambAvis.length === 1 ? 'avís' : 'avisos'}</>}
                {ambError.length > 0 && <> · {ambError.length} amb {ambError.length === 1 ? 'error' : 'errors'}</>}
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-left text-gray-500 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 font-medium">Codi</th>
                        <th className="px-3 py-2 font-medium">Destinació</th>
                        <th className="px-3 py-2 font-medium">Què entra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {resultat.map((f) => (
                        <tr key={`${f.codi}-${f.fila}`}>
                          <td className="px-3 py-2 text-text-main">{f.codi}</td>
                          <td className="px-3 py-2 text-text-main">{f.lloc}</td>
                          <td className="px-3 py-2">
                            {f.valid && f.data ? (
                              <div className="space-y-0.5">
                                <span className="flex items-center gap-1 text-emerald-700">
                                  <CheckCircle2 size={12} /> {queEntra(f.data, portaIva, ivaPct)}
                                </span>
                                {f.substitueix && (
                                  <span className="flex items-center gap-1 text-amber-800">
                                    <AlertTriangle size={12} />
                                    substitueix {f.substitueix.quants} {f.substitueix.quants === 1 ? 'autocar' : 'autocars'} ({eur(f.substitueix.total)})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="flex items-center gap-1 text-red-700">
                                <XCircle size={12} /> Fila {f.fila}: {f.error}
                              </span>
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
              onClick={() => void handleImportar()}
              disabled={important || valides.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
              style={{ backgroundColor: '#861414' }}
            >
              {important && <Loader2 size={15} className="animate-spin" />}
              Importa’ls{valides.length > 0 ? ` ${valides.length}` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
