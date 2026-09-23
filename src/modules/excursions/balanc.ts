// src/modules/excursions/balanc.ts
//
// Què ha costat una sortida i què n'ha entrat. Aïllat de tota la resta pel
// mateix motiu que `preu.ts`: és on un error costa diners de debò, i així es
// pot provar amb sortides reals sense muntar ni base de dades ni React.
//
// El càlcul ha de dir el mateix que `calculaPreu` mirat des de l'altre
// costat. Si divergeixen, una de les dues peces menteix — hi ha una prova que
// ho comprova (`balanc.test.ts`, «el coixí d’una sortida plena és el marge»).

/** Per què una sortida feta no pot entrar al coixí del curs. */
export type MotiuFora = 'sense-pagaments' | 'sense-preu'

export interface DadesSortida {
  id: string
  lloc: string
  etapa: string
  /** ISO `YYYY-MM-DD`, o `null` si encara no té dia. */
  data: string | null
  estat: string
  /** Σ `alumnes_pagats` dels grups. Els qui han pagat són els qui hi van. */
  assistents: number
  /** Σ `alumnes_previstos` dels grups. */
  previstos: number
  /** El preu congelat en confirmar-lo. `null` mentre no s'ha confirmat. */
  preuAlumne: number | null
  /** El preu de cada autocar, **sense** IVA. */
  autocars: number[]
  preuActivitat: number
  preuActivitatTipus: 'per_alumne' | 'total'
  /** Aportació de l'AMPA **per alumne**. */
  ampaImport: number
  ampaCobreixActivitat: boolean
  costAcompanyants: number
  /** L'IVA congelat amb el preu (`iva_pct_usat`), no el de la configuració d'avui. */
  ivaPct: number
  /** La previsió d'assistència congelada (`previsio_usada`). */
  previsio: number
}

export interface BalancSortida {
  id: string
  lloc: string
  etapa: string
  data: string | null
  assistents: number
  previstos: number
  haCostat: number
  haEntrat: number
  coixi: number
  /** `null` si compta al coixí del curs; el motiu si no. */
  foraDelCoixi: MotiuFora | null
}

export interface Previsio {
  id: string
  lloc: string
  etapa: string
  data: string | null
  costara: number
  /** `null` mentre no hi hagi preu: no s'inventa una xifra. */
  hauriaDEntrar: number | null
  /** El que ja s'ha apuntat com a cobrat. */
  cobrat: number
}

/**
 * El cost d'una sortida amb `n` assistents. Quan l'AMPA paga l'activitat
 * sencera, l'activitat no passa pel compte del centre i val zero — exactament
 * el que fa `calculaPreu`.
 */
function costAmb(d: DadesSortida, n: number): number {
  const activitat = d.ampaCobreixActivitat ? 0 : d.preuActivitat
  const perAlumne = d.preuActivitatTipus === 'per_alumne' ? activitat * n : activitat
  const transport = d.autocars.reduce((s, preu) => s + preu, 0) * (1 + d.ivaPct / 100)
  return transport + perAlumne + d.costAcompanyants
}

/**
 * El que entra amb `n` assistents: el que paguen les famílies més el que hi
 * posa l'AMPA. Si l'AMPA cobreix l'activitat no hi posa res per alumne: ja
 * s'ha gastat allà.
 */
function ingresAmb(d: DadesSortida, n: number, preu: number): number {
  const ampa = d.ampaCobreixActivitat ? 0 : d.ampaImport
  return n * preu + n * ampa
}

export function balancSortida(d: DadesSortida): BalancSortida {
  const haCostat = costAmb(d, d.assistents)
  const haEntrat = d.preuAlumne === null ? 0 : ingresAmb(d, d.assistents, d.preuAlumne)
  // L'ordre importa: sense preu no hi ha ingrés possible, i és el motiu més
  // informatiu dels dos quan es donen tots dos alhora.
  const foraDelCoixi: MotiuFora | null =
    d.preuAlumne === null ? 'sense-preu' : d.assistents === 0 ? 'sense-pagaments' : null
  return {
    id: d.id, lloc: d.lloc, etapa: d.etapa, data: d.data,
    assistents: d.assistents, previstos: d.previstos,
    haCostat, haEntrat, coixi: haEntrat - haCostat, foraDelCoixi,
  }
}

export function previsioSortida(d: DadesSortida): Previsio {
  // **No s'arrodoneix**, com a `preu.ts`: amb 26 alumnes i una previsió de
  // 0,75 s'espera 19,5 i no 20, i arrodonir-ho aquí desquadraria la xifra
  // respecte del preu que es va calcular amb aquella mateixa fracció.
  const esperats = d.previstos * d.previsio
  return {
    id: d.id, lloc: d.lloc, etapa: d.etapa, data: d.data,
    costara: costAmb(d, esperats),
    hauriaDEntrar: d.preuAlumne === null ? null : ingresAmb(d, esperats, d.preuAlumne),
    cobrat: d.preuAlumne === null ? 0 : d.assistents * d.preuAlumne,
  }
}

