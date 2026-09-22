import { useEffect, useState } from 'react'
import { X, Loader2, Pencil } from 'lucide-react'
import type { Excursio, EstatExcursio, ExcursioGrup } from './types'
import { ESTAT_COLORS, TRANSPORT_LABELS } from './types'
import type { Finances } from './finances.types'
import type { ParametresPreu } from './preu'
import type { DatesCircular } from './datesCircular'
import type { TextosCircular } from './circular/textos'
import { dadesCircular } from './circular/dades'
import { useFinances } from './useFinances'
import { useExcursions } from './useExcursions'
import { pagamentsAApuntar, recaptat, totalPagats } from './pagaments'
import { BlocEconomic } from './BlocEconomic'
import { CircularAccions } from './CircularAccions'

interface Props {
  excursio: Excursio
  potAprovar: boolean
  potGestionar: boolean
  potEditar: boolean
  // Ve calculat de fora, amb el mateix criteri que potAprovar/potGestionar:
  // el rol i les caselles de l'usuari ja s'han mirat allà on hi ha accés als
  // stores, i aquí només arriba la decisió, no les dades de qui l'ha presa.
  potVeureCostos: boolean
  parametres: ParametresPreu
  onCanviarEstat: (estat: EstatExcursio, motiu?: string) => Promise<void>
  // Fa la crida RPC i recarrega la llista (mateixa ruta que onCanviarEstat),
  // però sense tancar la fitxa: qui confirma un preu vol veure'l sense haver
  // de tornar a obrir la targeta. Es passa `finances` perquè qui gestiona
  // l'store (el Wrapper) no té la còpia local encara no desada del formulari:
  // sense passar-la, es podria confirmar un preu calculat amb dades que
  // encara no han arribat al servidor.
  onConfirmaPreu: (preu: number, finances: Finances) => Promise<void>
  // Tot el que fa falta per a la circular ve del Wrapper, que és qui té la
  // configuració: la proposta de dates, els textos fixos i el calendari. Aquí
  // no es llegeix res de la configuració, igual que amb `parametres`.
  datesCircular: DatesCircular
  textosCircular: TextosCircular
  diesNoLectius: string[]
  onEnviarCircular: (dates: DatesCircular) => Promise<void>
  onEditar: () => void
  onClose: () => void
}

function Dada({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{etiqueta}</p>
      <p className="text-sm text-text-main">{valor || '—'}</p>
    </div>
  )
}

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })

/**
 * El recompte de pagaments d'un grup. S'escriu en una còpia local i només es
 * desa en sortir del camp o en prémer Enter: cada desat és una crida al
 * servidor més una recàrrega de tota la llista, i fer-ho a cada tecla en
 * dispararia una per dígit.
 *
 * Qui el munta li posa una `key` que inclou la xifra desada, perquè quan torni
 * del servidor (o la canviï algú altre) el camp es torni a muntar amb el valor
 * bo. Copiar-lo amb un efecte xocaria amb l'edició encara no desada, el mateix
 * motiu pel qual els costos tampoc no es copien així.
 */
