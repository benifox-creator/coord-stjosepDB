// src/modules/excursions/pressupostExport.utils.ts
//
// El full que se'n va a l'empresa d'autocars perquè hi posi preus. Construir
// les files està separat d'escriure l'Excel a propòsit: el contingut —que és
// el que se'n va del centre— es pot provar sense generar cap fitxer.
import { diaSetmana } from './circular/dades'
import type { Excursio } from './types'

/** Què se li demana a l'empresa. D'això depenen les columnes buides del full. */
export type QueEsDemana = 'autocar' | 'activitat' | 'ambdues'

const BASE = ['Codi', 'Data', 'Dia', 'Destinació', 'Població', 'Grups', 'Passatgers', 'Sortida', 'Tornada']
const AUTOCAR = ['Places', 'Preu autocar']
// Dues columnes i no una: el full antic del centre no marcava si la xifra era
// per alumne o un total de grup —16 de 44 eren totals— i s'havia de deduir
// creuant dos fulls. Amb dues columnes no hi ha res a deduir.
const ACTIVITAT = ['Preu per alumne', 'Preu total del grup']

/**
 * Les que encara no tenen preu d'autocar i el poden tenir.
 *
 * `ambAutocars` són els identificadors de les sortides que ja en tenen algun
 * amb preu: `Excursio` no els porta —viuen a `excursio_autocars`, que té
 * l'accés restringit— i per això entren com a argument.
 */
export function pendentsDePressupost(excursions: Excursio[], ambAutocars: ReadonlySet<string>): Excursio[] {
  return excursions.filter((e) =>
    // Un esborrany o una proposta encara es poden rebutjar: demanar-ne preu
    // seria fer treballar l'empresa per a una sortida que potser no es fa.
    e.Estat !== 'Esborrany' && e.Estat !== 'Proposada' && e.Estat !== 'Cancel·lada' &&
    e.Transport === 'autocar' &&
    // Sense dia no s'hi pot posar preu: el cost d'un autocar depèn del dia.
    e.Data !== null &&
    !ambAutocars.has(e.id))
}

/** Els qui pugen a l'autocar: els acompanyants també hi ocupen seient. */
export function passatgers(e: Excursio): number {
  const alumnes = e.Grups.reduce((s, g) => s + g.AlumnesPrevistos, 0)
  return alumnes + e.Acompanyants.length + e.AcompanyantsExterns
}

export function capcaleresPressupost(demana: QueEsDemana): string[] {
  return [
    ...BASE,
    ...(demana === 'autocar' || demana === 'ambdues' ? AUTOCAR : []),
    ...(demana === 'activitat' || demana === 'ambdues' ? ACTIVITAT : []),
  ]
}

export function filesPressupost(excursions: Excursio[], demana: QueEsDemana): (string | number)[][] {
  const buides = capcaleresPressupost(demana).length - BASE.length
  return excursions.map((e) => [
    e.Codi,
    e.Data ?? '',
    diaSetmana(e.Data ?? ''),
    e.Lloc,
    e.Poblacio,
    e.Grups.map((g) => g.Grup).join(', '),
    passatgers(e),
    e.HoraSortida,
    e.HoraTornada,
    ...Array<string>(buides).fill(''),
  ])
}

/** El nom del fitxer, sense caràcters que cap sistema de fitxers vulgui. */
function nomFitxer(empresa: string, curs: string): string {
  const net = empresa.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `pressupost-${net || 'autocars'}-${curs}.xlsx`
}

export async function generaExcelPressupost(
  excursions: Excursio[], demana: QueEsDemana, empresa: string, curs: string,
): Promise<void> {
  const XLSX = await import('xlsx')
  const capcaleres = capcaleresPressupost(demana)
  const worksheet = XLSX.utils.aoa_to_sheet([capcaleres, ...filesPressupost(excursions, demana)])
  worksheet['!cols'] = capcaleres.map((c) => ({ wch: Math.max(12, c.length + 2) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pressupost')
  XLSX.writeFile(workbook, nomFitxer(empresa, curs))
}
