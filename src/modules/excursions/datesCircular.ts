// src/modules/excursions/datesCircular.ts
//
// Les tres dates que surten a la circular. Es proposen soles perquè ningú les
// hagi de comptar a mà cada vegada, però Gestió les pot canviar una a una:
// són una proposta, no una regla.
//
// A la plantilla antiga el pagament i el resguard compartien data i se'ls
// anomenava «dimarts» en un lloc i «dimecres» en un altre. Són dos dies
// diferents i aquí es calculen per separat.
import { esDiaLectiu } from '../../utils/schoolCalendar'

export interface DatesCircular {
  circular: string
  pagament: string
  resguard: string
}

function mou(iso: string, dies: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dies)
  return d.toISOString().slice(0, 10)
}

/** Recula (o avança) fins a trobar un dia amb classe. */
function fins_a_lectiu(iso: string, pas: -1 | 1, diesNoLectius: string[]): string {
  let d = iso
  // Un mes de marge: si en trenta intents no n'hi ha cap de lectiu, alguna
  // cosa està molt malament a la configuració i val més tornar el que hi ha
  // que girar per sempre.
  for (let i = 0; i < 30 && !esDiaLectiu(d, diesNoLectius); i++) d = mou(d, pas)
  return d
}

export function proposaDates(
  dataExcursio: string,
  diesNoLectius: string[],
  diesAbansCircular = 15,
  diesAbansTermini = 8,
): DatesCircular {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataExcursio)) return { circular: '', pagament: '', resguard: '' }

  const circular = mou(dataExcursio, -diesAbansCircular)
  // El termini es mou **enrere**: endarrerir-lo acostaria el cobrament al dia
  // de la sortida, que és el que no es vol.
  const pagament = fins_a_lectiu(mou(dataExcursio, -diesAbansTermini), -1, diesNoLectius)
  // El resguard es lliura al tutor, i en dissabte no hi ha ningú a qui donar-lo.
  const resguard = fins_a_lectiu(mou(pagament, 1), 1, diesNoLectius)

  return { circular, pagament, resguard }
}
