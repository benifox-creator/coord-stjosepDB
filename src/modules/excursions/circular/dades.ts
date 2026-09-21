// src/modules/excursions/circular/dades.ts
//
// D'una excursió desada al que necessita el document. Aquí no hi entra `docx`:
// el format —que és on es cometen els errors que després es veuen en paper— es
// pot provar sense construir cap document.
import type { Excursio } from '../types'
import type { DatesCircular } from '../datesCircular'
import type { TextosCircular } from './textos'

const DIES = ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte']
const MESOS = ['gener','febrer','març','abril','maig','juny','juliol','agost',
               'setembre','octubre','novembre','desembre']

/** «Dimecres, 18 de novembre de 2026». Amb apòstrof davant de vocal. */
export function dataLlarga(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const d = new Date(`${iso}T00:00:00Z`)
  const mes = d.getUTCMonth()                       // 0-11
  const prep = [3, 7, 9].includes(mes) ? "d'" : 'de '   // abril, agost, octubre
  return `${DIES[d.getUTCDay()]}, ${d.getUTCDate()} ${prep}${MESOS[mes]} de ${d.getUTCFullYear()}`
}

export interface DadesCircular {
  curs: string
  cursEscolar: string
  lloc: string
  poblacio: string
  activitat: string
  dia: string
  sortida: string
  tornada: string
  preu: string
  ampa: boolean
  limitPagament: string
  limitResguard: string
  dataCircular: string
  nota: string
  textos: TextosCircular
}

const hora = (h: string) => (h ? `${h.replace(/^0/, '')} h` : '')

export function dadesCircular(
  e: Excursio, dates: DatesCircular, textos: TextosCircular, nota: string,
): DadesCircular {
  return {
    // El curs, i no l'etapa: la família ha de llegir el curs del seu fill.
    curs: e.Grups.map((g) => g.Grup).join(' i '),
    cursEscolar: e.CursEscolar,
    lloc: e.Lloc,
    poblacio: e.Poblacio,
    activitat: e.Activitat,
    dia: dataLlarga(e.Data ?? ''),
    sortida: hora(e.HoraSortida),
    tornada: hora(e.HoraTornada),
    // Sense preu confirmat no s'escriu cap import: val més un buit que un
    // número que ningú ha aprovat.
    preu: e.PreuAlumne === null ? '' : `${e.PreuAlumne.toFixed(2).replace('.', ',')} €`,
    // Un sí o no que ve de l'excursió, no dels costos: qui genera la
    // circular pot no poder-los llegir.
    ampa: e.AmpaCollabora,
    limitPagament: dataLlarga(dates.pagament),
    limitResguard: dataLlarga(dates.resguard),
    dataCircular: dataLlarga(dates.circular),
    nota,
    textos,
  }
}
