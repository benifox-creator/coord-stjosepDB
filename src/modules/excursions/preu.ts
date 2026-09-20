// src/modules/excursions/preu.ts
//
// El càlcul del preu d'una excursió, aïllat de tota la resta a propòsit: és
// l'única peça del mòdul on un error costa diners de debò, i així es pot
// provar amb les excursions reals sense muntar ni base de dades ni React.
//
// Ordre (spec §6):
//   esperats     = alumnes × previsió
//   costos fixos = Σ autocars × (1 + IVA) + activitat (si és total) + acompanyants
//   cost alumne  = costos fixos ÷ esperats + activitat (si és per alumne)
//   base         = cost alumne − aportació AMPA
//   preu         = arrodonir amunt(base × (1 + marge))

export interface ParametresPreu {
  previsio: number
  margePct: number
  ivaPct: number
  arrodoniment: number
}

export interface CostosExcursio {
  alumnes: number
  autocars: number[]          // el preu de cadascun, sense IVA
  preuActivitat: number
  preuActivitatTipus: 'per_alumne' | 'total'
  ampaImport: number          // per alumne
  ampaCobreixActivitat: boolean
  costAcompanyants: number    // el que costa que hi vagin, no quants són
}

export interface ResultatPreu {
  esperats: number
  costosFixos: number
  costAlumne: number
  base: number
  preu: number
}

/**
 * Arrodoneix cap amunt al pas donat. Es treballa en cèntims perquè en coma
 * flotant 28.35 / 0.05 dona 566.9999… i el preu pujaria un graó sencer sense
 * cap motiu.
 */
export function arrodoneixAmunt(valor: number, pas: number): number {
  if (pas <= 0) return valor
  const passos = Math.ceil(Math.round((valor / pas) * 1e6) / 1e6)
  return Math.round(passos * pas * 100) / 100
}

export function calculaPreu(c: CostosExcursio, p: ParametresPreu): ResultatPreu {
  // **No s'arrodoneix.** Comprovat contra les excursions reals: amb 89 alumnes
  // i una previsió de 0,75 l'Excel reparteix entre 66,75 i no entre 67, i
  // arrodonir-ho aquí desquadra el preu. Els esperats s'arrodoneixen només en
  // ensenyar-los per pantalla, que és on «66,75 alumnes» no vol dir res.
  const esperats = c.alumnes * p.previsio

  // Si l'AMPA cobreix l'activitat, l'activitat val zero i tampoc no es resta
  // l'aportació: ja s'ha gastat aquí.
  const activitat = c.ampaCobreixActivitat ? 0 : c.preuActivitat
  const activitatTotal = c.preuActivitatTipus === 'total' ? activitat : 0
  const activitatPerAlumne = c.preuActivitatTipus === 'per_alumne' ? activitat : 0

  const transport = c.autocars.reduce((s, preu) => s + preu, 0) * (1 + p.ivaPct / 100)
  const costosFixos = transport + activitatTotal + c.costAcompanyants

  const costAlumne = esperats > 0 ? costosFixos / esperats + activitatPerAlumne : 0

  const ampa = c.ampaCobreixActivitat ? 0 : c.ampaImport
  const base = Math.max(0, costAlumne - ampa)

  return { esperats, costosFixos, costAlumne, base, preu: arrodoneixAmunt(base * (1 + p.margePct / 100), p.arrodoniment) }
}