export interface TotalsCurs {
  haEntrat: number
  haCostat: number
  coixi: number
  /** El que falta per cobrar de les que encara no han passat. Mai negatiu. */
  pendent: number
}

export interface ResumCurs {
  /** Les que ja han passat, de la més recent a la més antiga. */
  fetes: BalancSortida[]
  /** Les que vénen, de la més pròxima a la més llunyana; les sense data, al final. */
  perVenir: Previsio[]
  /** Les fetes que no compten al coixí, per a l'avís. */
  foraDelCoixi: BalancSortida[]
  totals: TotalsCurs
}

/**
 * Una sortida cancel·lada no ha costat res ni ha ingressat res, i un esborrany
 * és privat del seu autor i pot no enviar-se mai: cap de les dues no té un
 * cost compromès que valgui la pena ensenyar.
 */
function compta(d: DadesSortida): boolean {
  return d.estat !== 'Cancel·lada' && d.estat !== 'Esborrany'
}

/**
 * El tall és la **data**, no l'estat: una sortida del novembre que segueix en
 * estat `Aprovada` ja ha passat, i l'estat només diu que ningú no l'ha tocada
 * des de llavors. Una sortida sense data encara no pot haver passat.
 */
function jaHaPassat(d: DadesSortida, avui: string): boolean {
  return d.data !== null && d.data <= avui
}

export function resumCurs(sortides: DadesSortida[], avui: string): ResumCurs {
  const bones = sortides.filter(compta)

  const fetes = bones.filter((d) => jaHaPassat(d, avui)).map(balancSortida)
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))

  const perVenir = bones.filter((d) => !jaHaPassat(d, avui)).map(previsioSortida)
    // Les sense data van al final: `null` es compara com a cadena buida, que
    // ordenaria primer, i una sortida sense dia no és la més imminent.
    .sort((a, b) => (a.data ?? '9999-99-99').localeCompare(b.data ?? '9999-99-99'))

  const compten = fetes.filter((f) => f.foraDelCoixi === null)
  const haEntrat = compten.reduce((s, f) => s + f.haEntrat, 0)
  const haCostat = compten.reduce((s, f) => s + f.haCostat, 0)

  // Un pendent negatiu es llegiria com que sobren diners quan el que passa és
  // que n'han pagat més dels esperats. Zero és la resposta honesta.
  const pendent = perVenir.reduce(
    (s, p) => s + Math.max(0, (p.hauriaDEntrar ?? 0) - p.cobrat), 0)

  return {
    fetes, perVenir,
    foraDelCoixi: fetes.filter((f) => f.foraDelCoixi !== null),
    totals: { haEntrat, haCostat, coixi: haEntrat - haCostat, pendent },
  }
}

export type MesuraEtapa = 'total' | 'per_alumne' | 'coixi'

export interface FilaEtapa {
  etapa: string
  valor: number
}

/**
 * El repartiment per etapa de les sortides **fetes que compten**. Les tres
 * mesures diuen coses diferents a posta: el total ensenya on van els diners
 * (i la més gran sempre serà la que té més alumnes), el cost per alumne és
 * l'única xifra comparable entre etapes, i el coixí és l'única que assenyala
 * un problema.
 */
export function perEtapa(fetes: BalancSortida[], mesura: MesuraEtapa): FilaEtapa[] {
  const per = new Map<string, BalancSortida[]>()
  for (const f of fetes) {
    if (f.foraDelCoixi !== null) continue
    const llista = per.get(f.etapa)
    if (llista) llista.push(f)
    else per.set(f.etapa, [f])
  }

  const files: FilaEtapa[] = []
  for (const [etapa, sortides] of per) {
    const cost = sortides.reduce((s, f) => s + f.haCostat, 0)
    if (mesura === 'total') { files.push({ etapa, valor: cost }); continue }
    if (mesura === 'coixi') {
      files.push({ etapa, valor: sortides.reduce((s, f) => s + f.coixi, 0) })
      continue
    }
    const assistents = sortides.reduce((s, f) => s + f.assistents, 0)
    // Cap assistent vol dir cap sortida amb pagaments: l'etapa no hi surt,
    // que és millor que una barra amb «Infinity €».
    if (assistents > 0) files.push({ etapa, valor: cost / assistents })
  }
  return files.sort((a, b) => a.etapa.localeCompare(b.etapa))
}
