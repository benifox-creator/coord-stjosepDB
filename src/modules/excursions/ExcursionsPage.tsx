import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw, Copy, FileText, Upload } from 'lucide-react'
import type { Excursio } from './types'
import { ESTATS_EXCURSIO, ESTAT_COLORS, ETAPES_EXCURSIO } from './types'

const MESOS = [
  { valor: '09', nom: 'Setembre' }, { valor: '10', nom: 'Octubre' }, { valor: '11', nom: 'Novembre' },
  { valor: '12', nom: 'Desembre' }, { valor: '01', nom: 'Gener' }, { valor: '02', nom: 'Febrer' },
  { valor: '03', nom: 'Març' }, { valor: '04', nom: 'Abril' }, { valor: '05', nom: 'Maig' },
  { valor: '06', nom: 'Juny' },
]

interface Props {
  excursions: Excursio[]
  loading: boolean
  error: string | null
  potAprovar: boolean
  potVeureCostos: boolean
  potGestionar: boolean
  pendentsDePressupostIds: ReadonlySet<string>
  onNova: () => void
  onObrir: (e: Excursio) => void
  onRefresh: () => void
  onAprovar: (ids: string[]) => Promise<void>
  onCopiarCursAnterior: () => void
  onDemanarPressupost: () => void
  onImportarPressupost: () => void
}

export function ExcursionsPage({
  excursions, loading, error, potAprovar, potVeureCostos, potGestionar, pendentsDePressupostIds,
  onNova, onObrir, onRefresh, onAprovar, onCopiarCursAnterior, onDemanarPressupost, onImportarPressupost,
}: Props) {
  const [etapa, setEtapa] = useState('')
  const [estat, setEstat] = useState('')
  const [mes, setMes] = useState('')
  const [nomesPendentsPressupost, setNomesPendentsPressupost] = useState(false)
  const [seleccio, setSeleccio] = useState<string[]>([])
  const [aprovant, setAprovant] = useState(false)

  const visibles = useMemo(() => excursions.filter((e) =>
    (!etapa || e.Etapa === etapa)
    && (!estat || e.Estat === estat)
    && (!mes || (e.Data ?? '').slice(5, 7) === mes)
    && (!nomesPendentsPressupost || pendentsDePressupostIds.has(e.id))
  ), [excursions, etapa, estat, mes, nomesPendentsPressupost, pendentsDePressupostIds])

  const pendents = excursions.filter((e) => e.Estat === 'Proposada').length
  // Només es poden aprovar en bloc les que són visibles i estan proposades: si
  // un filtre n'amaga alguna de seleccionada, no s'ha d'aprovar sense veure-la.
  const aprovables = visibles.filter((e) => seleccio.includes(e.id) && e.Estat === 'Proposada')

  async function handleAprovar() {
    setAprovant(true)
    try {
      await onAprovar(aprovables.map((e) => e.id))
      setSeleccio([])
    } finally {
      setAprovant(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-text-main">Excursions</h1>
            {pendents > 0 && (
              <p className="text-xs text-amber-700 mt-0.5">
                {pendents} {pendents === 1 ? 'proposta pendent' : 'propostes pendents'} d’aprovar
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {potVeureCostos && (
              <Link
                to="/excursions/economia"
                className="text-xs text-gray-500 hover:text-text-main px-2 py-1"
              >
                Economia
              </Link>
            )}
            {potGestionar && (
              <button
                onClick={onDemanarPressupost}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
              >
                <FileText size={13} /> Demana pressupost
              </button>
            )}
            {potVeureCostos && (
              <button
                onClick={onImportarPressupost}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
              >
                <Upload size={13} /> Importa pressupost
              </button>
            )}
            <button onClick={onRefresh} className="p-2 text-gray-400 hover:text-gray-600" aria-label="Actualitza">
              <RefreshCw size={16} />
            </button>
            <button
              onClick={onCopiarCursAnterior}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
            >
              <Copy size={13} /> Copia del curs anterior
            </button>
            <button
              onClick={onNova}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
              style={{ backgroundColor: '#861414' }}
            >
              <Plus size={15} /> Nova excursió
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <select value={etapa} onChange={(e) => setEtapa(e.target.value)} aria-label="Filtra per etapa" className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg">
            <option value="">Totes les etapes</option>
            {ETAPES_EXCURSIO.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={estat} onChange={(e) => setEstat(e.target.value)} aria-label="Filtra per estat" className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg">
            <option value="">Tots els estats</option>
            {ESTATS_EXCURSIO.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Filtra per mes" className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg">
            <option value="">Tot el curs</option>
            {MESOS.map((m) => <option key={m.valor} value={m.valor}>{m.nom}</option>)}
          </select>
          {potVeureCostos && (
            <label className="flex items-center gap-1.5 text-xs text-gray-600 px-1">
              <input
                type="checkbox"
                checked={nomesPendentsPressupost}
                onChange={(e) => setNomesPendentsPressupost(e.target.checked)}
              />
              Només pendents de pressupost
            </label>
          )}
          {potAprovar && aprovables.length > 0 && (
            <button
              onClick={handleAprovar}
              disabled={aprovant}
              className="px-3 py-1.5 text-xs font-medium text-green-800 bg-green-100 rounded-lg disabled:opacity-50"
            >
              {aprovant ? 'Aprovant…' : `Aprova ${aprovables.length}`}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading && <p className="text-xs text-gray-400">Carregant…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {!loading && !error && excursions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">Encara no hi ha cap excursió en aquest curs.</p>
            <p className="text-xs text-gray-400 mt-1">
              Al setembre, el més ràpid és copiar el pla del curs anterior i revisar-lo.
            </p>
            <button
              onClick={onCopiarCursAnterior}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg mx-auto"
              style={{ backgroundColor: '#861414' }}
            >
              <Copy size={14} /> Copia del curs anterior
            </button>
          </div>
        )}
        {!loading && excursions.length > 0 && visibles.length === 0 && (
          <p className="text-sm text-gray-400 italic">Cap excursió amb aquests filtres.</p>
        )}
        {visibles.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  {potAprovar && <th className="px-3 py-2 w-8"></th>}
                  <th className="px-3 py-2 font-medium">Codi</th>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Etapa</th>
                  <th className="px-3 py-2 font-medium">Activitat</th>
                  <th className="px-3 py-2 font-medium">Lloc</th>
                  <th className="px-3 py-2 font-medium">Alumnes</th>
                  <th className="px-3 py-2 font-medium">Estat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibles.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    {potAprovar && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Selecciona ${e.Codi}`}
                          checked={seleccio.includes(e.id)}
                          onChange={(ev) => setSeleccio((s) => ev.target.checked ? [...s, e.id] : s.filter((x) => x !== e.id))}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 text-gray-400">
                      <button type="button" onClick={() => onObrir(e)} className="underline hover:text-primary">{e.Codi}</button>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.Data ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.Etapa}</td>
                    <td className="px-3 py-2 text-text-main">{e.Activitat || '—'}</td>
                    <td className="px-3 py-2">{e.Lloc || '—'}</td>
                    <td className="px-3 py-2">{e.Grups.reduce((s, g) => s + g.AlumnesPrevistos, 0)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full whitespace-nowrap ${ESTAT_COLORS[e.Estat]}`}>{e.Estat}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
