import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Finances, Autocar } from './finances.types'
import type { ParametresPreu } from './preu'
import { calculaPreu } from './preu'
import { preuEsValid } from './preuValid'

interface Props {
  finances: Finances
  parametres: ParametresPreu
  alumnes: number
  acompanyants: number
  preuConfirmat: number | null
  confirmatPer: string | null
  potConfirmar: boolean
  // Ve de la fitxa: mentre es desa o es confirma no es pot tornar a clicar,
  // ni tampoc aprovar/rebutjar/reservar/cancel·lar des del mateix formulari.
  ocupat: boolean
  onCanvia: (f: Finances) => void
  onDesa: () => Promise<void>
  onConfirma: (preu: number) => Promise<void>
}

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })

export function BlocEconomic({
  finances: f, parametres, alumnes, acompanyants,
  preuConfirmat, confirmatPer, potConfirmar, ocupat, onCanvia, onDesa, onConfirma,
}: Props) {
  const resultat = useMemo(() => calculaPreu({
    alumnes, autocars: f.Autocars.map((a) => a.Preu),
    preuActivitat: f.PreuActivitat, preuActivitatTipus: f.PreuActivitatTipus,
    ampaImport: f.AmpaImport, ampaCobreixActivitat: f.AmpaCobreixActivitat,
    costAcompanyants: f.CostAcompanyants,
  }, parametres), [f, parametres, alumnes])
  const preuOk = preuEsValid(resultat.preu)

  function autocar(id: string, canvis: Partial<Autocar>) {
    onCanvia({ ...f, Autocars: f.Autocars.map((a) => (a.id === id ? { ...a, ...canvis } : a)) })
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-text-main">Costos i preu</h3>

      <div className="space-y-2">
        <p className="text-xs text-gray-400">Autocars — un per vehicle, preu sense IVA</p>
        {f.Autocars.map((a) => (
          <div key={a.id} className="flex items-center gap-2">
            <input type="number" min={0} value={a.Places} aria-label="Places"
              onChange={(e) => autocar(a.id, { Places: Number(e.target.value) })}
              className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg" />
            <input type="number" min={0} step="0.01" value={a.Preu} aria-label="Preu de l’autocar"
              onChange={(e) => autocar(a.id, { Preu: Number(e.target.value) })}
              className="w-32 px-2 py-1 text-sm border border-gray-200 rounded-lg" />
            <button onClick={() => onCanvia({ ...f, Autocars: f.Autocars.filter((x) => x.id !== a.id) })}
              aria-label="Treu l’autocar" className="p-1 text-gray-300 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={() => onCanvia({ ...f, Autocars: [...f.Autocars, { id: `nou-${Date.now()}`, Places: 55, Preu: 0 }] })}
          className="flex items-center gap-1 text-xs text-primary">
          <Plus size={12} /> Afegeix un autocar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-500">Activitat</label>
        <input type="number" min={0} step="0.01" value={f.PreuActivitat} aria-label="Preu de l’activitat"
          onChange={(e) => onCanvia({ ...f, PreuActivitat: Number(e.target.value) })}
          className="w-32 px-2 py-1 text-sm border border-gray-200 rounded-lg" />
        <select value={f.PreuActivitatTipus} aria-label="Com es compta l’activitat"
          onChange={(e) => onCanvia({ ...f, PreuActivitatTipus: e.target.value as Finances['PreuActivitatTipus'] })}
          className="px-2 py-1 text-sm border border-gray-200 rounded-lg">
          <option value="per_alumne">per alumne</option>
          <option value="total">en total</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-500">AMPA</label>
        <input type="number" min={0} step="0.01" value={f.AmpaImport} aria-label="Aportació de l’AMPA per alumne"
          onChange={(e) => onCanvia({ ...f, AmpaImport: Number(e.target.value) })}
          className="w-32 px-2 py-1 text-sm border border-gray-200 rounded-lg" />
        <label className="flex items-center gap-1 text-xs text-gray-500">
          <input type="checkbox" checked={f.AmpaCobreixActivitat}
            onChange={(e) => onCanvia({ ...f, AmpaCobreixActivitat: e.target.checked })} />
          cobreix l’activitat sencera
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-500">Cost dels acompanyants</label>
        <input type="number" min={0} step="0.01" value={f.CostAcompanyants} aria-label="Cost dels acompanyants"
          onChange={(e) => onCanvia({ ...f, CostAcompanyants: Number(e.target.value) })}
          className="w-32 px-2 py-1 text-sm border border-gray-200 rounded-lg" />
      </div>

      {/* El desglossament i no només el resultat: qui ha de confirmar un preu
          ha de poder veure d'on surt. Un número sol no es pot revisar. */}
      <dl className="text-xs text-gray-500 space-y-1 border-t border-gray-100 pt-3">
        <div className="flex justify-between"><dt>Alumnes que s’espera que paguin</dt>
          {/* `esperats` no s'arrodoneix a preu.ts a propòsit (hi entra en el
              càlcul tal qual); aquí, en canvi, és només per llegir, i "66,75
              alumnes" no vol dir res a qui ho mira. */}
          <dd>{Math.round(resultat.esperats)} de {alumnes} ({Math.round(parametres.previsio * 100)} %)</dd></div>
        {/* Els acompanyants no paguen i no entren al càlcul, però qui confirma
            el preu ha de saber quants n'hi ha: el seu cost sí que es reparteix. */}
        <div className="flex justify-between"><dt>Acompanyants</dt><dd>{acompanyants}</dd></div>
        <div className="flex justify-between"><dt>Costos fixos (IVA inclòs)</dt><dd>{eur(resultat.costosFixos)}</dd></div>
        <div className="flex justify-between"><dt>Cost per alumne</dt><dd>{eur(resultat.costAlumne)}</dd></div>
        <div className="flex justify-between"><dt>Un cop restada l’AMPA</dt><dd>{eur(resultat.base)}</dd></div>
        <div className="flex justify-between font-medium text-text-main">
          <dt>Preu amb el marge del {parametres.margePct} %</dt><dd>{eur(resultat.preu)}</dd></div>
      </dl>

      {/* Ni desar ni confirmar mentre hi ha una crida en curs (`ocupat`) o
          mentre el preu calculat no sigui un número vàlid: un preu NaN
          confirmat es convertiria en `null` en arribar al servidor, i "sense
          preu" no és el mateix que "encara no calculat". */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => void onDesa()} disabled={ocupat || !preuOk}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-50">
          Desa els costos
        </button>
        {potConfirmar && (
          <button onClick={() => void onConfirma(resultat.preu)} disabled={ocupat || !preuOk}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg disabled:opacity-50">
            {preuConfirmat === null ? 'Confirma el preu' : 'Torna a confirmar'}
          </button>
        )}
        {!preuOk && <p className="text-xs text-red-600 w-full">El preu no es pot calcular: revisa els imports.</p>}
      </div>

      {preuConfirmat !== null && (
        <p className="text-xs text-gray-400">
          Preu confirmat: <span className="font-medium text-text-main">{eur(preuConfirmat)}</span>
          {confirmatPer && ` · ${confirmatPer}`}
          {resultat.preu !== preuConfirmat && ' · el càlcul d’ara en dona un altre; tornar a confirmar el canviarà'}
        </p>
      )}
    </section>
  )
}
