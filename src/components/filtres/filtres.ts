// Definicions dels filtres d'un llistat i els xips que en surten. Cada
// pantalla declara els seus filtres; BarraFiltres els pinta.

export interface OpcioFiltre {
  valor: string
  etiqueta: string
}

interface BaseFiltre {
  clau: string
  label: string
}

export interface FiltreSelect extends BaseFiltre {
  tipus: 'select'
  // Text de l'opció buida: «Tots», «Totes», «Tot el curs»…
  totes: string
  opcions: OpcioFiltre[]
}

export interface FiltreData extends BaseFiltre {
  tipus: 'data'
  min?: string
  max?: string
}

export type DefinicioFiltre = FiltreSelect | FiltreData

// '' = sense filtre.
export type ValorsFiltres = Record<string, string>

export interface FiltreActiu {
  clau: string
  etiqueta: string
}

export function opcions(valors: readonly string[]): OpcioFiltre[] {
  return valors.map((v) => ({ valor: v, etiqueta: v }))
}

export function dataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

// Un xip per cada filtre amb valor, en l'ordre de les definicions. La cerca
// no en fa: ja es veu escrita al quadre.
export function filtresActius(defs: DefinicioFiltre[], valors: ValorsFiltres): FiltreActiu[] {
  return defs.flatMap((d) => {
    const v = valors[d.clau] ?? ''
    if (!v) return []
    const text = d.tipus === 'data' ? dataCurta(v) : (d.opcions.find((o) => o.valor === v)?.etiqueta ?? v)
    return [{ clau: d.clau, etiqueta: `${d.label}: ${text}` }]
  })
}