function CampPagats({ grup, desant, onDesa }: {
  grup: ExcursioGrup
  // Només mentre es desa AQUEST grup, no mentre la fitxa està ocupada: si es
  // bloquegessin tots els camps alhora, tabular del grup A al B just després
  // de desar A deixaria el B bloquejat abans no rebés el focus —tota la crida
  // i la recàrrega del curs sencer—, i qui apunta els pagaments de tres grups
  // seguits escriuria al no-res. De retruc, tampoc no es bloqueja un camp amb
  // el focus a dins, cosa que en dispararia el `blur` i desaria una edició a
  // mig fer.
  desant: boolean
  onDesa: (pagats: number) => void
}) {
  const [text, setText] = useState(String(grup.AlumnesPagats))

  function desa() {
    const valor = pagamentsAApuntar(text, grup.AlumnesPagats)
    // `null` vol dir que no hi ha res a enviar: o el que s'ha escrit no és un
    // recompte que es pugui desar, o ja és el que hi ha. Es torna al valor
    // desat perquè el camp no es quedi ensenyant una cosa que no s'ha apuntat.
    if (valor === null) {
      setText(String(grup.AlumnesPagats))
      return
    }
    onDesa(valor)
  }

  return (
    <input
      type="number"
      min={0}
      step={1}
      value={text}
      disabled={desant}
      aria-label={`Pagaments rebuts del grup ${grup.Grup}`}
      onChange={(ev) => setText(ev.target.value)}
      onBlur={desa}
      // Enter no desa ell mateix: treu el focus i deixa que ho faci `onBlur`,
      // perquè les dues maneres d'acabar passin exactament pel mateix camí.
      onKeyDown={(ev) => { if (ev.key === 'Enter') ev.currentTarget.blur() }}
      className="w-16 px-2 py-0.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50"
    />
  )
}

