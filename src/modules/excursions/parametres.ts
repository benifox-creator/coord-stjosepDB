// src/modules/excursions/parametres.ts
//
// Pont entre la configuració i el càlcul. Viu aquí i no dins `preu.ts` perquè
// el càlcul no ha de dependre de res, i no dins `configStore` perquè el store
// no ha de saber què és un preu d'excursió.
import { CONFIG_DEFAULTS } from '../../store/configStore'
import type { ParametresPreu } from './preu'

/**
 * Llegeix un número de la configuració. Si el valor desat no s'entén —algú hi
 * va escriure "dotze"— val més el valor per defecte que un preu en NaN, que és
 * el que acabaria veient una família.
 */
function num(config: Record<string, string[]>, clau: string, defecte: number): number {
  const desat = Number(config[clau]?.[0])
  if (Number.isFinite(desat)) return desat
  const perDefecte = Number(CONFIG_DEFAULTS[clau]?.[0])
  return Number.isFinite(perDefecte) ? perDefecte : defecte
}

/**
 * Els quatre paràmetres del càlcul per a una etapa. Els darrers arguments de
 * `num` cobreixen una etapa que no sigui a `CONFIG_DEFAULTS`: val més calcular
 * amb els valors de la resta del centre que deixar la pantalla en blanc.
 */
export function parametresPreu(config: Record<string, string[]>, etapa: string): ParametresPreu {
  return {
    previsio: num(config, `excursions.previsio.${etapa}`, 0.75),
    margePct: num(config, `excursions.marge-pct.${etapa}`, 12),
    ivaPct: num(config, 'excursions.iva-pct', 10),
    arrodoniment: num(config, 'excursions.arrodoniment', 0.5),
  }
}
