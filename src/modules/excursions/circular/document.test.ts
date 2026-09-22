import { describe, it, expect } from 'vitest'
import { Packer } from 'docx'
import { unzipSync, strFromU8 } from 'fflate'
import { circularDocx } from './document'
import type { DadesCircular } from './dades'

const dades: DadesCircular = {
  curs: 'EP-1 A', cursEscolar: '2026-2027', lloc: 'Can Montcau',
  poblacio: 'La Roca del Vallès', activitat: 'Visita a la granja',
  dia: 'Dimecres, 18 de novembre de 2026', sortida: '9:15 h', tornada: '17:00 h',
  preu: '31,00 €', ampa: true,
  limitPagament: 'Divendres, 6 de novembre de 2026',
  limitResguard: 'Dilluns, 9 de novembre de 2026',
  dataCircular: 'Dimarts, 3 de novembre de 2026',
  nota: 'Cal portar esmorzar.',
  textos: {
    pagamentIntro: 'El pagament es fa amb el codi de barres.',
    passosPagament: ['Primer pas', 'Segon pas'],
    ampa: "L'AMPA hi col·labora.",
    devolucions: 'Si un alumne no assisteix…',
    resguard: 'Cal lliurar el resguard.',
  },
}

async function textDelDocument(d: DadesCircular): Promise<string> {
  const buffer = await Packer.toBuffer(circularDocx(d))
  // El .docx és un zip i el text hi va comprimit dins word/document.xml: no
  // es pot buscar com a text pla al binari (es va comprovar i falla), cal
  // descomprimir-lo de debò.
  const zip = unzipSync(new Uint8Array(buffer))
  const xml = strFromU8(zip['word/document.xml'])
  // docx escapa l'apòstrof com a entitat XML (`&apos;`) fins i tot dins de
  // text, no només en atributs: cal desfer-ho perquè «L'AMPA» es pugui
  // buscar tal com s'escriu, no tal com queda codificat.
  return xml.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

describe('la circular en Word', () => {
  it('porta les dades de l’excursió', async () => {
    const text = await textDelDocument(dades)
    for (const bocí of ['Can Montcau', 'Visita a la granja', '31,00', '9:15']) {
      expect(text, bocí).toContain(bocí)
    }
  })

  it('porta les tres dates i no les confon', async () => {
    // A la plantilla antiga el pagament i el resguard compartien data i se'ls
    // deia dies diferents. Comprovar només que hi surten totes dues no serveix
    // de res: si a `document.ts` s'intercanviessin `limitPagament` i
    // `limitResguard`, hi continuarien sortint i la prova passaria. El que cal
    // és que cada data sigui **al seu bloc**, que és el que llegeix la família.
    const text = await textDelDocument(dades)
    const avis = text.indexOf('DATA LÍMIT DE PAGAMENT')
    const seccioResguard = text.indexOf('Lliurament del resguard')
    const pagament = text.indexOf('6 de novembre')
    const resguard = text.indexOf('9 de novembre')
    expect(avis).toBeGreaterThan(-1)
    expect(seccioResguard).toBeGreaterThan(avis)
    // La data de pagament, dins el requadre taronja i abans de la secció del
    // resguard; la del resguard, després del títol d'aquella secció.
    expect(pagament).toBeGreaterThan(avis)
    expect(pagament).toBeLessThan(seccioResguard)
    expect(resguard).toBeGreaterThan(seccioResguard)
  })

  it('tot el que ve de les dades arriba al document', async () => {
    // Cada bocí d'aquesta llista és un camp que no es comprovava enlloc: se'n
    // podia esborrar el bloc de `document.ts` —la nota, per exemple— i totes
    // les proves seguien verdes.
    const text = await textDelDocument(dades)
    for (const bocí of [
      'EP-1 A',                                        // el curs que busca la família
      'La Roca del Vallès',                            // la població, sota el lloc
      '17:00',                                         // l'hora de tornada
      'Cal portar esmorzar.',                          // la nota d'aquesta excursió
      "L'Hospitalet, Dimarts, 3 de novembre de 2026",  // la data de la circular mateixa
      'El pagament es fa amb el codi de barres.',      // textos.pagamentIntro
      'Primer pas', 'Segon pas',                       // textos.passosPagament
      'Si un alumne no assisteix…',                    // textos.devolucions
      'Cal lliurar el resguard.',                      // textos.resguard
    ]) {
      expect(text, bocí).toContain(bocí)
    }
  })

  it('i sense nota no s’hi inventa cap paràgraf', async () => {
    expect(await textDelDocument({ ...dades, nota: '' })).not.toContain('Cal portar esmorzar')
  })

  it('la frase de l’AMPA només hi surt si l’AMPA hi posa diners', async () => {
    expect(await textDelDocument(dades)).toContain("L'AMPA hi col")
    expect(await textDelDocument({ ...dades, ampa: false })).not.toContain("L'AMPA hi col")
  })

  it('genera un fitxer que s’obre', async () => {
    const buffer = await Packer.toBuffer(circularDocx(dades))
    // 'PK' és la signatura d'un zip, que és el que és un .docx per dins.
    expect(Buffer.from(buffer).subarray(0, 2).toString()).toBe('PK')
    expect(buffer.byteLength).toBeGreaterThan(10_000)   // amb el logo a dins
  })
})
