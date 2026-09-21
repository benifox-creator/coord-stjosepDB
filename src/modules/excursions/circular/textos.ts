// Els textos fixos de la circular. Són configurables perquè el que canvia
// d'un curs a l'altre és com es diu una cosa, no el disseny del document; i
// perquè si la intenció d'alguna frase era una altra, es canviï sense haver
// de tocar codi.
import { CONFIG_DEFAULTS } from '../../../store/configStore'

export interface TextosCircular {
  pagamentIntro: string
  passosPagament: string[]
  ampa: string
  devolucions: string
  resguard: string
}

function llista(config: Record<string, string[]>, clau: string): string[] {
  const desats = config[clau]
  return desats && desats.length ? desats : (CONFIG_DEFAULTS[clau] ?? [])
}
const primer = (config: Record<string, string[]>, clau: string) => llista(config, clau)[0] ?? ''

export function textosCircular(config: Record<string, string[]>): TextosCircular {
  return {
    pagamentIntro: primer(config, 'excursions.text-pagament-intro'),
    passosPagament: llista(config, 'excursions.passos-pagament'),
    ampa: primer(config, 'excursions.text-ampa'),
    devolucions: primer(config, 'excursions.text-devolucions'),
    resguard: primer(config, 'excursions.text-resguard'),
  }
}
