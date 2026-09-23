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
