// src/modules/excursions/CircularAccions.tsx
//
// El bloc de la circular dins la fitxa. Només ensenya i recull: qui genera el
// document i qui crida el servidor és la fitxa (`ExcursioDetall`), com ja passa
// amb `BlocEconomic`. Així aquest fitxer no arrossega ni `docx` ni cap store.
import { useState } from 'react'
import { FileDown, Send } from 'lucide-react'
import type { Excursio } from './types'
import type { DatesCircular } from './datesCircular'
import { esDiaLectiu } from './excursions.utils'
import { dataLlarga } from './circular/dades'

interface Props {
  excursio: Excursio
  // La proposta ja calculada a fora, amb els dies no lectius i els dos
  // paràmetres de Configuració: aquí només se n'ensenya el resultat.
  datesProposades: DatesCircular
  // Per avisar qui canviï una data que ha triat un dissabte o un festiu. Ve de
  // fora pel mateix camí que la proposta, perquè les dues mirin el mateix
  // calendari: si aquí es llegís la configuració a part, una data podria sortir
  // proposada com a lectiva i marcada com a festiva alhora.
  diesNoLectius: string[]
  ocupat: boolean
  onGenerar: (dates: DatesCircular, nota: string) => Promise<void>
  onEnviar: (dates: DatesCircular) => Promise<void>
}

function Camp({ etiqueta, valor, diesNoLectius, bloquejat, onCanvia }: {
  etiqueta: string
  valor: string
  diesNoLectius: string[]
  bloquejat: boolean
  onCanvia: (v: string) => void
}) {
  const lectiu = valor !== '' && esDiaLectiu(valor, diesNoLectius)
  return (
    <label className="flex flex-col gap-0.5 text-xs text-gray-500">
      {etiqueta}
      <input
        type="date" value={valor} disabled={bloquejat} aria-label={etiqueta}
        onChange={(ev) => onCanvia(ev.target.value)}
        className="px-2 py-1 text-sm border border-gray-200 rounded-lg disabled:bg-gray-50 disabled:text-gray-500"
      />
      {/* El dia de la setmana en lletra, i no només la data: qui en canvia una
          ha de veure de seguida que ha triat un dissabte o un festiu, quan al
          camp només hi surt "03/10/2026". */}
      {valor === ''
        ? <span className="text-amber-700">Encara sense data</span>
        : <span className={lectiu ? 'text-gray-400' : 'text-amber-700'}>
            {dataLlarga(valor)}{!lectiu && ' · no és dia lectiu'}
          </span>}
    </label>
  )
}

export function CircularAccions({
  excursio: e, datesProposades, diesNoLectius, ocupat, onGenerar, onEnviar,
}: Props) {
  // Si ja s'ha enviat, manen les dates desades: la proposta d'ara es
  // calcularia igual, però el que val és el que les famílies tenen a casa.
  const [dates, setDates] = useState<DatesCircular>(() => ({
    circular: e.DataCircular ?? datesProposades.circular,
    pagament: e.DataLimitPagament ?? datesProposades.pagament,
    resguard: e.DataLimitResguard ?? datesProposades.resguard,
  }))
  const [nota, setNota] = useState('')

  const enviada = e.Estat === 'Circular enviada'
  // El mateix criteri que `enviar_circular` al servidor: sense preu congelat
  // la circular sortiria sense import, i és precisament l'import el que les
  // famílies han de llegir.
  const preuConfirmat = e.PreuAlumne !== null
  const estatPermet = e.Estat === 'Aprovada' || e.Estat === 'Reservada'
  const faltaAlgunaData = !dates.circular || !dates.pagament || !dates.resguard

  const posa = (camp: keyof DatesCircular) => (v: string) => setDates((d) => ({ ...d, [camp]: v }))

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-text-main">Circular a les famílies</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Camp etiqueta="Data de la circular" valor={dates.circular}
          diesNoLectius={diesNoLectius} bloquejat={enviada || ocupat} onCanvia={posa('circular')} />
        <Camp etiqueta="Límit de pagament" valor={dates.pagament}
          diesNoLectius={diesNoLectius} bloquejat={enviada || ocupat} onCanvia={posa('pagament')} />
        <Camp etiqueta="Resguard al tutor" valor={dates.resguard}
          diesNoLectius={diesNoLectius} bloquejat={enviada || ocupat} onCanvia={posa('resguard')} />
      </div>

      {/* La nota no es desa enlloc: és d'aquesta còpia del document. Desar-la
          voldria dir una columna nova i una migració, i el que s'ha demanat és
          poder afegir-hi una frase abans de generar-la. */}
      <label className="flex flex-col gap-0.5 text-xs text-gray-500">
        Nota per a aquesta excursió (opcional)
        <textarea
          value={nota} rows={2} disabled={ocupat} aria-label="Nota per a aquesta excursió"
          onChange={(ev) => setNota(ev.target.value)}
          placeholder="Cal dur esmorzar i roba còmoda."
          className="px-2 py-1 text-sm border border-gray-200 rounded-lg disabled:bg-gray-50"
        />
        {/* El motiu pel qual no es desa és a dalt d'aquest fitxer, però qui
            torni a generar la circular d'aquí a un mes no llegirà cap comentari:
            veurà el camp buit i no sabrà que la que van rebre les famílies duia
            una frase. Per això ho diu la pantalla. */}
        <span className="text-gray-400">
          La nota no es desa: si es torna a generar la circular, s’ha de tornar a escriure.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {/* Generar-la no canvia res: es pot fer tantes vegades com calgui,
            també un cop enviada, perquè Secretaria en pot necessitar una altra
            còpia. És l'única manera de revisar-la abans d'enviar-la. */}
        <button
          onClick={() => void onGenerar(dates, nota)} disabled={ocupat}
          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-50"
        >
          <FileDown size={13} /> Genera la circular
        </button>

        {!enviada && preuConfirmat && estatPermet && (
          <button
            onClick={() => void onEnviar(dates)} disabled={ocupat || faltaAlgunaData}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg disabled:opacity-50"
          >
            <Send size={13} /> Marca-la com a enviada
          </button>
        )}
      </div>

      {/* Per què no hi ha el botó d'enviar-la. Amagar-lo sense dir res deixava
          qui la gestiona buscant un botó que no existeix. */}
      {!enviada && !preuConfirmat && (
        <p className="text-xs text-amber-700">
          Encara no es pot marcar com a enviada: primer cal confirmar el preu, perquè
          la circular porta l’import que pagaran les famílies.
        </p>
      )}
      {!enviada && preuConfirmat && !estatPermet && (
        <p className="text-xs text-amber-700">
          Només es marca com a enviada la circular d’una excursió aprovada o reservada;
          aquesta és «{e.Estat}».
        </p>
      )}
      {!enviada && preuConfirmat && estatPermet && faltaAlgunaData && (
        <p className="text-xs text-amber-700">
          Falta alguna de les tres dates. Es desen totes tres amb la circular, així que
          no se’n pot enviar cap sense.
        </p>
      )}

      {/* Qui la va enviar i amb quina data. La data que s'ensenya és la de la
          circular —la que les famílies llegeixen al document—, no l'instant en
          què es va prémer el botó: aquell segell es queda al servidor. */}
      {enviada && (
        <p className="text-xs text-gray-400">
          Circular enviada{e.CircularEnviadaPer && ` per ${e.CircularEnviadaPer}`}
          {e.DataCircular && `, amb data de ${dataLlarga(e.DataCircular).toLowerCase()}`}. Es pot
          tornar a generar el document, però no a enviar.
        </p>
      )}
    </section>
  )
}
