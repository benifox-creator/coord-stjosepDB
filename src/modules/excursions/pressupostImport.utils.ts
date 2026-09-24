// El full que torna l'empresa amb els preus. Interpretar-lo està separat de
// llegir el fitxer a propòsit: aquí és on es decideix què entra a la base de
// dades, i això s'ha de poder provar amb una matriu escrita a mà.
//
// Una sortida pot ocupar **diverses files**, una per autocar, repetint el
// codi. El resultat, en canvi, és un element per codi: la previsualització
// ensenya «EXC-0004: 2 autocars», no dues línies soltes.
import type { Excursio } from './types'

export interface PreusImportats {
  /** Un per vehicle, amb el preu **net**. */
  autocars: { places: number; preu: number }[]
  /** Net. Absent si l'empresa no n'ha posat. */
  preuActivitat?: number
  preuActivitatTipus?: 'per_alumne' | 'total'
}

export interface FilaPressupost {
  /** La primera fila del full on surt aquest codi, per poder-la buscar. */
  fila: number
  codi: string
  /** Per ensenyar-ho a la previsualització sense haver de tornar a buscar. */
  lloc: string
  excursioId?: string
  valid: boolean
  error?: string
  /** Els autocars que aquesta sortida perdrà. */
  substitueix?: { quants: number; total: number }
  data?: PreusImportats
}

function text(v: unknown): string {
  return String(v ?? '').trim()
}

