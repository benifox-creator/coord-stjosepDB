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

// Exactament la regla de `configStore.getValues`, i no una de pròpia: només
// es cau als valors de sèrie quan **no hi ha** res desat. Amb la regla antiga
// («si és buit, els de sèrie»), esborrar tots els passos del pagament a
// Configuració desava `[]` i la pantalla en mostrava zero mentre la circular
// n'imprimia sis. Una llista buida és una decisió, no un forat.
function llista(config: Record<string, string[]>, clau: string): string[] {
  return config[clau] ?? CONFIG_DEFAULTS[clau] ?? []
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
