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
  // cosa està molt malament a la configuració. Val més tornar una cadena buida
  // que imprimir una data festiu a la circular.
  for (let i = 0; i < 30 && !esDiaLectiu(d, diesNoLectius); i++) d = mou(d, pas)
  if (!esDiaLectiu(d, diesNoLectius)) return ''
  return d
}

export function proposaDates(
  dataExcursio: string,
  diesNoLectius: string[],
  diesAbansCircular = 15,
  diesAbansTermini = 8,
): DatesCircular {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataExcursio)) return { circular: '', pagament: '', resguard: '' }
  // Una data que passa el regex pot seguir sense ser vàlida (2026-02-30, 2026-13-01).
  // Si la data no és vàlida, JavaScript la roda silenciosament a una altra, o llança error. Rebutjar-la.
  try {
    if (new Date(`${dataExcursio}T00:00:00Z`).toISOString().slice(0, 10) !== dataExcursio) {
      return { circular: '', pagament: '', resguard: '' }
    }
  } catch {
    return { circular: '', pagament: '', resguard: '' }
  }

  // També es recula fins a un dia amb classe. Amb els 15 dies de sèrie la
  // resta cau sempre al mateix dia de la setmana que la sortida menys un, o
  // sigui que **tota** excursió de dilluns proposava un diumenge: la circular
  // sortia datada «L'Hospitalet, Diumenge, 1 de novembre de 2026» i la
  // pantalla marcava la proposta de l'app mateixa com a «no és dia lectiu».
  const circular = fins_a_lectiu(mou(dataExcursio, -diesAbansCircular), -1, diesNoLectius)
  // El termini es mou **enrere**: endarrerir-lo acostaria el cobrament al dia
  // de la sortida, que és el que no es vol.
  const pagament = fins_a_lectiu(mou(dataExcursio, -diesAbansTermini), -1, diesNoLectius)
  // El resguard es lliura al tutor, i en dissabte no hi ha ningú a qui donar-lo.
  const resguard = pagament === '' ? '' : fins_a_lectiu(mou(pagament, 1), 1, diesNoLectius)

  return { circular, pagament, resguard }
}
