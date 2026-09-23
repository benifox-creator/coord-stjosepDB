import { GraficEtapes } from './GraficEtapes'
import type { ResumCurs, MotiuFora } from './balanc'

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })

const MOTIUS: Record<MotiuFora, string> = {
  'sense-pagaments': 'sense pagaments apuntats',
  'sense-preu': 'sense preu confirmat',
}

/** Una xifra gran amb el seu denominador a sota: una xifra sola no es pot jutjar. */
function Xifra({ etiqueta, valor, detall, to }: {
  etiqueta: string
  valor: string
  detall: string
  to?: 'verd' | 'roig'
}) {
  return (
    <div className="sm:flex-1 sm:min-w-[128px] border border-gray-200 rounded-xl px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">{etiqueta}</p>
      <p className={`text-xl font-semibold ${
        to === 'verd' ? 'text-emerald-700' : to === 'roig' ? 'text-red-700' : 'text-text-main'
      }`}>{valor}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{detall}</p>
    </div>
  )
}

export function PanellEconomic({ resum, curs, cursos, loading, error, onCurs }: {
  resum: ResumCurs
  curs: string
  cursos: string[]
  loading: boolean
  error: string | null
  onCurs: (curs: string) => void
}) {
  const { fetes, perVenir, foraDelCoixi, compten, resTancat, totals } = resum

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <h1 className="text-lg font-semibold text-text-main">Economia de les sortides</h1>
        <div className="flex items-center gap-2">
          <select
            value={curs}
            onChange={(ev) => onCurs(ev.target.value)}
            aria-label="Curs escolar"
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm"
          >
            {cursos.map((c) => <option key={c} value={c}>Curs {c}</option>)}
          </select>
          {/* Apagat i amb el motiu escrit, no amagat: amagar-lo faria pensar
              que la comparació no existeix. */}
          <span className="text-xs text-gray-500" title="Farà falta un segon curs amb sortides per poder comparar.">
            Comparar entre cursos: quan hi hagi un segon curs
          </span>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-red-700 mb-4">{error}</p>}
      {loading && <p className="text-xs text-gray-500 mb-4">Carregant…</p>}

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 mb-5">
        <Xifra
          etiqueta="Ha entrat"
          valor={resTancat ? '—' : eur(totals.haEntrat)}
          detall={resTancat
            ? 'cap sortida tancada encara'
            : `de ${compten} ${compten === 1 ? 'sortida feta' : 'sortides fetes'}`}
        />
        <Xifra
          etiqueta="Ha costat"
          valor={resTancat ? '—' : eur(totals.haCostat)}
          detall="autocars, activitats i acompanyants"
        />
        <Xifra
          etiqueta="Coixí"
          valor={resTancat ? '—' : eur(totals.coixi)}
          detall={resTancat ? 'no hi ha res tancat' : totals.coixi < 0 ? 'no cobreix' : 'cobreix'}
          to={resTancat ? undefined : totals.coixi < 0 ? 'roig' : 'verd'}
        />
        <Xifra
          etiqueta="Pendent de cobrar"
          valor={eur(totals.pendent)}
          detall={`${perVenir.length} ${perVenir.length === 1 ? 'sortida' : 'sortides'} per venir`}
        />
      </div>

      <GraficEtapes fetes={fetes} />

      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
        Fetes — {fetes.length} {fetes.length === 1 ? 'sortida' : 'sortides'}
      </p>
      {fetes.length === 0
        ? <p className="text-sm text-gray-500 italic mb-5">Encara no ha passat cap sortida d’aquest curs.</p>
        : (
          <div className="overflow-x-auto mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="text-left font-medium py-1.5 px-2 border-b border-gray-200">Sortida</th>
                  <th className="text-left font-medium py-1.5 px-2 border-b border-gray-200">Etapa</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Paguen</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Ha costat</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Ha entrat</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Coixí</th>
                </tr>
              </thead>
              <tbody>
                {fetes.map((f) => (
                  <tr key={f.id} className="border-b border-gray-100">
                    <td className="py-1.5 px-2 text-text-main">{f.lloc}</td>
                    <td className="py-1.5 px-2 text-gray-500">{f.etapa}</td>
                    <td className="py-1.5 px-2 text-right text-gray-500">{f.assistents} / {f.previstos}</td>
                    <td className="py-1.5 px-2 text-right">{eur(f.haCostat)}</td>
                    <td className="py-1.5 px-2 text-right">{f.foraDelCoixi ? '—' : eur(f.haEntrat)}</td>
                    <td className={`py-1.5 px-2 text-right ${
                      f.foraDelCoixi ? 'text-gray-500' : f.coixi < 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}>
                      {f.foraDelCoixi ? MOTIUS[f.foraDelCoixi] : eur(f.coixi)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
        Per venir — {perVenir.length} {perVenir.length === 1 ? 'sortida' : 'sortides'}
      </p>
      {perVenir.length === 0
        ? <p className="text-sm text-gray-500 italic">No queda cap sortida aprovada per fer aquest curs.</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="text-left font-medium py-1.5 px-2 border-b border-gray-200">Sortida</th>
                  <th className="text-left font-medium py-1.5 px-2 border-b border-gray-200">Etapa</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Data</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Costarà</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Hauria d’entrar</th>
                  <th className="text-right font-medium py-1.5 px-2 border-b border-gray-200">Cobrat</th>
                </tr>
              </thead>
              <tbody>
                {perVenir.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-1.5 px-2 text-text-main">{p.lloc}</td>
                    <td className="py-1.5 px-2 text-gray-500">{p.etapa}</td>
                    <td className="py-1.5 px-2 text-right text-gray-500">{p.data ?? 'sense data'}</td>
                    <td className="py-1.5 px-2 text-right">{eur(p.costara)}</td>
                    <td className="py-1.5 px-2 text-right">
                      {p.hauriaDEntrar === null ? 'falta confirmar el preu' : eur(p.hauriaDEntrar)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-500">
                      {p.cobrat === 0 ? '—' : eur(p.cobrat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {foraDelCoixi.length > 0 && (
        <div className="mt-5 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <strong>
            {foraDelCoixi.length === 1
              ? '1 sortida feta no compta al coixí'
              : `${foraDelCoixi.length} sortides fetes no compten al coixí`}
          </strong>
          {' — '}
          {foraDelCoixi.map((f) => `${f.lloc} (${MOTIUS[f.foraDelCoixi as MotiuFora]})`).join(', ')}.
          {' '}Sense aquestes dades, la xifra diria que s’hi ha perdut tot el que ha costat.
        </div>
      )}
    </div>
  )
}
