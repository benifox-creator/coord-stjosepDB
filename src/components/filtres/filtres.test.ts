import { describe, it, expect } from 'vitest'
import { filtresActius, opcions, dataCurta } from './filtres'
import type { DefinicioFiltre } from './filtres'

const DEFS: DefinicioFiltre[] = [
  { clau: 'estat', label: 'Estat', tipus: 'select', totes: 'Tots', opcions: [{ valor: 'avariats', etiqueta: 'Avariats o en reparació' }, ...opcions(['Actiu', 'Robat'])] },
  { clau: 'data', label: 'Data', tipus: 'data' },
  { clau: 'categoria', label: 'Tipus', tipus: 'select', totes: 'Tots', opcions: opcions(['PC', 'Tauleta']) },
]

describe('opcions', () => {
  it('fa servir el mateix text com a valor i com a etiqueta', () => {
    expect(opcions(['A', 'B'])).toEqual([{ valor: 'A', etiqueta: 'A' }, { valor: 'B', etiqueta: 'B' }])
  })
})

describe('dataCurta', () => {
  it('passa una data ISO a dd/mm/aaaa', () => {
    expect(dataCurta('2026-10-08')).toBe('08/10/2026')
  })
  it('deixa tal qual el que no és una data ISO', () => {
    expect(dataCurta('demà')).toBe('demà')
  })
})

describe('filtresActius', () => {
  it('sense valors no hi ha cap xip', () => {
    expect(filtresActius(DEFS, { estat: '', data: '', categoria: '' })).toEqual([])
    expect(filtresActius(DEFS, {})).toEqual([])
  })

  it("un xip per filtre amb valor, en l'ordre de les definicions", () => {
    expect(filtresActius(DEFS, { categoria: 'PC', data: '2026-10-08', estat: 'Robat' })).toEqual([
      { clau: 'estat', etiqueta: 'Estat: Robat' },
      { clau: 'data', etiqueta: 'Data: 08/10/2026' },
      { clau: 'categoria', etiqueta: 'Tipus: PC' },
    ])
  })

  it("fa servir l'etiqueta de l'opció, no el valor", () => {
    expect(filtresActius(DEFS, { estat: 'avariats' })).toEqual([{ clau: 'estat', etiqueta: 'Estat: Avariats o en reparació' }])
  })

  it("un valor que ja no és entre les opcions es mostra tal qual", () => {
    expect(filtresActius(DEFS, { categoria: 'Projector' })).toEqual([{ clau: 'categoria', etiqueta: 'Tipus: Projector' }])
  })

  it('ignora valors sense definició (per exemple, la cerca)', () => {
    expect(filtresActius(DEFS, { cerca: 'acer' })).toEqual([])
  })
})