export function ExcursioDetall({
  excursio: e, potAprovar, potGestionar, potEditar, potVeureCostos, parametres,
  datesCircular, textosCircular, diesNoLectius,
  onCanviarEstat, onConfirmaPreu, onEnviarCircular, onEditar, onClose,
}: Props) {
  const [ocupat, setOcupat] = useState(false)
  const [error, setError] = useState('')

  // L'edició es fa sobre una còpia local perquè "Desa els costos" pugui ser
  // una acció explícita i no cada tecla premuda. Es llegeix del store amb
  // getState() després de cada `carrega`/`desa` —no amb un selector que
  // n'observi el camp— perquè copiar-ho en un efecte cada cop que el store
  // canvia xocaria amb l'edició que l'usuari encara no ha desat.
  const carregaFinances = useFinances((s) => s.carrega)
  const desaFinances = useFinances((s) => s.desa)
  // Es llegeix amb un selector (i no amb getState(), com `finances`) perquè
  // aquí sí que interessa que la fitxa es torni a pintar quan canviï: és
  // l'únic lloc que l'ensenya, i abans d'aquest camp res ho feia.
  const financesError = useFinances((s) => s.error)
  const [finances, setFinances] = useState<Finances | null>(null)

  const registraPagaments = useExcursions((s) => s.registraPagaments)
  const [grupDesant, setGrupDesant] = useState<string | null>(null)
  // La fila es llegeix de l'store i no de la prop `excursio`: qui obre la fitxa
  // n'ha guardat una còpia del moment d'obrir-la, i `registraPagaments`
  // recarrega la llista però no aquella còpia. Sense això, després d'apuntar un
  // pagament el camp i el total seguirien ensenyant la xifra vella fins a
  // tancar i tornar a obrir la targeta. Es cau a la prop mentre la recàrrega no
  // ha tornat, o si algú munta la fitxa sense passar per l'store.
  const fila = useExcursions((s) => s.excursions.find((x) => x.id === e.id))
  const grups = fila?.Grups ?? e.Grups
  // El preu surt de la MATEIXA fila que els grups, no de la prop: barrejar
  // pagaments acabats de recarregar amb un preu del moment d'obrir la fitxa
  // donaria un recaptat fals si algú confirma (o reconfirma) el preu mentre la
  // targeta és oberta —i, en el cas suau, diria «falta confirmar el preu» quan
  // ja s'ha confirmat. En una pantalla que parla de diners, les dues xifres han
  // de venir del mateix moment.
  const preu = fila ? fila.PreuAlumne : e.PreuAlumne

  useEffect(() => {
    // Sense accés als diners, `carrega` tornaria zero files igualment (l'RLS
    // ho talla al servidor), però demanar-ho és una crida de xarxa de franc.
    if (!potVeureCostos) return
    let activa = true
    void carregaFinances(e.id).then(() => {
      if (!activa) return
      const carregades = useFinances.getState()
      // Si la càrrega ha fallat, `carregades.finances` ja és `null` (el
      // `catch` de `carrega` l'esborra), però es comprova l'error i no només
      // `finances`: copiar un `null` real seria igual de correcte, però fiar-
      // se'n aquí duplicaria la mateixa suposició en dos llocs.
      if (!carregades.error) setFinances(carregades.finances)
    })
    return () => { activa = false }
  }, [potVeureCostos, e.id, carregaFinances])

  async function desaICarregaFinances() {
    if (!finances) return
    await desaFinances(e.id, finances)
    setFinances(useFinances.getState().finances)
  }

  async function canvia(estat: EstatExcursio, motiu?: string) {
    setOcupat(true)
    setError('')
    try {
      await onCanviarEstat(estat, motiu)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No s’ha pogut fer el canvi.')
      setOcupat(false)
    }
  }

  // Mateix patró que `canvia`: sense això, un desament o una confirmació que
  // falla (RLS, xarxa) no es distingia en pantalla d'un que ha anat bé —
  // ni tan sols quedava constància que encara s'estava fent la crida.
  async function desarCostos() {
    setOcupat(true)
    setError('')
    try {
      await desaICarregaFinances()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No s’han pogut desar els costos.')
    } finally {
      setOcupat(false)
    }
  }

  async function confirmarPreu(preu: number) {
    // `finances` no pot ser null aquí: aquesta funció només s'invoca des del
    // botó de `BlocEconomic`, que només es pinta quan `finances` ja existeix
    // (vegeu més avall, `potVeureCostos && finances &&`).
    if (!finances) return
    setOcupat(true)
    setError('')
    try {
      await onConfirmaPreu(preu, finances)
      // Igual que `desaICarregaFinances`: `confirma` també desa per sota, i
      // els autocars nous hi reben l'id real del servidor.
      setFinances(useFinances.getState().finances)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No s’ha pogut confirmar el preu.')
    } finally {
      setOcupat(false)
    }
  }

  // Mateix patró que `desarCostos`: `registraPagaments` no atrapa els seus
  // errors (l'RLS o la xarxa hi poden dir que no), i aquí és on es converteixen
  // en una franja vermella en comptes d'una promesa trencada en silenci.
  async function apuntaPagaments(grupId: string, pagats: number) {
    setOcupat(true)
    setGrupDesant(grupId)
    setError('')
    try {
      await registraPagaments(grupId, pagats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No s’han pogut apuntar els pagaments.')
    } finally {
      setOcupat(false)
      setGrupDesant(null)
    }
  }

  async function generarCircular(dates: DatesCircular, nota: string) {
    setOcupat(true)
    setError('')
    try {
      // `docx` amb `import()` i no a dalt del fitxer: la llibreria pesa més que
      // tot el mòdul d'excursions junt, i qui només mira el pla del curs no
      // l'ha de descarregar mai. Només entra al navegador de qui genera una
      // circular, i el mateix `import()` no la torna a demanar la segona
      // vegada.
      const { circularBlob } = await import('./circular/document')
      const blob = await circularBlob(dadesCircular(e, dates, textosCircular, nota))
      const url = URL.createObjectURL(blob)
      const enllac = document.createElement('a')
      enllac.href = url
      // El codi al nom del fitxer: a Secretaria n'hi conviuen moltes a la
      // mateixa carpeta, i "circular.docx" no es distingeix de la d'ahir.
      enllac.download = `Circular ${e.Codi}.docx`
      enllac.click()
      // La memòria del blob no es torna sola fins que es tanca la pestanya,
      // però revocar-la tot seguit del `click()` pot arribar abans que el
      // navegador n'hagi començat la descàrrega: se li deixa passar un torn.
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No s’ha pogut generar la circular.')
    } finally {
      setOcupat(false)
    }
  }

  // Mateix patró que `confirmarPreu`: la fitxa no es tanca en acabar perquè qui
  // l'envia vegi l'estat nou i les dates desades a la mateixa targeta.
  async function enviarCircular(dates: DatesCircular) {
    setOcupat(true)
    setError('')
    try {
      await onEnviarCircular(dates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No s’ha pogut marcar la circular com a enviada.')
    } finally {
      setOcupat(false)
    }
  }

  function demanaMotiu(pregunta: string, estat: EstatExcursio) {
    const motiu = window.prompt(pregunta)
    if (motiu?.trim()) void canvia(estat, motiu.trim())
  }

  const alumnes = grups.reduce((s, g) => s + g.AlumnesPrevistos, 0)
  const pagats = totalPagats(grups)
  const diners = recaptat(grups, preu)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-text-main">{e.Codi}</h2>
            <span className={`px-2 py-0.5 text-xs rounded-full ${ESTAT_COLORS[e.Estat]}`}>{e.Estat}</span>
          </div>
          <div className="flex items-center gap-2">
            {potEditar && (
              <button onClick={onEditar} className="flex items-center gap-1 text-xs font-medium text-primary">
                <Pencil size={13} /> Edita
              </button>
            )}
            <button onClick={onClose} disabled={ocupat} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Dada etiqueta="Activitat" valor={e.Activitat} />
            <Dada etiqueta="Data" valor={e.Data ?? ''} />
            <Dada etiqueta="Lloc" valor={[e.Lloc, e.Poblacio].filter(Boolean).join(' · ')} />
            <Dada etiqueta="Etapa" valor={e.Etapa} />
            <Dada etiqueta="Horari" valor={e.HoraSortida && e.HoraTornada ? `${e.HoraSortida} – ${e.HoraTornada}` : ''} />
            <Dada
              etiqueta="Transport"
              valor={e.Transport === 'altres' ? `${TRANSPORT_LABELS.altres.split(' (')[0]}: ${e.TransportDetall}` : TRANSPORT_LABELS[e.Transport]}
            />
            <Dada etiqueta="Responsable" valor={e.Responsable} />
            <Dada etiqueta="Alumnes previstos" valor={String(alumnes)} />
            {/* El preu confirmat surt a la circular que reben les famílies:
                amagar-lo no té sentit encara que qui mira no vegi el desglossament. */}
            {preu !== null && <Dada etiqueta="Preu per alumne" valor={eur(preu)} />}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Grups</p>
            {grups.length === 0
              ? <p className="text-sm text-gray-400 italic">Cap grup encara.</p>
              : (
                <>
                  <ul className="text-sm text-text-main space-y-1">
                    {grups.map((g) => (
                      <li key={g.id} className="flex flex-wrap items-center gap-2">
                        <span>{g.Grup} — {g.AlumnesPrevistos} alumnes</span>
                        <label className="flex items-center gap-1 text-xs text-gray-500">
                          {/* "Han pagat" i no "pagats" a seques: el número del
                              costat són alumnes previstos, i les dues xifres
                              es confondrien sense dir què compta cadascuna. */}
                          Han pagat
                          <CampPagats
                            key={`${g.id}:${g.AlumnesPagats}`}
                            grup={g}
                            desant={ocupat && grupDesant === g.id}
                            onDesa={(n) => void apuntaPagaments(g.id, n)}
                          />
                        </label>
                        {/* En gris i no en vermell: que hi hagi més pagaments
                            que previsions és una dada bona (s'hi ha afegit algú
                            que no es comptava), no pas un error a esmenar. */}
                        {g.AlumnesPagats > g.AlumnesPrevistos && (
                          <span className="text-xs text-gray-400">més pagaments que previsions</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-gray-500">
                    Han pagat {pagats} de {alumnes} alumnes previstos
                    {/* Zero i «encara no se sap» no són el mateix: sense preu
                        confirmat, un 0 € es llegiria com que no ha entrat res. */}
                    {diners === null
                      ? ' · falta confirmar el preu per saber què s’ha recaptat'
                      : ` · recaptat ${eur(diners)}`}
                  </p>
                </>
              )}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Acompanyants</p>
            <p className="text-sm text-text-main">
              {e.Acompanyants.length ? e.Acompanyants.join(', ') : 'Encara sense assignar'}
              {e.AcompanyantsExterns > 0 && ` · ${e.AcompanyantsExterns} externs`}
            </p>
          </div>

          {potVeureCostos && finances && (
            <BlocEconomic
              finances={finances}
              parametres={parametres}
              alumnes={alumnes}
              acompanyants={e.Acompanyants.length + e.AcompanyantsExterns}
              preuConfirmat={e.PreuAlumne}
              confirmatPer={e.PreuConfirmatPer}
              potConfirmar={e.Estat === 'Aprovada' || e.Estat === 'Reservada'}
              ocupat={ocupat}
              onCanvia={setFinances}
              onDesa={desarCostos}
              onConfirma={confirmarPreu}
            />
          )}

          {/* Per a qui gestiona, i també amb l'excursió cancel·lada: el bloc
              explica ell mateix per què no es pot enviar, i qui la va enviar
              si ja ho estava. */}
          {potGestionar && (
            <CircularAccions
              // Les dates i la nota són estat intern del bloc: amb la `key`,
              // passar d'una excursió a una altra sense tancar la fitxa el
              // torna a muntar i no n'arrossega les dates.
              key={e.id}
              excursio={e}
              datesProposades={datesCircular}
              diesNoLectius={diesNoLectius}
              ocupat={ocupat}
              onGenerar={generarCircular}
              onEnviar={enviarCircular}
            />
          )}

          {e.Observacions && <Dada etiqueta="Observacions" valor={e.Observacions} />}

          <div className="border-t border-gray-100 pt-4 space-y-1 text-xs text-gray-500">
            <p>Proposada per {e.ProposadaPer ?? e.Creat_per}</p>
            {e.AprovadaPer && <p>Aprovada per {e.AprovadaPer}</p>}
            {e.ReservadaPer && <p>Reservada per {e.ReservadaPer}</p>}
            {e.MotiuRebuig && <p className="text-amber-700">Rebutjada: {e.MotiuRebuig}</p>}
            {e.MotiuCancellacio && <p className="text-red-600">Cancel·lada: {e.MotiuCancellacio}</p>}
          </div>

          {e.Estat === 'Cancel·lada' && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Si ja s’havia enviat la circular, la devolució dels diners s’ha de gestionar fora de l’aplicació:
              l’aplicació encara no ho fa.
            </p>
          )}

          {/* `financesError` és el de `useFinances` (una càrrega de costos que
              ha fallat en obert); `error` és el d'una acció d'aquesta fitxa
              (canviar d'estat, desar, confirmar). Cap dels dos té prioritat
              fixa: es mostren tots dos si passa que coincideixen. */}
          {financesError && potVeureCostos && (
            <p className="text-xs text-red-600">No s’han pogut carregar els costos: {financesError}</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 px-6 py-4 border-t border-gray-200">
          {ocupat && <Loader2 size={16} className="animate-spin text-gray-400 self-center mr-auto" />}
          {e.Estat === 'Proposada' && potAprovar && (
            <>
              <button
                onClick={() => demanaMotiu('Per què es rebutja?', 'Esborrany')}
                disabled={ocupat}
                className="px-4 py-2 text-sm font-medium text-amber-800 bg-amber-100 rounded-lg disabled:opacity-50"
              >
                Rebutja
              </button>
              <button
                onClick={() => void canvia('Aprovada')}
                disabled={ocupat}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#15803d' }}
              >
                Aprova
              </button>
            </>
          )}
          {e.Estat === 'Aprovada' && potGestionar && (
            <button
              onClick={() => void canvia('Reservada')}
              disabled={ocupat}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
              style={{ backgroundColor: '#861414' }}
            >
              Marca com a reservada
            </button>
          )}
          {e.Estat !== 'Cancel·lada' && potGestionar && (
            <button
              onClick={() => demanaMotiu('Per què es cancel·la?', 'Cancel·lada')}
              disabled={ocupat}
              className="px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
            >
              Cancel·la
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
