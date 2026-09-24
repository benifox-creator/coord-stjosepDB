import { useState } from 'react'
import { X, Loader2, Download } from 'lucide-react'
import type { Excursio } from './types'
import { pendentsDePressupost, passatgers, generaExcelPressupost, type QueEsDemana } from './pressupostExport.utils'

interface Props {
  excursions: Excursio[]
  ambAutocars: ReadonlySet<string>
  empreses: string[]
  curs: string
  /**
   * Si qui mira pot veure els costos. `ambAutocars` ve buit igualment quan no
   * hi pot accedir —l'RLS li nega la lectura, no li diu "cap sortida en té"—
   * i per això la llista de pendents sembla, per a ell, la mateixa que si de
   * debò no n'hi hagués cap. Aquesta propietat és l'única manera de distingir
   * les dues situacions: no es dedueix mai de si `ambAutocars` és buit.
   */
  potVeureCostos: boolean
  onClose: () => void
}

const OPCIONS_DEMANA: { valor: QueEsDemana; etiqueta: string }[] = [
  { valor: 'autocar', etiqueta: 'Autocar' },
  { valor: 'activitat', etiqueta: 'Activitat' },
  { valor: 'ambdues', etiqueta: 'Ambdues' },
]

export function DemanarPressupostModal({ excursions, ambAutocars, empreses, curs, potVeureCostos, onClose }: Props) {
  const pendents = pendentsDePressupost(excursions, ambAutocars)
  const [empresa, setEmpresa] = useState(empreses[0] ?? '')
  const [demana, setDemana] = useState<QueEsDemana>('autocar')
  const [seleccionades, setSeleccionades] = useState<Set<string>>(() => new Set(pendents.map((e) => e.id)))
  const [generant, setGenerant] = useState(false)
  const [error, setError] = useState('')

  function toggle(id: string) {
    setSeleccionades((actuals) => {
      const properes = new Set(actuals)
      if (properes.has(id)) properes.delete(id)
      else properes.add(id)
      return properes
    })
  }

  async function handleBaixa() {
    const triades = pendents.filter((e) => seleccionades.has(e.id))
    if (triades.length === 0) return
    setGenerant(true)
    setError('')
    try {
      await generaExcelPressupost(triades, demana, empresa, curs)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generant el full.')
      setGenerant(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-text-main">Demana un pressupost a una empresa d’autocars</h2>
          <button onClick={() => { if (!generant) onClose() }} disabled={generant} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="flex flex-wrap items-start gap-4">
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              Empresa
              {empreses.length > 0 ? (
                <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg min-w-48">
                  {empreses.map((emp) => <option key={emp} value={emp}>{emp}</option>)}
                </select>
              ) : (
                <input type="text" value={empresa} onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Nom de l’empresa"
                  className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg min-w-48" />
              )}
            </label>

            <fieldset className="flex flex-col gap-1 text-xs text-gray-500">
              <legend className="mb-1">Què es demana</legend>
              <div className="flex gap-3">
                {OPCIONS_DEMANA.map((op) => (
                  <label key={op.valor} className="flex items-center gap-1.5 text-text-main">
                    <input type="radio" name="demana" checked={demana === op.valor} onChange={() => setDemana(op.valor)} />
                    {op.etiqueta}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {empreses.length === 0 && (
            <p className="text-xs text-gray-500">Es pot configurar la llista d’empreses a Configuració.</p>
          )}

          {!potVeureCostos && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No pots veure els costos: aquesta llista no pot distingir les sortides que ja tenen un pressupost
              demanat de les que no. Pot ser que alguna de les que hi surten ja en tingui un.
            </p>
          )}

          {pendents.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Cap sortida aprovada amb autocar i sense preu.</p>
          ) : (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {pendents.map((e) => (
                <label key={e.id} className="flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={seleccionades.has(e.id)} onChange={() => toggle(e.id)} />
                  <span className="text-text-main w-24 shrink-0">{e.Codi}</span>
                  <span className="text-gray-500 w-24 shrink-0">{e.Data}</span>
                  <span className="flex-1 text-text-main truncate">{e.Lloc}</span>
                  <span className="text-gray-500 shrink-0">{passatgers(e)} passatgers</span>
                </label>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500">
            El full que es genera no porta cap preu ni cap nom; s’envia a l’empresa com sempre.
          </p>

          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} disabled={generant} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel·la
          </button>
          <button
            onClick={() => void handleBaixa()}
            disabled={generant || seleccionades.size === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#861414' }}
          >
            {generant ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Baixa el full
          </button>
        </div>
      </div>
    </div>
  )
}