// Compara capçaleres escrites a mà en un full de càlcul: iguala els apòstrofs
// (Excel converteix ' en ’ tot sol) i ignora els accents, perquè qui ompli el
// full no hagi d'encertar «Destinació» amb accent. Mateix criteri que
// `src/modules/usuaris/excelImport.utils.ts`, copiat i no importat perquè
// aquest mòdul no ha de dependre del d'usuaris.
function clau(s: string): string {
  return s.trim().toLowerCase().replace(/[’‘`´]/g, '\'').normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/** `null` quan la cel·la és buida; `NaN` quan hi ha alguna cosa que no és un número. */
function numero(v: unknown): number | null {
  const s = text(v)
  if (s === '') return null
  // Les comes decimals hi arriben quan algú escriu el número com a text.
  return Number(s.replace(/\s/g, '').replace(',', '.'))
}

// Les quatre columnes de preu que el full sap llegir, en l'ordre canònic en
// què `capcaleresPressupost` (pressupostExport.utils.ts) les escriu. S'exporta
// perquè la finestra d'importar pugui ensenyar les quatre —no només les que
// hi són— i que una parella sencera absent salti a la vista.
export const COLUMNES_DE_PREU = ['Places', 'Preu autocar', 'Preu per alumne', 'Preu total del grup'] as const

// Cap preu d'una línia no arriba a aquesta xifra: un autocar de dia val entre
// tres-cents i mil i escaig euros, i una activitat per a un grup sencer no
// arriba a aquest ordre de magnitud. En canvi els números de sèrie de les
// dates d'Excel d'aquests cursos ronden els 46.000 —una cel·la de preu
// formatada com a data, o algú que hi afegeix un zero de més sense voler,
// queden atrapats aquí en comptes de colar-se com un import real.
const PREU_MAXIM_LINIA = 10_000

/**
 * Els noms de les columnes de preu (de les quatre que reconeix el full) que
 * hi són presents, en l'ordre canònic. Serveix perquè la finestra d'importar
 * pugui ensenyar quines ha sabut llegir: si algú ha reanomenat «Preu
 * autocar» a «Preu bus», aquí no hi surt «Preu autocar», i qui miri la
 * previsualització ho pot veure abans que cap fila desaparegui en silenci.
 */
export function columnesDePreuReconegudes(matriu: unknown[][]): string[] {
  const capcaleres = (matriu[0] ?? []).map((c) => clau(text(c)))
  return COLUMNES_DE_PREU.filter((nom) => capcaleres.includes(clau(nom)))
}

function net(brut: number, portaIva: boolean, ivaPct: number): number {
  const valor = portaIva ? brut / (1 + ivaPct / 100) : brut
  // Al cèntim: les columnes són `numeric(10,2)` i els decimals de més es
  // perdrien en silenci en desar.
  return Math.round(valor * 100) / 100
}

interface FilaCrua {
  fila: number
  places: number | null
  preuAutocar: number | null
  perAlumne: number | null
  total: number | null
}

export function interpretaPressupost(
  matriu: unknown[][],
  excursions: Excursio[],
  ambAutocars: ReadonlyMap<string, { quants: number; total: number }>,
  portaIva: boolean,
  ivaPct: number,
): FilaPressupost[] {
  if (matriu.length === 0) return []

  const capcaleres = (matriu[0] ?? []).map((c) => clau(text(c)))
  const columna = (nom: string) => capcaleres.indexOf(clau(nom))
  const idx = {
    codi: columna('Codi'),
    places: columna('Places'),
    preuAutocar: columna('Preu autocar'),
    perAlumne: columna('Preu per alumne'),
    total: columna('Preu total del grup'),
  }
  if (idx.codi === -1) {
    throw new Error('El full no té la columna «Codi». Fes servir el fitxer que va sortir de l’aplicació.')
  }

  // El fitxer que torna és el mateix que vam enviar, i aquell sempre porta
  // parelles senceres: «Places» + «Preu autocar» per al transport, «Preu per
  // alumne» + «Preu total del grup» per a l'activitat (o totes quatre). No hi
  // ha cap full legítim amb mitja parella: si en falta una de les dues, el
  // full està trencat (algú n'ha reanomenat una capçalera), i cal dir quina
  // falta abans que la fila es llegeixi com «sense preu» i desaparegui en
  // silenci.
  const parellaTrencada = (a: number, b: number, nomA: string, nomB: string): void => {
    if ((a === -1) === (b === -1)) return
    const falta = a === -1 ? nomA : nomB
    throw new Error(`El full no té la columna «${falta}». Fes servir el fitxer que va sortir de l’aplicació.`)
  }
  parellaTrencada(idx.places, idx.preuAutocar, 'Places', 'Preu autocar')
  parellaTrencada(idx.perAlumne, idx.total, 'Preu per alumne', 'Preu total del grup')

  // Un cop es descarten les mitges parelles, el que queda és: les dues
  // parelles completes, només una completa (autocar o activitat: totes dues
  // són un full vàlid), o cap. Que no es reconegui cap parella no és «cap
  // fila té preu» (legítim: l'empresa encara no ha pressupostat res), és que
  // l'aplicació no sap llegir aquest full —per exemple algú l'ha reanomenat
  // sencer. Sense aquest tall, totes les files es llegirien com «sense preu»
  // i la sortida desapareixeria del resultat sense cap avís.
  const autocarComplet = idx.places !== -1 && idx.preuAutocar !== -1
  const activitatCompleta = idx.perAlumne !== -1 && idx.total !== -1
  if (!autocarComplet && !activitatCompleta) {
    throw new Error(
      'El full no té cap columna de preu (Places, Preu autocar, Preu per alumne, Preu total del grup). ' +
      'Fes servir el fitxer que va sortir de l’aplicació.',
    )
  }

  // Les files es recullen agrupades pel codi abans de jutjar res: una sortida
  // amb dos autocars s'ha de decidir sencera, no línia a línia.
  const perCodi = new Map<string, FilaCrua[]>()
  const ordre: string[] = []
  for (let i = 1; i < matriu.length; i++) {
    const row = matriu[i] ?? []
    const get = (c: number) => (c === -1 ? null : numero(row[c]))
    const codi = text(row[idx.codi])
    if (!codi) continue
    const crua: FilaCrua = {
      fila: i + 1,
      places: get(idx.places),
      preuAutocar: get(idx.preuAutocar),
      perAlumne: get(idx.perAlumne),
      total: get(idx.total),
    }
    // Una fila sense cap preu se salta: l'empresa no ha pressupostat aquella
    // sortida, que és una resposta legítima i no un error. `0` no és «sense
    // preu» (és `null`): un servei gratuït és una resposta legítima també, i
    // s'ha de desar tal qual, no confondre's amb «no contestat».
    if (crua.preuAutocar === null && crua.perAlumne === null && crua.total === null) continue
    const llista = perCodi.get(codi)
    if (llista) llista.push(crua)
    else { perCodi.set(codi, [crua]); ordre.push(codi) }
  }

  const perCodiExcursio = new Map(excursions.map((e) => [e.Codi, e]))
  const resultats: FilaPressupost[] = []

  for (const codi of ordre) {
    const crues = perCodi.get(codi) ?? []
    const e = perCodiExcursio.get(codi)
    const base = { fila: crues[0].fila, codi, lloc: e?.Lloc ?? '' }

    if (!e) {
      resultats.push({ ...base, valid: false, error: 'Aquest codi no existeix al curs.' })
      continue
    }
    if (e.Estat === 'Cancel·lada') {
      resultats.push({ ...base, valid: false, error: 'Aquesta sortida està cancel·lada.' })
      continue
    }

    const dolent = crues.find((c) =>
      [c.places, c.preuAutocar, c.perAlumne, c.total].some((n) => n !== null && !Number.isFinite(n)))
    if (dolent) {
      resultats.push({ ...base, fila: dolent.fila, valid: false, error: 'Hi ha un valor que no és un número.' })
      continue
    }
    const negatiu = crues.find((c) =>
      [c.places, c.preuAutocar, c.perAlumne, c.total].some((n) => n !== null && n < 0))
    if (negatiu) {
      resultats.push({ ...base, fila: negatiu.fila, valid: false, error: 'Hi ha un valor negatiu.' })
      continue
    }
    const excessiu = crues.find((c) =>
      [c.places, c.preuAutocar, c.perAlumne, c.total].some((n) => n !== null && n > PREU_MAXIM_LINIA))
    if (excessiu) {
      resultats.push({
        ...base, fila: excessiu.fila, valid: false,
        error: `Un valor és més gran de ${PREU_MAXIM_LINIA} €: sembla una data d’Excel o un error de teclat.`,
      })
      continue
    }
    const sensePlaces = crues.find((c) => c.preuAutocar !== null && (c.places === null || c.places <= 0))
    if (sensePlaces) {
      resultats.push({ ...base, fila: sensePlaces.fila, valid: false, error: 'Un autocar amb preu i sense places.' })
      continue
    }
    const dues = crues.find((c) => c.perAlumne !== null && c.total !== null)
    if (dues) {
      resultats.push({
        ...base, fila: dues.fila, valid: false,
        error: 'Les dues columnes d’activitat estan plenes: no se sap quina val.',
      })
      continue
    }

    const ambActivitat = crues.filter((c) => c.perAlumne !== null || c.total !== null)
    const valors = new Set(ambActivitat.map((c) => `${c.perAlumne ?? ''}|${c.total ?? ''}`))
    if (valors.size > 1) {
      resultats.push({ ...base, valid: false, error: 'Dos preus d’activitat diferents per a la mateixa sortida.' })
      continue
    }

    const dades: PreusImportats = {
      autocars: crues
        .filter((c) => c.preuAutocar !== null)
        .map((c) => ({ places: c.places as number, preu: net(c.preuAutocar as number, portaIva, ivaPct) })),
    }
    const activitat = ambActivitat[0]
    if (activitat) {
      const perAlumne = activitat.perAlumne !== null
      dades.preuActivitat = net((perAlumne ? activitat.perAlumne : activitat.total) as number, portaIva, ivaPct)
      dades.preuActivitatTipus = perAlumne ? 'per_alumne' : 'total'
    }

    const tenia = dades.autocars.length > 0 ? ambAutocars.get(e.id) : undefined
    resultats.push({ ...base, excursioId: e.id, valid: true, data: dades, ...(tenia ? { substitueix: tenia } : {}) })
  }

  return resultats
}

/**
 * Llegeix el fitxer **una sola vegada** i, d'aquella mateixa matriu, en treu
 * les dues coses que la finestra d'importar necessita: les columnes de preu
 * reconegudes (per ensenyar-les, i dir quina falta) i les files interpretades.
 * Tota l'E/S del pressupost viu aquí perquè el component no n'hagi de fer.
 */
export async function parsejaExcelPressupost(
  file: File,
  excursions: Excursio[],
  ambAutocars: ReadonlyMap<string, { quants: number; total: number }>,
  portaIva: boolean,
  ivaPct: number,
): Promise<{ columnes: string[]; files: FilaPressupost[] }> {
  const XLSX = await import('xlsx')
  // `cellDates: true`: si Excel ha format una cel·la de preu com a data (li
  // passa sol amb certs patrons, o algú escriu «5/12» pensant en una
  // fracció), això la torna com a `Date` i cau a la comprovació de «no és un
  // número» en comptes de colar-se com el número de sèrie cru —un import de
  // desenes de milers d'euros.
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const matriu = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, blankrows: false })
  return {
    columnes: columnesDePreuReconegudes(matriu),
    files: interpretaPressupost(matriu, excursions, ambAutocars, portaIva, ivaPct),
  }
}
