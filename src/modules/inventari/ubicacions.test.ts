import { describe, it, expect } from 'vitest'
import { ubicacioCompleta, missatgeErrorUbicacio } from './ubicacions'
import type { Ubicacio } from './ubicacions'

const CATALEG: Ubicacio[] = [
  { id: '1', Codi: 'A21-ESO-2A', Edifici: 'A-EscC', Planta: 'PTA1' },
  { id: '2', Codi: 'Aula Portàtil', Edifici: '', Planta: '' },
  { id: '3', Codi: 'Biblioteca', Edifici: 'Principal', Planta: '' },
]

describe('ubicacioCompleta', () => {
  it('uneix codi, edifici i planta', () => {
    expect(ubicacioCompleta('A21-ESO-2A', CATALEG)).toBe('A21-ESO-2A · A-EscC · PTA1')
  })

  it('omet les parts buides', () => {
    expect(ubicacioCompleta('Aula Portàtil', CATALEG)).toBe('Aula Portàtil')
    expect(ubicacioCompleta('Biblioteca', CATALEG)).toBe('Biblioteca · Principal')
  })

  it('sense codi no hi ha ubicació', () => {
    expect(ubicacioCompleta('', CATALEG)).toBe('')
  })

  it('mostra tal qual un codi que no és al catàleg', () => {
    expect(ubicacioCompleta('Magatzem', CATALEG)).toBe('Magatzem')
  })
})

describe('missatgeErrorUbicacio', () => {
  it('explica per què no es pot esborrar una ubicació amb dispositius', () => {
    const err = new Error('Error eliminant registre de ubicacions: update or delete on table "ubicacions" violates foreign key constraint "inventari_ubicacio_fkey" on table "inventari"')
    expect(missatgeErrorUbicacio(err)).toBe('Aquesta ubicació encara té dispositius assignats. Canvia’ls d’ubicació abans d’esborrar-la.')
  })

  it('explica un codi repetit', () => {
    const err = new Error('Error afegint registre a ubicacions: duplicate key value violates unique constraint "ubicacions_codi_key"')
    expect(missatgeErrorUbicacio(err)).toBe('Ja hi ha una ubicació amb aquest codi.')
  })

  it('deixa passar qualsevol altre error tal com és', () => {
    expect(missatgeErrorUbicacio(new Error('Sense connexió'))).toBe('Sense connexió')
  })
})
