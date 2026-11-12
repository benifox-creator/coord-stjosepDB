import { describe, it, expect } from 'vitest'
import { missatgeError } from './errorsDb'

const SENSE_PERMIS = 'No tens permís per fer aquesta acció. Si creus que l’hauries de poder fer, parla amb coordinació.'

describe('missatges d’error de la base de dades', () => {
  it('un canvi que la base de dades no deixa fer (cap fila tornada) s’explica', () => {
    expect(missatgeError({ code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object' }, 'Error actualitzant registre a incidencies'))
      .toBe('No tens permís per fer aquest canvi, o el registre ja no existeix. Si creus que l’hauries de poder fer, parla amb coordinació.')
  })
  it('les regles d’accés i les funcions protegides donen el mateix missatge', () => {
    expect(missatgeError({ code: '42501', message: 'new row violates row-level security policy for table "x"' }, 'Error afegint registre a x')).toBe(SENSE_PERMIS)
    expect(missatgeError({ code: '42501', message: 'permission denied for function queue_email' })).toBe(SENSE_PERMIS)
    expect(missatgeError({ code: 'P0001', message: 'No autoritzat' })).toBe(SENSE_PERMIS)
  })
  it('una sessió caducada demana tornar a entrar', () => {
    expect(missatgeError({ code: 'PGRST303', message: 'JWT expired' })).toBe('La sessió ha caducat. Torna a carregar la pàgina i, si cal, torna a entrar.')
  })
  it('la resta d’errors es mantenen com abans', () => {
    expect(missatgeError({ code: '23505', message: 'duplicate key value' }, 'Error afegint registre a usuaris')).toBe('Error afegint registre a usuaris: duplicate key value')
    expect(missatgeError({ code: 'P0001', message: 'Un préstec retornat no es pot reobrir.' })).toBe('Un préstec retornat no es pot reobrir.')
  })
})
