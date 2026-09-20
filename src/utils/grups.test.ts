import { describe, it, expect } from 'vitest'
import { opcionsDeGrup } from './grups'

const llista = ['EP-1 A', 'EP-1 B']

describe('opcions d’un desplegable de grup', () => {
  it('dona la llista tal qual quan el valor actual hi és', () => {
    expect(opcionsDeGrup(llista, 'EP-1 A')).toEqual(llista)
  })

  it('no ofereix res de més quan no hi ha valor actual', () => {
    expect(opcionsDeGrup(llista, '')).toEqual(llista)
  })

  it('conserva un nom antic que ja no és a la llista, i el posa primer', () => {
    // Si no, obrir una substitució antiga buidaria el grup sense avisar.
    expect(opcionsDeGrup(llista, '2n ESO A')).toEqual(['2n ESO A', 'EP-1 A', 'EP-1 B'])
  })
})
