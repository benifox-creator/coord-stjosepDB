import { describe, it, expect } from 'vitest'
import { filtraInventari, filtresActius, FILTRES_BUITS } from './filtres'
import type { FiltresInventari } from './filtres'
import type { ItemInventari } from './types'

function item(dades: Partial<ItemInventari>): ItemInventari {
  return {
    id: dades.ID ?? 'x', ID: 'INV-000', Nom: '', Categoria: 'PC', Marca: '', Model: '', 'Núm_sèrie': '',
    Ubicació: '', Estat: 'Actiu', Accio: '', SistemaOperatiu: '', Data_compra: '', Garantia_fins: '',
    MAC_LAN: '', MAC_WAN: '', IP_LAN: '', IP_WAN: '', Notes: '',
    ...dades,
  }
}

const ITEMS = [
  item({ ID: 'INV-003', Nom: 'EP-1A', Categoria: 'Portàtil', Ubicació: 'A4-EP-1A', Estat: 'Avariat', Accio: 'Reparar', Marca: 'Acer' }),
  item({ ID: 'INV-001', Nom: 'tablet01', Categoria: 'Tauleta', Ubicació: 'Aula Portàtil', Estat: 'Actiu', SistemaOperatiu: 'Android OS' }),
  item({ ID: 'INV-002', Nom: 'Projector', Categoria: 'Projector', Ubicació: 'A4-EP-1A', Estat: 'En reparació', Accio: 'Revisar' }),
  item({ ID: 'INV-004', Nom: 'Vell', Categoria: 'PC', Estat: 'De baixa' }),
]

const ids = (f: Partial<FiltresInventari>) => filtraInventari(ITEMS, { ...FILTRES_BUITS, ...f }).map((i) => i.ID)

describe('filtraInventari', () => {
  it('sense filtres ho retorna tot, ordenat per ID', () => {
    expect(ids({})).toEqual(['INV-001', 'INV-002', 'INV-003', 'INV-004'])
  })

  it('filtra per un estat concret', () => {
    expect(ids({ estat: 'Avariat' })).toEqual(['INV-003'])
  })

  it('«avariats» agrupa Avariat i En reparació, com el Dashboard', () => {
    expect(ids({ estat: 'avariats' })).toEqual(['INV-002', 'INV-003'])
  })

  it('filtra per tipus i per ubicació alhora', () => {
    expect(ids({ categoria: 'Projector', ubicacio: 'A4-EP-1A' })).toEqual(['INV-002'])
  })

  it('«qualsevol» deixa només els que tenen alguna acció pendent', () => {
    expect(ids({ accio: 'qualsevol' })).toEqual(['INV-002', 'INV-003'])
  })

  it('filtra per una acció concreta', () => {
    expect(ids({ accio: 'Revisar' })).toEqual(['INV-002'])
  })

  it('la cerca no distingeix majúscules i mira nom, marca, ubicació i sistema operatiu', () => {
    expect(ids({ cerca: 'acer' })).toEqual(['INV-003'])
    expect(ids({ cerca: 'ANDROID' })).toEqual(['INV-001'])
    expect(ids({ cerca: '  aula portàtil ' })).toEqual(['INV-001'])
  })
})

describe('filtresActius', () => {
  it('sense filtres no n’hi ha cap; la cerca no compta com a xip', () => {
    expect(filtresActius({ ...FILTRES_BUITS, cerca: 'acer' })).toEqual([])
  })

  it('un xip per filtre, amb el nom del filtre davant', () => {
    expect(filtresActius({ ...FILTRES_BUITS, estat: 'Robat', categoria: 'Tauleta', ubicacio: 'A4-EP-1A', accio: 'Reparar' })).toEqual([
      { clau: 'estat', etiqueta: 'Estat: Robat' },
      { clau: 'categoria', etiqueta: 'Tipus: Tauleta' },
      { clau: 'ubicacio', etiqueta: 'Ubicació: A4-EP-1A' },
      { clau: 'accio', etiqueta: 'Acció: Reparar' },
    ])
  })

  it('els dos valors especials tenen una etiqueta llegible', () => {
    expect(filtresActius({ ...FILTRES_BUITS, estat: 'avariats', accio: 'qualsevol' })).toEqual([
      { clau: 'estat', etiqueta: 'Estat: Avariats o en reparació' },
      { clau: 'accio', etiqueta: 'Acció: Amb alguna acció pendent' },
    ])
  })
})
